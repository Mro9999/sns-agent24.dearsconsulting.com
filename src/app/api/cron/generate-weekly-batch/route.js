import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { generateWeeklyPostsForSettings } from '@/lib/weeklyBatchGenerator';
import { authorizeCronRequest } from '@/lib/server/cronAuth';

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel Hobby の最大5分
// 注: 画像生成はこのcronでは行わない（Vercel Hobbyのタイムアウト対策）
// 画像は /approve ページを開いた時に /api/generate-post-image で各投稿ごとに生成される

// 週次の自動コンテンツ生成Cron
// 毎週日曜日 20:00 JST (= 11:00 UTC) に実行される
// enabled なユーザーごとに1週間分(7件)のInstagram投稿案を生成し、
// pending_approval 状態で保存。ユーザーへは承認リンクをメール通知する。

export async function GET(req) {
    try {
        const authError = authorizeCronRequest(req);
        if (authError) return authError;

        console.log('[generate-weekly-batch] 開始');

        // 有効なユーザー一覧を取得
        const { data: users, error: fetchError } = await supabase
            .from('user_batch_settings')
            .select('*')
            .eq('enabled', true);

        if (fetchError) throw fetchError;

        if (!users || users.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No enabled users found',
                users_processed: 0
            });
        }

        console.log(`[generate-weekly-batch] ${users.length}ユーザーを処理`);

        const summary = [];
        for (const u of users) {
            try {
                const count = await generateWeeklyPostsForSettings(u, {
                    sendEmail: true,
                    logPrefix: '[generate-weekly-batch]'
                });
                summary.push({ user_id: u.user_id, email: u.email, generated: count });
            } catch (userErr) {
                console.error(`[generate-weekly-batch] ${u.user_id} 処理失敗:`, userErr);
                summary.push({ user_id: u.user_id, email: u.email, error: userErr.message });
            }
        }

        return NextResponse.json({
            success: true,
            users_processed: users.length,
            summary
        });

    } catch (error) {
        console.error('[generate-weekly-batch] 致命的エラー:', error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}
