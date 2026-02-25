import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { clerkClient } from "@clerk/nextjs/server";

export async function POST(req) {
    const body = await req.text();
    const signature = headers().get("Stripe-Signature"); // await headers() if Next 15? No, kept simple.

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

    const session = event.data.object;

    if (event.type === "checkout.session.completed") {
        const subscription = await stripe.subscriptions.retrieve(
            session.subscription
        );

        if (!session?.metadata?.userId) {
            return new NextResponse("User ID is missing in session metadata", { status: 400 });
        }

        await clerkClient.users.updateUserMetadata(session.metadata.userId, {
            privateMetadata: {
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: subscription.customer,
                stripePriceId: subscription.items.data[0].price.id,
                stripeCurrentPeriodEnd: new Date(
                    subscription.current_period_end * 1000
                ),
            },
        });
    }

    if (event.type === "customer.subscription.deleted") {
        // Find user by stripeSubscriptionId or customerId
        // We know subscription ID from event
        const subscriptionId = session.id;

        // Clerk API doesn't support search by metadata easily efficiently without listing?
        // But we added userId to metadata in checkout!
        // Wait, 'customer.subscription.deleted' event object is Subscription, not Session.
        // Subscription metadata might have userId if we added it?
        // We added metadata to subscription_data in checkout!

        const userId = session.metadata.userId;

        if (userId) {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: {
                    stripeSubscriptionId: null,
                    stripePriceId: null,
                    stripeCurrentPeriodEnd: null,
                },
            });
        }
    }

    return new NextResponse(null, { status: 200 });
}
