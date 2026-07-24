import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { auth, currentUser } from '@clerk/nextjs/server';
import {
    canAdminUsePaidBilling,
    decideSubscriptionPurchase,
    resolveCheckoutSelection
} from '@/lib/checkoutPlan.mjs';
import {
    resolveSubscriptionAccess,
    subscriptionPriceIdsFromEnv
} from '@/lib/subscriptionAccess.mjs';
import { ensureProMaxBillingPortal } from '@/lib/promaxBillingPortal.mjs';

const NON_RESTARTABLE_STATUSES = new Set([
    'active',
    'trialing',
    'past_due',
    'incomplete',
    'unpaid',
    'paused'
]);

function stripeObjectId(value) {
    return typeof value === 'string' ? value : value?.id;
}

async function findExistingSubscription(user) {
    const priceIds = subscriptionPriceIdsFromEnv(process.env);
    const subscriptions = new Map();
    const savedSubscriptionId = user.privateMetadata?.stripeSubscriptionId;

    if (savedSubscriptionId) {
        const savedSubscription = await stripe.subscriptions.retrieve(savedSubscriptionId);
        subscriptions.set(savedSubscription.id, savedSubscription);
    }

    const email = user.emailAddresses?.[0]?.emailAddress;
    if (email) {
        const customers = await stripe.customers.list({ email, limit: 10 });
        const customerSubscriptions = await Promise.all(
            customers.data.map((customer) => stripe.subscriptions.list({
                customer: customer.id,
                limit: 100,
                status: 'all'
            }))
        );

        customerSubscriptions.forEach((result) => {
            result.data.forEach((subscription) => {
                subscriptions.set(subscription.id, subscription);
            });
        });
    }

    const recognizedSubscriptions = [...subscriptions.values()]
        .map((subscription) => ({
            access: resolveSubscriptionAccess(subscription, priceIds),
            subscription
        }))
        .filter(({ access }) => access.recognized);

    const blockingSubscriptions = recognizedSubscriptions
        .filter(({ access }) => NON_RESTARTABLE_STATUSES.has(access.status));

    if (blockingSubscriptions.length > 1) {
        return {
            conflict: true,
            customerId: user.privateMetadata?.stripeCustomerId || null
        };
    }

    const selected = blockingSubscriptions[0]
        || recognizedSubscriptions.find(({ subscription }) => subscription.id === savedSubscriptionId)
        || recognizedSubscriptions[0]
        || null;

    return {
        access: selected?.access || null,
        conflict: false,
        customerId: stripeObjectId(selected?.subscription?.customer)
            || user.privateMetadata?.stripeCustomerId
            || null,
        subscription: selected?.subscription || null
    };
}

async function createPortalSession({ customerId, origin, flowData, configuration }) {
    const params = {
        customer: customerId,
        locale: 'ja',
        return_url: `${origin}/app`
    };

    if (configuration) params.configuration = configuration;
    if (flowData) params.flow_data = flowData;

    return stripe.billingPortal.sessions.create(params);
}

export async function POST(req) {
    try {
        const { userId } = await auth();
        const user = await currentUser();

        if (!userId || !user) {
            return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
        }

        const reqBody = await req.json().catch(() => ({}));
        const { interval = 'month', tier = 'pro' } = reqBody;
        const selection = resolveCheckoutSelection({ interval, tier }, process.env);

        if (selection.error === 'Unsupported plan selection') {
            return NextResponse.json({ error: '選択されたプランを確認できません' }, { status: 400 });
        }

        if (!selection.valid) {
            console.error("Missing Stripe Price ID for tier:", tier, "interval:", interval);
            return NextResponse.json(
                { error: 'このプランは現在決済準備中です。個別相談をご利用ください' },
                { status: 503 }
            );
        }

        const reqUrl = new URL(req.url);
        const origin = reqUrl.origin;
        const existing = await findExistingSubscription(user);

        if (existing.conflict) {
            return NextResponse.json(
                { error: '複数の有効な契約が見つかりました。個別相談からお問い合わせください' },
                { status: 409 }
            );
        }

        // 運営者でも既存の有料契約がある場合は、その契約の管理・変更だけを許可する。
        // 有料契約のない運営者に新規Checkoutを作る従来の遮断は維持する。
        if (
            user.publicMetadata?.role === 'admin'
            && !canAdminUsePaidBilling(existing.access)
        ) {
            return NextResponse.json(
                { error: '運営者アカウントでは有料プランの決済は必要ありません' },
                { status: 400 }
            );
        }

        const purchaseAction = decideSubscriptionPurchase({
            access: existing.access,
            itemCount: existing.subscription?.items?.data?.length || 0,
            targetPriceId: selection.priceId,
            targetTier: selection.tier
        });

        if (purchaseAction === 'manage') {
            if (!existing.customerId) {
                return NextResponse.json(
                    { error: '契約情報を確認できません。個別相談からお問い合わせください' },
                    { status: 409 }
                );
            }

            const portalSession = await createPortalSession({
                customerId: existing.customerId,
                origin
            });
            return NextResponse.json({ mode: 'manage', url: portalSession.url });
        }

        if (purchaseAction === 'upgrade') {
            const subscriptionItem = existing.subscription?.items?.data?.[0];

            if (!existing.customerId || !subscriptionItem?.id) {
                return NextResponse.json(
                    { error: 'Pro Maxへの契約変更は現在準備中です。個別相談をご利用ください' },
                    { status: 503 }
                );
            }

            const configuration = await ensureProMaxBillingPortal({
                appUrl: origin,
                env: process.env,
                stripe
            });
            const portalSession = await createPortalSession({
                configuration: configuration.id,
                customerId: existing.customerId,
                flowData: {
                    type: 'subscription_update_confirm',
                    after_completion: {
                        type: 'redirect',
                        redirect: {
                            return_url: `${origin}/app?billing=updated`
                        }
                    },
                    subscription_update_confirm: {
                        subscription: existing.subscription.id,
                        items: [{
                            id: subscriptionItem.id,
                            price: selection.priceId,
                            quantity: subscriptionItem.quantity || 1
                        }]
                    }
                },
                origin
            });
            return NextResponse.json({ mode: 'subscription_update', url: portalSession.url });
        }

        const checkoutParams = {
            mode: 'subscription',
            locale: 'ja',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: selection.priceId,
                    quantity: 1,
                },
            ],
            success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/app`,
            client_reference_id: userId,
            metadata: {
                userId: userId,
                planTier: selection.tier,
                requiresOnboarding: selection.tier === 'promax' ? 'true' : 'false'
            },
            subscription_data: {
                metadata: {
                    userId: userId,
                    planTier: selection.tier,
                    requiresOnboarding: selection.tier === 'promax' ? 'true' : 'false'
                },
            },
        };

        if (existing.customerId) {
            checkoutParams.customer = existing.customerId;
        } else {
            checkoutParams.customer_email = user.emailAddresses[0]?.emailAddress;
        }

        const session = await stripe.checkout.sessions.create(checkoutParams);

        return NextResponse.json({ mode: 'checkout', url: session.url });
    } catch (error) {
        console.error("[STRIPE_ERROR]", error);
        return NextResponse.json(
            { error: '決済画面を準備できませんでした。時間をおいてもう一度お試しください' },
            { status: 500 }
        );
    }
}
