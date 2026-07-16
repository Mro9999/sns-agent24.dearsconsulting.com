import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { authorizeCronRequest } from '@/lib/server/cronAuth';

export const dynamic = "force-dynamic";

// 自動承認 Cron
// 毎日 11:50 JST (= 02:50 UTC) に実行
// 予約時刻(12:00 JST = 03:00 UTC)が10分以内に迫っていて、まだ pending_approval の投稿は
// 自動的に queued に切り替えて、Make.com 側のポーリングで投稿される状態にする。
// ※ この時点では overlay_copy の再合成は行わない（画像はオーバーレイ無しのAI生素画像のまま投稿）
//   これは、ユーザーが期限内に承認できなかった場合の最終バックアップ。

export async function GET(req) {
    try {
        const authError = authorizeCronRequest(req);
        if (authError) return authError;

        // 予約時刻が「今から30分以内」に来る、かつ pending_approval な投稿を取得
        const cutoff = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        const { data: targets, error: fetchErr } = await supabase
            .from('scheduled_posts')
            .select('id')
            .eq('status', 'pending_approval')
            .lte('scheduled_at', cutoff);

        if (fetchErr) throw fetchErr;

        if (!targets || targets.length === 0) {
            return NextResponse.json({
                message: 'No pending approvals to auto-approve',
                timestamp: new Date().toISOString()
            });
        }

        const ids = targets.map(t => t.id);

        const { error: upErr } = await supabase
            .from('scheduled_posts')
            .update({ status: 'queued' })
            .in('id', ids);

        if (upErr) throw upErr;

        console.log(`[auto-approve] ${ids.length}件を自動承認（queued化）`);

        return NextResponse.json({
            success: true,
            auto_approved: ids.length,
            ids
        });
    } catch (error) {
        console.error('[auto-approve] error:', error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}
