import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const { userId } = auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // 強制的にadmin権限を付与する（adminはアプリ内で自動的にPro Max扱いになります）
        await clerkClient().users.updateUserMetadata(userId, {
            publicMetadata: {
                role: 'admin'
            }
        });

        return NextResponse.json({ 
            success: true, 
            message: "テスト用アカウントとして Admin(Pro Max) 権限を付与しました！画面をリロードしてください。" 
        });
    } catch (error) {
        console.error("Error setting admin role:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
