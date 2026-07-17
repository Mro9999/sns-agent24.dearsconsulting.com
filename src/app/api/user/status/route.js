import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import {
    resolveSubscriptionAccess,
    subscriptionPriceIdsFromEnv
} from '@/lib/subscriptionAccess.mjs';

function primaryEmailFor(user) {
    return user.emailAddresses?.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress
        || user.emailAddresses?.[0]?.emailAddress
        || null;
}

function periodEndIso(periodEnd) {
    return periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
}

function metadataSubscription(user, priceIds) {
    const metadata = user.privateMetadata || {};
    if (!metadata.stripePriceId) return null;

    const savedPeriodEnd = metadata.stripeCurrentPeriodEnd
        ? Math.floor(new Date(metadata.stripeCurrentPeriodEnd).getTime() / 1000)
        : null;
    const subscription = {
        id: metadata.stripeSubscriptionId || null,
        customer: metadata.stripeCustomerId || null,
        status: metadata.stripeSubscriptionStatus || null,
        current_period_end: Number.isFinite(savedPeriodEnd) ? savedPeriodEnd : null,
        cancel_at_period_end: metadata.stripeCancelAtPeriodEnd === true,
        items: { data: [{ price: { id: metadata.stripePriceId } }] }
    };
    const access = resolveSubscriptionAccess(subscription, priceIds);
    if (!access.recognized) return null;

    return {
        ...access,
        customerId: metadata.stripeCustomerId || null,
        subscription
    };
}

async function findRecognizedSubscription(user, priceIds) {
    const customerIds = new Set();
    const matches = [];
    const seenSubscriptionIds = new Set();
    const savedCustomerId = user.privateMetadata?.stripeCustomerId;
    const savedSubscriptionId = user.privateMetadata?.stripeSubscriptionId;
    if (savedCustomerId) customerIds.add(savedCustomerId);

    const addSubscription = (subscription, fallbackCustomerId = null) => {
        if (!subscription || seenSubscriptionIds.has(subscription.id)) return;
        seenSubscriptionIds.add(subscription.id);
        const access = resolveSubscriptionAccess(subscription, priceIds);
        if (!access.recognized) return;
        matches.push({
            ...access,
            customerId: typeof subscription.customer === 'string'
                ? subscription.customer
                : subscription.customer?.id || fallbackCustomerId,
            subscription
        });
    };

    if (savedSubscriptionId) {
        try {
            addSubscription(await stripe.subscriptions.retrieve(savedSubscriptionId), savedCustomerId);
        } catch (error) {
            console.warn(`[user-status] failed to retrieve saved subscription ${savedSubscriptionId.slice(-8)}: ${error.message}`);
        }
    }

    const email = primaryEmailFor(user);
    if (email) {
        const customers = await stripe.customers.list({ email, limit: 10 });
        customers.data.forEach((customer) => customerIds.add(customer.id));
    }

    for (const customerId of customerIds) {
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'all',
            limit: 20
        });
        subscriptions.data.forEach((subscription) => addSubscription(subscription, customerId));
    }

    return matches.sort((a, b) => {
        if (a.accessEnabled !== b.accessEnabled) return a.accessEnabled ? -1 : 1;
        return (b.periodEnd || 0) - (a.periodEnd || 0);
    })[0] || null;
}

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) return new NextResponse('Unauthorized', { status: 401 });

        // JWTの反映待ちに左右されないよう、Clerkのユーザー情報を直接取得する。
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);
        let accessRole = user.publicMetadata?.role || 'free';
        const email = primaryEmailFor(user);
        const adminAccessEmails = [
            process.env.ADMIN_EMAIL,
            ...(process.env.ADMIN_ACCESS_EMAILS || '').split(',')
        ]
            .map((value) => value?.trim().toLowerCase())
            .filter(Boolean);
        const isAdminEmail = Boolean(email && adminAccessEmails.includes(email.toLowerCase()));

        // 運営者権限は契約プランとは別の概念として維持する。
        if (isAdminEmail && accessRole !== 'admin') {
            accessRole = 'admin';
            await clerk.users.updateUserMetadata(userId, {
                publicMetadata: {
                    ...user.publicMetadata,
                    role: accessRole
                }
            });
            console.log(`[user-status] restored admin access for user ${userId.slice(-8)}`);
        }

        const priceIds = subscriptionPriceIdsFromEnv(process.env);
        const cachedSubscription = metadataSubscription(user, priceIds);
        let liveSubscription = null;
        let subscriptionVerified = true;

        try {
            liveSubscription = await findRecognizedSubscription(user, priceIds);
        } catch (stripeError) {
            subscriptionVerified = false;
            console.error('[user-status] failed to verify SNS Agent24 subscription:', stripeError);
        }

        const subscription = liveSubscription || cachedSubscription;

        // Webhookが一時的に未到達でも、有効なSNS Agent24契約だけを根拠に有料権限を自己修復する。
        if (subscription?.accessEnabled && accessRole !== 'admin' && accessRole !== subscription.role) {
            accessRole = subscription.role;
        }

        if (liveSubscription) {
            const nextPrivateMetadata = {
                ...user.privateMetadata,
                stripeSubscriptionId: liveSubscription.subscription.id,
                stripeCustomerId: liveSubscription.customerId,
                stripePriceId: liveSubscription.priceId,
                stripeSubscriptionStatus: liveSubscription.status,
                stripeCurrentPeriodEnd: periodEndIso(liveSubscription.periodEnd),
                stripeCancelAtPeriodEnd: liveSubscription.cancelAtPeriodEnd,
                stripeBillingAttentionRequired: liveSubscription.status === 'past_due'
            };
            const roleNeedsUpdate = user.publicMetadata?.role !== accessRole;
            const subscriptionNeedsUpdate = [
                ['stripeSubscriptionId', liveSubscription.subscription.id],
                ['stripeCustomerId', liveSubscription.customerId],
                ['stripePriceId', liveSubscription.priceId],
                ['stripeSubscriptionStatus', liveSubscription.status],
                ['stripeCurrentPeriodEnd', periodEndIso(liveSubscription.periodEnd)],
                ['stripeCancelAtPeriodEnd', liveSubscription.cancelAtPeriodEnd],
                ['stripeBillingAttentionRequired', liveSubscription.status === 'past_due']
            ].some(([key, value]) => user.privateMetadata?.[key] !== value);

            if (roleNeedsUpdate || subscriptionNeedsUpdate) {
                await clerk.users.updateUserMetadata(userId, {
                    publicMetadata: {
                        ...user.publicMetadata,
                        role: accessRole
                    },
                    privateMetadata: nextPrivateMetadata
                });
                console.log(`[user-status] synchronized SNS Agent24 subscription for user ${userId.slice(-8)}`);
            }
        }

        const subscriptionStatus = subscription?.status
            || (subscriptionVerified ? 'none' : 'unknown');
        const subscriptionPlan = subscription?.plan
            || (subscriptionStatus === 'none' ? 'free' : 'unknown');
        const billingAttentionRequired = accessRole !== 'admin' && (liveSubscription
            ? liveSubscription.status === 'past_due'
            : (cachedSubscription?.status === 'past_due'
                || user.privateMetadata?.stripeBillingAttentionRequired === true));

        return NextResponse.json({
            isPro: ['pro', 'promax', 'admin'].includes(accessRole),
            isProMax: ['promax', 'admin'].includes(accessRole),
            billingAttentionRequired,
            billingPortalAvailable: Boolean(subscription?.recognized && subscription.customerId),
            accessRole,
            // roleは既存クライアントとの後方互換用。新UIはaccessRoleを使用する。
            role: accessRole,
            subscriptionPlan,
            subscriptionStatus,
            subscriptionCancelAtPeriodEnd: subscription?.cancelAtPeriodEnd === true,
            subscriptionCurrentPeriodEnd: periodEndIso(subscription?.periodEnd),
            subscriptionVerified,
            email
        });
    } catch (error) {
        console.error('Error fetching user status:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
