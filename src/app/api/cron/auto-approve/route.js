import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { authorizeCronRequest } from '@/lib/server/cronAuth';
import { approvalIssue, matchPostSnapshot } from '@/lib/postSafety.mjs';
import { verifyPostImages } from '@/lib/server/postImageSafety.mjs';

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 自動承認 Cron
// 毎日 11:50 JST (= 02:50 UTC) に実行
// 予約時刻(12:00 JST = 03:00 UTC)が10分以内に迫っていて、まだ pending_approval の投稿は
// 自動的に queued に切り替えて、Make.com 側のポーリングで投稿される状態にする。
// 保存された合成済み画像を検証する。過去日時・不完全な画像は承認しない。
// この変更はcronの有効化や外部スケジューラの再開を行わない。

export async function GET(req) {
    try {
        const authError = authorizeCronRequest(req);
        if (authError) return authError;

        // 予約時刻が「今から30分以内」に来る、かつ pending_approval な投稿を取得
        const cutoff = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        const { data: targets, error: fetchErr } = await supabase
            .from('scheduled_posts')
            .select('*')
            .eq('status', 'pending_approval')
            .gt('scheduled_at', new Date().toISOString())
            .lte('scheduled_at', cutoff)
            .order('scheduled_at', { ascending: true })
            .limit(10);

        if (fetchErr) throw fetchErr;

        if (!targets || targets.length === 0) {
            return NextResponse.json({
                message: 'No pending approvals to auto-approve',
                timestamp: new Date().toISOString()
            });
        }

        const ids = [];
        const blocked = [];
        for (const post of targets) {
            const issue = approvalIssue(post);
            const validation = issue ? { ok: false, error: issue } : await verifyPostImages(post);
            if (!validation.ok) {
                blocked.push({ id: post.id, error: validation.error });
                continue;
            }
            const { data: updated, error: upErr } = await matchPostSnapshot(
                supabase.from('scheduled_posts').update({ status: 'queued' }), post
            ).gt('scheduled_at', new Date().toISOString()).select('id').maybeSingle();
            if (upErr) throw upErr;
            if (updated) ids.push(updated.id);
            else blocked.push({ id: post.id, error: '投稿が変更されたか予定時刻を過ぎました' });
        }

        console.log(`[auto-approve] ${ids.length}件を自動承認（queued化）`);

        return NextResponse.json({
            success: blocked.length === 0,
            auto_approved: ids.length,
            ids,
            blocked
        });
    } catch (error) {
        console.error('[auto-approve] error:', error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}
