import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { clerkClient } from "@clerk/nextjs/server";
import {
    resolveSubscriptionAccess,
    subscriptionPriceIdsFromEnv
} from "@/lib/subscriptionAccess.mjs";

const SUBSCRIPTION_EVENTS = new Set([
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "customer.subscription.resumed"
]);

const INVOICE_EVENTS = new Set([
    "invoice.paid",
    "invoice.payment_succeeded",
    "invoice.payment_failed"
]);

function stripeObjectId(value) {
    return typeof value === "string" ? value : value?.id;
}

function periodEndIso(periodEnd) {
    return periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
}

async function synchronizeSubscriptionAccess(
    subscription,
    clerk,
    { billingAttentionRequired, fallbackUserId = null } = {}
) {
    const userId = subscription.metadata?.userId || fallbackUserId;
    if (!userId) {
        console.warn(`[stripe-webhook] ignored ${subscription.id}: Clerk userId is missing`);
        return { ignored: true, reason: "missing_user_id" };
    }

    const access = resolveSubscriptionAccess(
        subscription,
        subscriptionPriceIdsFromEnv(process.env)
    );

    // 同じStripeアカウント内の別商品ではSNS Agent24の権限を変更しない。
    if (!access.recognized) {
        console.warn(`[stripe-webhook] ignored ${subscription.id}: unrecognized price ${access.priceId || "none"}`);
        return { ignored: true, reason: "unrecognized_price", userId };
    }

    const user = await clerk.users.getUser(userId);
    const savedSubscriptionId = user.privateMetadata?.stripeSubscriptionId;
    const currentRole = user.publicMetadata?.role;

    // 古い契約の終了イベントが、より新しい有効契約の権限を落とさないようにする。
    if (
        !access.accessEnabled &&
        savedSubscriptionId &&
        savedSubscriptionId !== subscription.id &&
        ["pro", "promax", "admin"].includes(currentRole)
    ) {
        console.warn(`[stripe-webhook] ignored stale inactive subscription ${subscription.id}`);
        return { ignored: true, reason: "stale_inactive_subscription", userId };
    }

    const nextRole = currentRole === "admin" ? "admin" : access.role;
    await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
            ...user.publicMetadata,
            role: nextRole
        },
        privateMetadata: {
            ...user.privateMetadata,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: stripeObjectId(subscription.customer) || null,
            stripePriceId: access.priceId,
            stripeSubscriptionStatus: access.status,
            stripeCurrentPeriodEnd: periodEndIso(access.periodEnd),
            stripeCancelAtPeriodEnd: access.cancelAtPeriodEnd,
            stripeBillingAttentionRequired:
                billingAttentionRequired ?? access.status === "past_due"
        }
    });

    console.log(
        `[stripe-webhook] synchronized user ${userId.slice(-8)}: ${access.status} -> ${nextRole || "free"}`
    );
    return { ...access, ignored: false, role: nextRole, userId };
}

async function retrieveSubscription(subscription) {
    const subscriptionId = stripeObjectId(subscription);
    if (!subscriptionId) return null;
    return stripe.subscriptions.retrieve(subscriptionId);
}

export async function POST(req) {
    const body = await req.text();
    const signature = (await headers()).get("Stripe-Signature");

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
    }

    const clerk = await clerkClient();

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const subscription = await retrieveSubscription(session.subscription);
        if (!subscription) {
            console.warn(`[stripe-webhook] ignored checkout ${session.id}: subscription is missing`);
            return new NextResponse(null, { status: 200 });
        }

        const access = await synchronizeSubscriptionAccess(
            subscription,
            clerk,
            { fallbackUserId: session.metadata?.userId }
        );
        if (access.ignored) {
            return new NextResponse(null, { status: 200 });
        }

        // スプレッドシート側の「有料プラン登録日時(E列)」をアップデート
        if (process.env.GOOGLE_SCRIPT_URL) {
            try {
                const date = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
                const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'update',
                        userId: access.userId,
                        date: date
                    })
                });
                if (!response.ok) console.error('Failed to update Google Sheets (Stripe):', await response.text());
            } catch (error) {
                console.error('Error updating Google Sheets from Stripe webhook:', error);
            }
        }

        // 管理者へ課金通知メール自動送信 (scuderia.ct@gmail.com宛)
        if (process.env.SENDGRID_API_KEY) {
            try {
                const adminEmail = 'scuderia.ct@gmail.com';
                const customerEmail = session.customer_details?.email || '不明';
                const customerName = session.customer_details?.name || '不明';
                const amount = session.amount_total ? `¥${session.amount_total.toLocaleString()}` : '不明';

                const planName = access.role === 'promax' ? 'Pro Maxプラン' : 'Proプラン';
                const emailContent = `SNS Agent24で${planName}の新規サブスクリプション契約が完了しました。\n\nお名前: ${customerName}\nメールアドレス: ${customerEmail}\n決済金額: ${amount}\nユーザーID (Clerk): ${access.userId}\nStripe顧客ID: ${stripeObjectId(subscription.customer)}\n契約日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;

                const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        personalizations: [{ to: [{ email: adminEmail }] }],
                        from: { email: 'notifications@dearsconsulting.com', name: 'SNS Agent24 通知システム' },
                        subject: `【${planName}登録完了】${customerName} 様がサブスク契約しました`,
                        content: [{ type: 'text/plain', value: emailContent }]
                    })
                });

                if (response.ok) {
                    console.log('Successfully sent subscription notification email to Admin.');
                } else {
                    console.error('Failed to send subscription notification to Admin:', await response.text());
                }
            } catch (error) {
                console.error('Error sending admin notification (checkout.session.completed):', error);
            }
        }
    }

    if (SUBSCRIPTION_EVENTS.has(event.type)) {
        const subscription = event.data.object;
        await synchronizeSubscriptionAccess(subscription, clerk);
    }

    if (INVOICE_EVENTS.has(event.type)) {
        const invoice = event.data.object;
        const subscriptionReference = invoice.subscription
            || invoice.parent?.subscription_details?.subscription;
        const subscription = await retrieveSubscription(subscriptionReference);
        if (subscription) {
            await synchronizeSubscriptionAccess(subscription, clerk, {
                billingAttentionRequired: event.type === "invoice.payment_failed"
            });
        }
    }

    return new NextResponse(null, { status: 200 });
}
