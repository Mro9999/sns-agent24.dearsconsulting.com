import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import {
    resolveSubscriptionAccess,
    subscriptionPriceIdsFromEnv
} from '@/lib/subscriptionAccess.mjs';

async function findPaidSubscription(user) {
    const priceIds = subscriptionPriceIdsFromEnv(process.env);
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
            const access = resolveSubscriptionAccess(subscription, priceIds);
            if (!access.recognized || !access.accessEnabled) continue;

            matches.push({
                customerId,
                priceId: access.priceId,
                role: access.role,
                subscription,
                periodEnd: access.periodEnd,
                status: access.status
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
        let billingAttentionRequired = user.privateMetadata?.stripeBillingAttentionRequired === true;
        let billingPortalAvailable = Boolean(user.privateMetadata?.stripeCustomerId);
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
                    billingAttentionRequired = paidSubscription.status === 'past_due';
                    billingPortalAvailable = true;
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
                            stripeSubscriptionStatus: paidSubscription.status,
                            stripeCurrentPeriodEnd: periodEnd,
                            stripeBillingAttentionRequired: paidSubscription.status === 'past_due'
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
            billingAttentionRequired: role !== 'admin' && billingAttentionRequired,
            billingPortalAvailable,
            role: role,
            email: email
        });
    } catch (error) {
        console.error("Error fetching user status:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
