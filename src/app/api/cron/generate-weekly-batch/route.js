import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { researchTrends, generatePost, generateImage } from '@/lib/apiService';
import { VISUAL_VARIETY_DIRECTIVES, SUBJECT_VARIETY_DIRECTIVES } from '@/lib/canvasHelper';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5分以内で完了させる想定（Vercel Hobbyは最大5分）

// 週次の自動コンテンツ生成Cron
// 毎週日曜日 20:00 JST (= 11:00 UTC) に実行される
// enabled なユーザーごとに1週間分(7件)のInstagram投稿案を生成し、
// pending_approval 状態で保存。ユーザーへは承認リンクをメール通知する。

const APP_BASE_URL = 'https://sns-agent24.dearsconsulting.com';

// バッチ生成用の切り口（マンネリ防止）
const VARIETY_ANGLES = [
    "ノウハウ提供・独自のナレッジ",
    "業界の失敗談やよくある間違い",
    "お客様のリアルな悩み解決",
    "業界の裏側・最新トレンド考察",
    "代表のマインドセット・想い",
    "自社のこだわり・他社との明確な違い",
    "よくある質問(FAQ)への専門的な回答"
];

async function sendApprovalEmail(email, pendingCount) {
    if (!process.env.SENDGRID_API_KEY || !email) {
        console.warn('[generate-weekly-batch] SendGrid未設定またはemail無しでメール通知スキップ');
        return;
    }

    const approvalUrl = `${APP_BASE_URL}/approve`;
    const html = `
<!doctype html>
<html lang="ja">
<body style="font-family: system-ui, sans-serif; background: #0f0f14; color: #fff; padding: 32px 16px;">
  <div style="max-width: 560px; margin: 0 auto; background: #1a1a22; padding: 32px; border-radius: 12px;">
    <h1 style="font-size: 22px; margin: 0 0 16px;">🤖 今週の投稿案ができました</h1>
    <p style="color: #d0d0dd; line-height: 1.7;">
      SNS Agent 24 があなたの事業プロフィールに基づいて、Instagram 1週間分の投稿案（${pendingCount}件）を自動生成しました。<br>
      以下のリンクから内容をご確認いただき、承認してください。
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${approvalUrl}" style="background: linear-gradient(90deg, #8b5cf6, #ec4899); color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
        投稿を確認・承認する
      </a>
    </div>
    <div style="background: #0f0f14; padding: 16px; border-radius: 8px; border-left: 3px solid #ec4899; margin-top: 16px;">
      <p style="font-size: 13px; color: #aaa; margin: 0; line-height: 1.6;">
        <strong style="color: #fff;">承認期限について</strong><br>
        各投稿の予約時刻（12:00 JST）までに承認されなかった投稿は、自動的に承認扱いとなり投稿されます。<br>
        不要な投稿がある場合は、期限前に却下してください。
      </p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: { email: 'notifications@dearsconsulting.com', name: 'SNS Agent 24' },
            subject: '【SNS Agent 24】今週の投稿案を確認してください 📝',
            content: [{ type: 'text/html', value: html }]
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error('[generate-weekly-batch] SendGrid error:', errText);
    }
}

async function generateForUser(settings) {
    const {
        user_id,
        email,
        category_id,
        purpose_id,
        target_id,
        gender,
        business_style,
        tone,
        language,
        format,
        product_context,
        user_profile
    } = settings;

    // 旧IDから表示用ラベルを引くのは難しいので、保存済みのIDをそのままAIへ渡す
    // (apiServiceはcategory/purposeオブジェクトを期待するので最低限の互換オブジェクトを作る)
    const category = category_id ? { id: category_id, label: category_id } : { id: 'other', label: 'ビジネス全般' };
    const target = target_id ? { id: target_id, label: target_id } : { id: 'general', label: '一般' };
    const targetLabel = target.label;
    const platformType = 'instagram';
    const selectedFormat = format || 'carousel';
    const cleanProductContext = product_context || {};
    const userProfile = user_profile || {};

    // トレンドリサーチ1回
    const research = await researchTrends(
        category,
        targetLabel,
        gender,
        business_style,
        platformType,
        cleanProductContext?.location,
        cleanProductContext?.siteContent || '',
        userProfile
    );

    if (!research) {
        throw new Error('トレンドリサーチ失敗');
    }

    const results = [];
    const count = 7;

    for (let i = 0; i < count; i++) {
        try {
            const angle = VARIETY_ANGLES[i % VARIETY_ANGLES.length];
            const purposeSeed = `${purpose_id || '指定なし'}。\n【重要指示：今回の投稿テーマ切り口】：『${angle}』を軸として、毎回異なる角度・視点で語ってください。`;

            const post = await generatePost(
                research,
                platformType,
                category,
                targetLabel,
                gender,
                business_style,
                tone,
                language || 'ja',
                cleanProductContext,
                cleanProductContext?.siteContent || '',
                selectedFormat === 'carousel' ? 'carousel' : 'single',
                userProfile,
                purposeSeed
            );

            if (!post) continue;

            let imageUrls = [];
            if (post.image_idea && post.image_idea !== 'なし' && selectedFormat !== 'video_script') {
                const isCarousel = selectedFormat === 'carousel';
                const imgCount = isCarousel ? 3 : 1;

                // 多様性注入
                const visualTone = VISUAL_VARIETY_DIRECTIVES[i % VISUAL_VARIETY_DIRECTIVES.length];
                const subjectAngle = SUBJECT_VARIETY_DIRECTIVES[i % SUBJECT_VARIETY_DIRECTIVES.length];
                const variedImageIdea = `${post.image_idea}\n【ビジュアルトーン指示】${visualTone}\n【構図・被写体指示】${subjectAngle}`;

                try {
                    const imgRes = await generateImage(
                        category,
                        targetLabel,
                        gender,
                        variedImageIdea,
                        cleanProductContext,
                        platformType,
                        null,
                        imgCount
                    );
                    if (imgRes && !imgRes.error && Array.isArray(imgRes)) {
                        // 注: ここではオーバーレイ合成しない（ブラウザ側で承認時に合成）
                        imageUrls = imgRes.filter(Boolean);
                    }
                } catch (imgErr) {
                    console.error(`[generate-weekly-batch] ${user_id} 画像生成失敗(${i + 1}件目):`, imgErr);
                }
            }

            let finalCaption = post.caption || post.overlay_copy || '';
            if (post.hashtags && Array.isArray(post.hashtags)) {
                finalCaption += '\n\n' + post.hashtags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ');
            }

            // 予約時刻: 明日以降、1日1件、12:00 JST
            const schedDate = new Date();
            schedDate.setDate(schedDate.getDate() + 1 + i);
            schedDate.setHours(12, 0, 0, 0);

            // 承認用にoverlay_copy / carousel_slides もDBに保持しておく
            results.push({
                user_id,
                platform: platformType,
                caption: finalCaption,
                image_urls: imageUrls,
                scheduled_at: schedDate.toISOString(),
                status: 'pending_approval',
                overlay_copy: post.overlay_copy || null,
                carousel_slides: post.carousel_slides || null,
                raw_post: post  // 完全なpost情報も保持（承認時のオーバーレイレンダリング用）
            });

            // API rate limit対策
            await new Promise(r => setTimeout(r, 6000));
        } catch (loopErr) {
            console.error(`[generate-weekly-batch] ${user_id} ${i + 1}件目でエラー:`, loopErr);
            continue;
        }
    }

    if (results.length === 0) return 0;

    // DBに保存（scheduled_posts への挿入）
    // overlay_copy / carousel_slides は承認時のオーバーレイ合成用に残す
    const insertRecords = results.map(r => ({
        user_id: r.user_id,
        platform: r.platform,
        caption: r.caption,
        image_urls: r.image_urls,
        scheduled_at: r.scheduled_at,
        status: r.status,
        overlay_copy: r.overlay_copy,
        carousel_slides: r.carousel_slides,
        product_context: cleanProductContext
    }));

    const { error } = await supabase
        .from('scheduled_posts')
        .insert(insertRecords);

    if (error) {
        console.error(`[generate-weekly-batch] ${user_id} DB挿入エラー:`, error);
        return 0;
    }

    // メール通知
    try {
        await sendApprovalEmail(email, results.length);
    } catch (mailErr) {
        console.error(`[generate-weekly-batch] ${user_id} メール送信失敗:`, mailErr);
    }

    return results.length;
}

export async function GET(req) {
    try {
        // Cron認証
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET) {
            if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
                return new NextResponse('Unauthorized', { status: 401 });
            }
        }

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
                const count = await generateForUser(u);
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
