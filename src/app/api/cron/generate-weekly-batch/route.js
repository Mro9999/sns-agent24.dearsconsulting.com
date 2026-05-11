import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { researchTrends, generatePost } from '@/lib/apiService';
import { buildPlatformCaption, PLATFORM_CAPTION_LIMITS } from '@/lib/captionUtils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel Hobby の最大5分
// 注: 画像生成はこのcronでは行わない（Vercel Hobbyのタイムアウト対策）
// 画像は /approve ページを開いた時に /api/generate-post-image で各投稿ごとに生成される

// 週次の自動コンテンツ生成Cron
// 毎週日曜日 20:00 JST (= 11:00 UTC) に実行される
// enabled なユーザーごとに1週間分(7件)のInstagram投稿案を生成し、
// pending_approval 状態で保存。ユーザーへは承認リンクをメール通知する。

const APP_BASE_URL = 'https://sns-agent24.dearsconsulting.com';

// バッチ生成用の切り口（マンネリ防止）
// 各角度は「主題」「視点」「禁止テーマ」を含めて具体性を高め、
// 抽象的な「経営者の悩み」系に偏らないよう強制的に分散させる
// 7 角度のうち最後の "経営者の日常" だけは問いかけ形式を許容（自然な独白として効果的）。
// 他 6 つは「〜ですか？」「〜ではないでしょうか？」のような問いかけ形式を明示禁止して、
// 1 週間の中で問いかけ系投稿が多くても 1 件に収まるようにする (ユーザー要望)。
const NO_QUESTION_FORMAT_RULE = "問いかけ形式の見出し・キャプション（『〜ですか？』『〜ではないでしょうか？』『〜と感じませんか？』『〜していますか？』等）は禁止。読者に質問を投げず、『〜です』『〜ます』『〜と判明しました』のような事実伝達・宣言形のですます調で書くこと";

const VARIETY_ANGLES = [
    {
        theme: "実践ノウハウ・ステップバイステップ",
        guidance: "今すぐ使える具体的な手法・手順・チェックリストを提示。読者が『今日試してみよう』と思える教育的コンテンツ。",
        avoid: `「売上達成後の虚しさ」「経営者の心理」「100年後」「未来の自分」のような哲学・心理寄りのテーマ。${NO_QUESTION_FORMAT_RULE}`
    },
    {
        theme: "業界トレンド・データ分析",
        guidance: "数値・統計・最新動向を用いた客観的な業界解説。具体的な数字や事実ベースで語る。",
        avoid: `情緒的な表現、「あなたの心は」「本当の願い」のような内省系のフレーズ。${NO_QUESTION_FORMAT_RULE}`
    },
    {
        theme: "顧客の現場課題と解決策",
        guidance: "顧客が日々ぶつかる具体的な業務課題（人材、集客手法、業務効率、ツール選定 等）と実践的解決策。",
        avoid: `「売上目標の先」「達成しても満たされない」のような抽象的悩み。${NO_QUESTION_FORMAT_RULE}`
    },
    {
        theme: "業界用語・専門知識の解説",
        guidance: "読者が『学べた』と感じる、業界専門用語や仕組みの平易な解説。図解的・教科書的な切り口。",
        avoid: `感情訴求、ポエム調。${NO_QUESTION_FORMAT_RULE}`
    },
    {
        theme: "事例紹介・ケーススタディ",
        guidance: "業種別の取り組み事例（企業名は伏せて構わない）。具体的な施策・結果・学びを示す。",
        avoid: `抽象論、「本質」「美学」のような曖昧語。${NO_QUESTION_FORMAT_RULE}`
    },
    {
        theme: "ツール・リソース紹介",
        guidance: "実際に使える具体的なツール・サービス・参考文献の紹介と活用方法。",
        avoid: `経営哲学、人生観。${NO_QUESTION_FORMAT_RULE}`
    },
    {
        // この 1 つだけ問いかけ形式を許容 (週 1 件まで自然に問いかけ系を残す)
        theme: "経営者の日常・人間味のある話題",
        guidance: "朝のルーティン、読書、業界外の趣味、健康習慣、対話のエピソード等の親しみやすい話題。問いかけ形式は自然な範囲で 1 件まで使用可。",
        avoid: "売上、KPI、達成、虚しさ、満たされる、燃える、遺す、100年後"
    }
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
    <h1 style="font-size: 22px; margin: 0 0 16px;">今週の投稿案ができました</h1>
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
            subject: '【SNS Agent 24】今週の投稿案を確認してください',
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
        overlay_language,
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

    const count = 7;

    // 7件のgeneratePostを並列実行（Vercel Hobby 300s制限内に収める）
    // 順次だと15〜30s × 7 = 最大210sで timeoutの危険があるため、全部同時に走らせる。
    // Gemini API 側のレート制限に引っかかる可能性はあるが、7並列なら通常セーフ。
    const postPromises = [];
    for (let i = 0; i < count; i++) {
        const angle = VARIETY_ANGLES[i % VARIETY_ANGLES.length];
        const purposeSeed = `${purpose_id || '指定なし'}。

【今週の投稿テーマ切り口（必ず厳守）】
主題: ${angle.theme}
方針: ${angle.guidance}
禁止: ${angle.avoid}

【厳守事項】
- 上記の「主題」「方針」を必ず投稿の中心に据えること。
- 上記の「禁止」に挙げたフレーズや概念は使わないこと。
- 1週間分の投稿はそれぞれ全く異なる角度から語る必要があり、特定のキーワード（売上、達成、虚しさ、100年後、燃える、遺す、満たされる など）に偏らせないこと。
- 抽象的な哲学やポエム調ではなく、読者が具体的な学び・気づき・行動を得られる実用的な内容を優先する。`;

        postPromises.push(
            generatePost(
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
                purposeSeed,
                overlay_language || 'ja'
            )
            .then(post => ({ post, index: i }))
            .catch(err => {
                console.error(`[generate-weekly-batch] ${user_id} ${i + 1}件目の生成でエラー:`, err);
                return null;
            })
        );
    }

    const postOutcomes = await Promise.all(postPromises);
    const results = [];

    for (const outcome of postOutcomes) {
        if (!outcome || !outcome.post) continue;
        const { post, index: i } = outcome;

        // 投稿本文＋ハッシュタグを Instagram の 2,200 文字上限内に収めて結合
        // (Make.com の Instagram 自動投稿で "The caption was too long. (36004)" を回避)
        const captionBody = post.caption || post.overlay_copy || '';
        const finalCaption = buildPlatformCaption(captionBody, post.hashtags, platformType);
        if (finalCaption.length > PLATFORM_CAPTION_LIMITS[platformType]) {
            console.warn(`[generate-weekly-batch] ${user_id} ${i + 1}件目 caption ${finalCaption.length}文字で上限超え (想定外)`);
        }

        // 中身が空のポストはDBに入れない(稀にAIが空JSONを返すケースのガード)
        if (!finalCaption.trim() && !post.image_idea && !post.overlay_copy) {
            console.warn(`[generate-weekly-batch] ${user_id} ${i + 1}件目がほぼ空なのでスキップ`);
            continue;
        }

        // 予約時刻: 明日以降、1日1件、12:00 JST (= 03:00 UTC)
        // Vercelサーバーは UTC で動くため setHours(12) だと 12:00 UTC = 21:00 JST になってしまう
        // setUTCHours(3) で明示的に 03:00 UTC = 12:00 JST を指定する
        const schedDate = new Date();
        schedDate.setUTCDate(schedDate.getUTCDate() + 1 + i);
        schedDate.setUTCHours(3, 0, 0, 0);

        results.push({
            user_id,
            platform: platformType,
            caption: finalCaption,
            image_urls: [],
            scheduled_at: schedDate.toISOString(),
            status: 'pending_approval',
            overlay_copy: post.overlay_copy || null,
            carousel_slides: post.carousel_slides || null,
            image_idea: post.image_idea || null
        });
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
        image_idea: r.image_idea,
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
