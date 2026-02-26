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
        const { interval = 'month' } = reqBody;

        const priceId = interval === 'year'
            ? process.env.STRIPE_PRICE_ID_YEARLY
            : (process.env.STRIPE_PRICE_ID_MONTHLY || process.env.STRIPE_PRICE_ID);

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
            cancel_url: `${origin}/`,
            customer_email: user.emailAddresses[0].emailAddress,
            metadata: {
                userId: userId,
            },
            subscription_data: {
                metadata: {
                    userId: userId,
                },
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error("[STRIPE_ERROR]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
