import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { auth, currentUser } from '@clerk/nextjs/server';

export async function POST(req) {
    try {
        console.log("=== /api/checkout POST HIT ===");
        const { userId } = await auth();
        console.log("userId:", userId);
        const user = await currentUser();

        if (!userId || !user) {
            console.log("Unauthorized request");
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const reqBody = await req.json().catch(() => ({}));
        const { interval = 'month', tier = 'pro' } = reqBody;
        if (!['month', 'year'].includes(interval) || tier !== 'pro') {
            return NextResponse.json({ error: 'Unsupported plan selection' }, { status: 400 });
        }

        let priceId;
        priceId = interval === 'year'
            ? process.env.STRIPE_PRICE_ID_YEARLY
            : (process.env.STRIPE_PRICE_ID_MONTHLY || process.env.STRIPE_PRICE_ID);

        if (!priceId) {
            console.error("Missing Stripe Price ID for tier:", tier, "interval:", interval);
            return new NextResponse("Server Configuration Error", { status: 500 });
        }

        const reqUrl = new URL(req.url);
        const origin = reqUrl.origin;

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/app`,
            customer_email: user.emailAddresses[0]?.emailAddress,
            metadata: {
                userId: userId,
                planTier: tier
            },
            subscription_data: {
                metadata: {
                    userId: userId,
                    planTier: tier
                },
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error("[STRIPE_ERROR]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
