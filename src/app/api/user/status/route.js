import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

const PAID_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);

function roleForPrice(priceId) {
    if (!priceId) return null;

    if (
        priceId === process.env.STRIPE_PRICE_ID_PROMAX_MONTHLY ||
        priceId === process.env.STRIPE_PRICE_ID_PROMAX_YEARLY
    ) {
        return 'promax';
    }

    if (
        priceId === process.env.STRIPE_PRICE_ID_MONTHLY ||
        priceId === process.env.STRIPE_PRICE_ID_YEARLY ||
        priceId === process.env.STRIPE_PRICE_ID
    ) {
        return 'pro';
    }

    return null;
}

function subscriptionPeriodEnd(subscription) {
    const itemPeriodEnds = subscription.items?.data
        ?.map((item) => item.current_period_end)
        .filter(Boolean) || [];

    return subscription.current_period_end || Math.max(0, ...itemPeriodEnds);
}

async function findPaidSubscription(user) {
    const customerIds = new Set();
    const savedCustomerId = user.privateMetadata?.stripeCustomerId;
    if (savedCustomerId) customerIds.add(savedCustomerId);

    const email = user.emailAddresses?.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress
        || user.emailAddresses?.[0]?.emailAddress;

    if (email) {
        const customers = await stripe.customers.list({ email, limit: 10 });
        customers.data.forEach((customer) => customerIds.add(customer.id));
    }

    const matches = [];
    for (const customerId of customerIds) {
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'all',
            limit: 20
        });

        for (const subscription of subscriptions.data) {
            if (!PAID_SUBSCRIPTION_STATUSES.has(subscription.status)) continue;

            const priceId = subscription.items?.data?.[0]?.price?.id;
            const role = roleForPrice(priceId);
            if (!role) continue;

            matches.push({
                customerId,
                priceId,
                role,
                subscription,
                periodEnd: subscriptionPeriodEnd(subscription)
            });
        }
    }

    return matches.sort((a, b) => b.periodEnd - a.periodEnd)[0] || null;
}

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        
        // bypass JWT cache and fetch directly from Clerk DB
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);
        let role = user.publicMetadata?.role;
        const email = user.emailAddresses[0]?.emailAddress;
        const adminAccessEmails = [
            process.env.ADMIN_EMAIL,
            ...(process.env.ADMIN_ACCESS_EMAILS || '').split(',')
        ]
            .map((value) => value?.trim().toLowerCase())
            .filter(Boolean);
        const isAdminEmail = Boolean(email && adminAccessEmails.includes(email.toLowerCase()));

        // 運営者アカウントはStripe契約の有無にかかわらず全機能へアクセスできる。
        // Clerk metadataが消えた場合も、サーバー側の管理者メールを正として自己修復する。
        if (isAdminEmail && role !== 'admin') {
            role = 'admin';
            await clerk.users.updateUserMetadata(userId, {
                publicMetadata: {
                    ...user.publicMetadata,
                    role
                }
            });
            console.log(`[user-status] restored admin access for user ${userId.slice(-8)}`);
        }

        // Stripe Webhookが一時的に未到達でも、契約中のユーザーをFree扱いにしない。
        // Clerkに有料roleがない時だけStripeを照合し、以後のアクセス用にmetadataを自己修復する。
        if (!['pro', 'promax', 'admin'].includes(role)) {
            try {
                const paidSubscription = await findPaidSubscription(user);
                if (paidSubscription) {
                    role = paidSubscription.role;
                    const periodEnd = paidSubscription.periodEnd
                        ? new Date(paidSubscription.periodEnd * 1000).toISOString()
                        : null;

                    await clerk.users.updateUserMetadata(userId, {
                        publicMetadata: {
                            ...user.publicMetadata,
                            role
                        },
                        privateMetadata: {
                            ...user.privateMetadata,
                            stripeSubscriptionId: paidSubscription.subscription.id,
                            stripeCustomerId: paidSubscription.customerId,
                            stripePriceId: paidSubscription.priceId,
                            stripeCurrentPeriodEnd: periodEnd
                        }
                    });
                    console.log(`[user-status] restored paid access for user ${userId.slice(-8)} as ${role}`);
                }
            } catch (stripeError) {
                // Stripe照合が一時的に失敗しても、ログインや画面表示自体は止めない。
                console.error('[user-status] failed to reconcile Stripe subscription:', stripeError);
            }
        }

        return NextResponse.json({ 
            isPro: role === 'pro' || role === 'promax' || role === 'admin',
            isProMax: role === 'promax' || role === 'admin',
            role: role,
            email: email
        });
    } catch (error) {
        console.error("Error fetching user status:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
