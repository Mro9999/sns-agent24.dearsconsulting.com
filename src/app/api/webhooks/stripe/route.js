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
            publicMetadata: {
                role: 'pro'
            }
        });

        // スプレッドシート側の「有料プラン登録日時(E列)」をアップデート
        if (process.env.GOOGLE_SCRIPT_URL) {
            try {
                const date = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
                const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'update',
                        userId: session.metadata.userId,
                        date: date
                    })
                });
                if (!response.ok) console.error('Failed to update Google Sheets (Stripe):', await response.text());
            } catch (error) {
                console.error('Error updating Google Sheets from Stripe webhook:', error);
            }
        }
    }

    if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;

        if (userId) {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: {
                    stripeSubscriptionId: null,
                    stripePriceId: null,
                    stripeCurrentPeriodEnd: null,
                },
                publicMetadata: {
                    role: null
                }
            });
        }
    }

    return new NextResponse(null, { status: 200 });
}
