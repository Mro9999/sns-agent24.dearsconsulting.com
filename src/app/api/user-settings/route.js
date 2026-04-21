import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const dynamic = "force-dynamic";

// 自動バッチ生成用のユーザー設定を保存・取得するAPI

// POST: 設定を保存（最後のバッチ生成後に自動呼び出し）
export async function POST(req) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;

        const body = await req.json();
        const {
            category_id,
            purpose_id,
            target_id,
            gender,
            business_style,
            tone,
            language,
            format,
            product_context,
            user_profile,
            enabled
        } = body;

        const record = {
            user_id: userId,
            email,
            category_id: category_id || null,
            purpose_id: purpose_id || null,
            target_id: target_id || null,
            gender: gender || null,
            business_style: business_style || null,
            tone: tone || null,
            language: language || 'ja',
            format: format || 'carousel',
            product_context: product_context || null,
            user_profile: user_profile || null,
            enabled: enabled !== undefined ? enabled : true,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('user_batch_settings')
            .upsert(record, { onConflict: 'user_id' });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('user-settings POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET: 現在ログイン中ユーザーの設定を取得
export async function GET(req) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { data, error } = await supabase
            .from('user_batch_settings')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;

        return NextResponse.json({ settings: data });
    } catch (error) {
        console.error('user-settings GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
