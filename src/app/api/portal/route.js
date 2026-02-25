import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { auth, currentUser } from '@clerk/nextjs/server';

export async function POST(req) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Get user's Stripe Customer ID from Clerk metadata
        const user = await currentUser();
        const stripeCustomerId = user.privateMetadata.stripeCustomerId;

        if (!stripeCustomerId) {
            return new NextResponse("No Stripe Customer ID found", { status: 404 });
        }

        const reqUrl = new URL(req.url);
        const origin = reqUrl.origin;

        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${origin}/`,
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error("[STRIPE_PORTAL_ERROR]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
