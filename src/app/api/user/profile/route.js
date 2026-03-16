import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const { userId } = auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        
        const body = await req.json();
        const { industry, targetAudience, usp } = body;

        // Clerk v5 API: clerkClient() returns the client instance
        await clerkClient().users.updateUserMetadata(userId, {
            publicMetadata: {
                industry,
                targetAudience,
                usp,
                profileSetupCompleted: true
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating user profile:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
