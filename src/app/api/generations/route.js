import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { auth } from '@clerk/nextjs/server';

// 新規生成履歴の保存（POST）
export async function POST(req) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) {
            console.error("Supabase Admin client is not configured.");
            return new NextResponse("Database configuration error", { status: 500 });
        }

        const body = await req.json();
        const { platform, caption, imageUrls } = body;

        if (!platform) {
            return new NextResponse("Platform is required", { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('generations')
            .insert([
                { user_id: userId, platform, caption, image_urls: imageUrls || [] }
            ])
            .select()
            .single();

        if (error) {
            console.error("Supabase Insert Error:", error);
            return new NextResponse("Database error", { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error saving generation:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// 過去の生成履歴の取得（GET）
export async function GET(req) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) {
            console.error("Supabase Admin client is not configured.");
            return new NextResponse("Database configuration error", { status: 500 });
        }

        // 該当ユーザーの履歴を作成日時の降順（最新順）で最大50件取得
        const { data, error } = await supabaseAdmin
            .from('generations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error("Supabase Select Error:", error);
            return new NextResponse("Database error", { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error) {
        console.error("Error fetching generations:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
