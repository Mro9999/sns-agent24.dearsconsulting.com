import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { approvalIssue, isFuturePost, matchPostSnapshot, reviewedPostMatches } from '@/lib/postSafety.mjs';
import { verifyPostImages } from '@/lib/server/postImageSafety.mjs';

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

        const now = Date.now();
        return NextResponse.json({
            posts: (data || []).filter(post => isFuturePost(post, now)),
            expiredPosts: (data || []).filter(post => !isFuturePost(post, now)).map(post => ({
                id: post.id, scheduled_at: post.scheduled_at, caption: post.caption
            }))
        });
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
        const { action, id, image_urls, reviewedPost } = body;

        if (!id || !action) {
            return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        }

        // まず所有者チェック（user_id === userId）
        const { data: existing, error: fetchErr } = await supabase
            .from('scheduled_posts')
            .select('*')
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
            const issue = approvalIssue(existing);
            if (issue) return NextResponse.json({ error: issue }, { status: 422 });
            if (!reviewedPostMatches(existing, reviewedPost)) {
                return NextResponse.json({ error: '確認した投稿と保存内容が一致しません。ページを更新してから、もう一度内容をご確認ください。' }, { status: 409 });
            }
            if (image_urls !== undefined && JSON.stringify(image_urls) !== JSON.stringify(existing.image_urls)) {
                return NextResponse.json({ error: '画像が更新されています。画面を更新して再度ご確認ください。' }, { status: 409 });
            }
            const validation = await verifyPostImages(existing);
            if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 422 });

            const { data: updated, error: upErr } = await matchPostSnapshot(
                supabase.from('scheduled_posts').update({ status: 'queued' }), existing
            ).gt('scheduled_at', new Date().toISOString()).select('id').maybeSingle();
            if (upErr) throw upErr;
            if (!updated) return NextResponse.json({ error: '投稿が変更されたか、予定時刻を過ぎました。画面を更新してください。' }, { status: 409 });

            return NextResponse.json({ success: true, status: 'queued' });
        }

        if (action === 'reject') {
            const { data: updated, error: upErr } = await supabase
                .from('scheduled_posts')
                .update({ status: 'skipped' })
                .eq('id', id)
                .eq('user_id', userId)
                .eq('status', 'pending_approval')
                .select('id').maybeSingle();
            if (upErr) throw upErr;
            if (!updated) return NextResponse.json({ error: '投稿はすでに処理されています。画面を更新してください。' }, { status: 409 });

            return NextResponse.json({ success: true, status: 'skipped' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('[batch-approve] POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
