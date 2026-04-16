import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        
        // bypass JWT cache and fetch directly from Clerk DB
        const user = await clerkClient().users.getUser(userId);
        const role = user.publicMetadata?.role;
        const email = user.emailAddresses[0]?.emailAddress;

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
