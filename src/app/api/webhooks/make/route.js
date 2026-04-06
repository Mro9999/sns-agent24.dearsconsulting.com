import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function POST(req) {
    try {
        const { userId } = auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await clerkClient().users.getUser(userId);
        const role = user.publicMetadata?.role;
        const isAdmin = role === 'admin';
        const isProMax = role === 'promax' || isAdmin;

        if (!isProMax) {
            return new NextResponse("Forbidden - Pro Max Plan required", { status: 403 });
        }

        const reqBody = await req.json().catch(() => null);
        if (!reqBody) {
            return new NextResponse("Invalid Request Body", { status: 400 });
        }

        const webhookUrl = process.env.MAKE_WEBHOOK_URL;
        if (!webhookUrl) {
            // Webhookが設定されていない場合はモックとして成功を返す（エラーで落とさない）
            console.log("[Make.com] Webhook URL is not configured. Mocking success.");
            return NextResponse.json({ success: true, mocked: true });
        }

        const { platform, posts, category, purpose } = reqBody;

        // Payload for Make.com
        const payload = {
            userId,
            email: user.emailAddresses[0]?.emailAddress,
            platform,
            category,
            purpose,
            timestamp: new Date().toISOString(),
            posts: posts // Array of { caption, image_urls }
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[Make.com] Forwarding failed:", errorText);
            return new NextResponse("Failed to forward to Make.com", { status: 502 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Make.com] Webhook Route Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
