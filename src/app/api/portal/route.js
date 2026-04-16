import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { auth, currentUser, clerkClient } from '@clerk/nextjs/server';

export async function POST(req) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Get user's Stripe Customer ID from Clerk metadata
        const user = await currentUser();
        const stripeCustomerId = user.privateMetadata.stripeCustomerId;

        const reqUrl = new URL(req.url);
        const origin = reqUrl.origin;

        if (!stripeCustomerId) {
            // ローカル開発中のWebhook未到達などで「Stripe顧客IDがないのにProになっている」エラー状態（Ghost Pro）の場合の自己修復
            console.log("No Stripe Customer ID found. Auto-healing ghost pro user.");
            const clerk = clerkClient();
            await clerk.users.updateUserMetadata(userId, {
                publicMetadata: { role: null }
            });
            // 課金プラン画面にリダイレクト
            return NextResponse.json({ url: `${origin}/app#pricing` });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${origin}/app`,
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error("[STRIPE_PORTAL_ERROR]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
