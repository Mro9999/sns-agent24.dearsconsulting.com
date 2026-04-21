import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const dynamic = "force-dynamic";

// 承認画面用API
// GET: 現在ユーザーのpending_approval投稿一覧を返す
// POST: 承認(queued化)または却下(skipped化)
export async function GET(req) {
    try {
        const { userId } = await auth();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });

        const { data, error } = await supabase
            .from('scheduled_posts')
            .select('id, platform, caption, image_urls, scheduled_at, overlay_copy, carousel_slides, product_context')
            .eq('user_id', userId)
            .eq('status', 'pending_approval')
            .order('scheduled_at', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ posts: data || [] });
    } catch (error) {
        console.error('[batch-approve] GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { userId } = await auth();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });

        const body = await req.json();
        const { action, id, image_urls } = body;

        if (!id || !action) {
            return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        }

        // まず所有者チェック（user_id === userId）
        const { data: existing, error: fetchErr } = await supabase
            .from('scheduled_posts')
            .select('user_id, status')
            .eq('id', id)
            .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!existing) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        if (existing.user_id !== userId) {
            return new NextResponse('Forbidden', { status: 403 });
        }
        if (existing.status !== 'pending_approval') {
            return NextResponse.json({ error: 'Already processed' }, { status: 400 });
        }

        if (action === 'approve') {
            const updates = { status: 'queued' };
            if (Array.isArray(image_urls) && image_urls.length > 0) {
                updates.image_urls = image_urls;
            }

            const { error: upErr } = await supabase
                .from('scheduled_posts')
                .update(updates)
                .eq('id', id);
            if (upErr) throw upErr;

            return NextResponse.json({ success: true, status: 'queued' });
        }

        if (action === 'reject') {
            const { error: upErr } = await supabase
                .from('scheduled_posts')
                .update({ status: 'skipped', published_at: new Date().toISOString() })
                .eq('id', id);
            if (upErr) throw upErr;

            return NextResponse.json({ success: true, status: 'skipped' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('[batch-approve] POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
