import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const dynamic = "force-dynamic";

// 手動バッチ生成 (Pro Max ユーザーが /app の「1週間分まとめて生成」ボタンから呼ぶ) で
// 生成された投稿群を、cron バッチと同じ status='pending_approval' + user_id 紐付け
// で scheduled_posts テーブルに保存する Clerk 認証つきエンドポイント。
//
// 旧 /api/admin/queue POST はシークレット認証で、user_id を保存せず status='queued'
// で直接投入していたため、/approve ページに出てこない & 承認スキップで投稿される
// 重大バグの原因になっていた。ここでそれを置き換える。
export async function POST(req) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Pro Max ロール判定 (cron バッチと同じ条件)
        const cc = await clerkClient();
        const user = await cc.users.getUser(userId);
        const role = user.publicMetadata?.role;
        const isAdmin = role === 'admin';
        const isProMax = role === 'promax' || isAdmin;
        if (!isProMax) {
            return new NextResponse('Forbidden - Pro Max Plan required', { status: 403 });
        }

        const body = await req.json().catch(() => null);
        if (!body || !Array.isArray(body.posts) || body.posts.length === 0) {
            return NextResponse.json({ error: '"posts" array required' }, { status: 400 });
        }

        const records = body.posts.map(p => ({
            user_id: userId,
            platform: p.platform || 'instagram',
            caption: p.caption || '',
            image_urls: Array.isArray(p.image_urls) ? p.image_urls : [],
            scheduled_at: p.scheduled_at || null,
            status: 'pending_approval', // ← cron と統一: ユーザーが /approve で承認したら queued へ昇格
            overlay_copy: p.overlay_copy || null,
            carousel_slides: p.carousel_slides || null,
            image_idea: p.image_idea || null
        }));

        const { error } = await supabase
            .from('scheduled_posts')
            .insert(records);

        if (error) {
            console.error('[batch-save] insert error:', error);
            throw error;
        }

        return NextResponse.json({ success: true, count: records.length });
    } catch (error) {
        console.error('[batch-save] POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
