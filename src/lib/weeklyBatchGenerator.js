import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { researchTrends, generatePost, factCheckPost, scrapeWebsite } from '@/lib/apiService';
import { buildPlatformCaption, PLATFORM_CAPTION_LIMITS } from '@/lib/captionUtils';

const APP_BASE_URL = 'https://sns-agent24.dearsconsulting.com';

// バッチ生成用の切り口（マンネリ防止）
// 各角度は「主題」「視点」「禁止テーマ」を含めて具体性を高め、
// 抽象的な「経営者の悩み」系に偏らないよう強制的に分散させる
// 7 角度のうち最後の "経営者の日常" だけは問いかけ形式を許容（自然な独白として効果的）。
// 他 6 つは「〜ですか？」「〜ではないでしょうか？」のような問いかけ形式を明示禁止して、
// 1 週間の中で問いかけ系投稿が多くても 1 件に収まるようにする (ユーザー要望)。
const NO_QUESTION_FORMAT_RULE = "問いかけは1投稿につき最大1回、冒頭フックでのみ使用可。『〜ではないでしょうか？』のような硬い提案書口調は避け、『〜で困っていませんか？』『〜になっていませんか？』程度の自然な話しかけに留めること";

const VARIETY_ANGLES = [
    {
        theme: "Webサイトのファーストビュー改善",
        guidance: "トップページ冒頭、CTA、問い合わせ導線、実績/料金/対応範囲の見せ方など、Webサイト上で明日直せる具体的なチェック項目に絞る。",
        requiredAnchors: "ファーストビュー / CTA / 問い合わせフォーム / 料金目安 / 対応範囲 のうち2つ以上",
        avoid: `価格競争、感情価値、スペック、共感、世界観、ファン化の話に広げない。${NO_QUESTION_FORMAT_RULE}`
    },
    {
        theme: "料金メニュー・プラン設計",
        guidance: "高単価サービスや商品を、松竹梅プラン、初回プラン、比較表、オプション整理で選びやすくする実務に絞る。",
        requiredAnchors: "松竹梅 / 初回プラン / オプション削減 / 比較表 / 予約導線 のうち2つ以上",
        avoid: `Webサイト全体論、感情価値、スペック、ブランド資産、ファン化に逃げない。${NO_QUESTION_FORMAT_RULE}`
    },
    {
        theme: "見積書・提案資料の見直し",
        guidance: "見積書、提案資料、初回商談資料で、価格だけを見られないために順番・項目名・説明量を変える具体策に絞る。",
        requiredAnchors: "見積書 / 提案資料 / 項目名 / 対応範囲 / 納品後サポート のうち2つ以上",
        avoid: `商品説明、Webサイト、SNS投稿、抽象的なブランディング論に広げない。${NO_QUESTION_FORMAT_RULE}`
    },
    {
        theme: "購入後・契約後フォローの設計",
        guidance: "同梱カード、初回メール、使い方案内、30日後フォロー、紹介依頼など、購入後の接点を改善する手順に絞る。",
        requiredAnchors: "同梱カード / 初回メール / 30日後フォロー / 使い方案内 / 紹介依頼 のうち2つ以上",
        avoid: `購入前の広告・Web・価格説明の話に戻らない。${NO_QUESTION_FORMAT_RULE}`
    },
    {
        theme: "口コミ・紹介が生まれる接点設計",
        guidance: "お客さんが誰かに紹介しやすくなる一言、写真を撮りたくなる受け渡し、レビュー依頼のタイミングを具体化する。",
        requiredAnchors: "レビュー依頼 / 紹介カード / 写真を撮る接点 / 受け渡し / UGC のうち2つ以上",
        avoid: `ファン化という言葉だけで終わらせない。感情価値・世界観・価格競争の話に戻らない。${NO_QUESTION_FORMAT_RULE}`
    },
    {
        theme: "アクセス解析・顧客の声の読み方",
        guidance: "GA4、Search Console、User Heat、Typeform、問い合わせログなどを使い、数字と顧客の声を並べて改善仮説を作る手順に絞る。",
        requiredAnchors: "GA4 / Search Console / User Heat / Typeform / 問い合わせログ のうち2つ以上",
        avoid: `数字ではなく心、左脳右脳、感情価値のような抽象的な橋渡しをしない。${NO_QUESTION_FORMAT_RULE}`
    },
    {
        theme: "問い合わせ・DM返信テンプレート改善",
        guidance: "問い合わせ、DM、初回返信、予約前の質問対応で、返信率や来店率を落とさないテンプレート改善に絞る。",
        requiredAnchors: "初回返信 / DM / FAQ / 予約前質問 / 返信テンプレート のうち2つ以上",
        avoid: `経営者の日常、読書、思考習慣、内省、哲学、感情価値、価格競争の話に広げない。${NO_QUESTION_FORMAT_RULE}`
    }
];

const TOPIC_CLASSIFIERS = [
    { key: 'website', pattern: /(Webサイト|トップページ|ファーストビュー|CTA|問い合わせフォーム|LP|導線)/ },
    { key: 'pricing_menu', pattern: /(松竹梅|初回プラン|料金メニュー|オプション|比較表|プラン設計)/ },
    { key: 'proposal', pattern: /(見積書|提案資料|初回商談|対応範囲|納品後サポート)/ },
    { key: 'followup', pattern: /(同梱カード|初回メール|購入後|30日後|使い方案内|紹介依頼)/ },
    { key: 'review_referral', pattern: /(口コミ|レビュー|紹介カード|UGC|受け渡し|写真を撮)/ },
    { key: 'analytics', pattern: /(GA4|Google Analytics|Search Console|User Heat|Typeform|問い合わせログ|ヒートマップ)/ },
    { key: 'dm_reply', pattern: /(DM|初回返信|FAQ|予約前質問|返信テンプレート)/ },
    { key: 'generic_value', pattern: /(価格競争|価格で比べ|感情価値|スペック|共感|心が動|買う理由|良いもの|価値を伝)/ }
];

function getPostText(post = {}) {
    const parts = [post.caption, post.overlay_copy, post.image_idea];
    if (Array.isArray(post.carousel_slides)) {
        post.carousel_slides.forEach(slide => {
            parts.push(slide?.overlay_copy, slide?.text);
        });
    }
    return parts.filter(Boolean).join('\n');
}

function classifyWeeklyTopic(post = {}) {
    const text = getPostText(post);
    const found = TOPIC_CLASSIFIERS.find(item => item.pattern.test(text));
    return found?.key || 'other';
}

async function sendApprovalEmail(email, pendingCount, appBaseUrl) {
    if (!process.env.SENDGRID_API_KEY || !email) {
        console.warn('[weekly-batch-generator] SendGrid未設定またはemail無しでメール通知スキップ');
        return;
    }

    const approvalUrl = `${appBaseUrl}/approve`;
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
        console.error('[weekly-batch-generator] SendGrid error:', errText);
    }
}

export async function generateWeeklyPostsForSettings(settings, options = {}) {
    const {
        sendEmail = true,
        appBaseUrl = APP_BASE_URL,
        logPrefix = '[weekly-batch-generator]'
    } = options;

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
        product_context,
        user_profile
    } = settings;

    const category = category_id ? { id: category_id, label: category_id } : { id: 'other', label: 'ビジネス全般' };
    const target = target_id ? { id: target_id, label: target_id } : { id: 'general', label: '一般' };
    const targetLabel = target.label;
    const platformType = 'instagram';
    const selectedFormat = 'carousel';
    const cleanProductContext = { ...(product_context || {}) };
    delete cleanProductContext.__batch_request_id;
    delete cleanProductContext.__batch_generation_started_at;
    const userProfile = user_profile || {};
    let siteContent = cleanProductContext?.siteContent || '';
    if (!siteContent && cleanProductContext?.websiteUrl) {
        try {
            siteContent = await scrapeWebsite(cleanProductContext.websiteUrl);
            cleanProductContext.siteContent = siteContent;
        } catch (err) {
            console.error(`${logPrefix} ${user_id} site scrape failed:`, err);
        }
    }

    const research = await researchTrends(
        category,
        targetLabel,
        gender,
        business_style,
        platformType,
        cleanProductContext?.location,
        siteContent,
        userProfile
    );

    if (!research) {
        throw new Error('トレンドリサーチ失敗');
    }

    const count = 7;
    const postPromises = [];
    for (let i = 0; i < count; i++) {
        const angle = VARIETY_ANGLES[i % VARIETY_ANGLES.length];
        const purposeSeed = `${purpose_id || '指定なし'}。

【今週の投稿テーマ切り口（必ず厳守）】
主題: ${angle.theme}
方針: ${angle.guidance}
必須具体物: ${angle.requiredAnchors}
禁止: ${angle.avoid}

【厳守事項】
- 上記の「主題」「方針」を必ず投稿の中心に据えること。
- 「必須具体物」から2つ以上を、caption または carousel_slides に具体的な言葉として必ず入れること。
- 上記の「禁止」に挙げたフレーズや概念は使わないこと。
- 1週間分の投稿はそれぞれ全く異なる実務接点から語る必要があり、特定のキーワード（価格競争、感情価値、スペック、共感、世界観、ファン化、良いもの、選ばれる理由）に偏らせないこと。
- 「価格で比べられる」「感情で選ばれる」「スペックではなく価値」の話は、指定テーマが明示的に要求しない限り使わないこと。
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
                siteContent,
                selectedFormat === 'carousel' ? 'carousel' : 'single',
                userProfile,
                purposeSeed,
                overlay_language || 'ja'
            )
            .then(post => ({ post, index: i }))
            .catch(err => {
                console.error(`${logPrefix} ${user_id} ${i + 1}件目の生成でエラー:`, err);
                return null;
            })
        );
    }

    const postOutcomes = await Promise.all(postPromises);

    const factCheckPromises = postOutcomes.map(async (outcome) => {
        if (!outcome || !outcome.post) return null;
        const p = outcome.post;
        return await factCheckPost(p.caption || '', p.carousel_slides || [], language || 'ja');
    });
    const factCheckResults = await Promise.all(factCheckPromises);
    let blockedByFactCheck = 0;
    factCheckResults.forEach((fc, idx) => {
        if (fc && fc.passed === false) {
            blockedByFactCheck++;
            console.warn(`${logPrefix} ${user_id} ${idx + 1}件目 ファクトチェック違反:`, JSON.stringify(fc.issues).slice(0, 300));
        }
    });
    if (blockedByFactCheck > 0) {
        console.log(`${logPrefix} ${user_id} ファクトチェックで ${blockedByFactCheck}件 違反を検出 (保存スキップ)`);
    }

    const results = [];
    for (let outcomeIdx = 0; outcomeIdx < postOutcomes.length; outcomeIdx++) {
        const topicCounts = results.reduce((acc, r) => {
            const key = r.topic_key || 'other';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        const outcome = postOutcomes[outcomeIdx];
        if (!outcome || !outcome.post) continue;
        const { post, index: i } = outcome;
        const factCheck = factCheckResults[outcomeIdx];

        if (post.quality_blocked === true) {
            console.warn(`${logPrefix} ${user_id} ${i + 1}件目は生成後品質ゲートNGのため保存スキップ:`, JSON.stringify(post.quality_issues || []).slice(0, 300));
            continue;
        }

        if (factCheck && factCheck.passed === false) {
            console.warn(`${logPrefix} ${user_id} ${i + 1}件目はファクトチェックNGのため保存スキップ:`, JSON.stringify(factCheck.issues || []).slice(0, 300));
            continue;
        }

        const captionBody = post.caption || post.overlay_copy || '';
        const finalCaption = buildPlatformCaption(captionBody, post.hashtags, platformType);
        if (finalCaption.length > PLATFORM_CAPTION_LIMITS[platformType]) {
            console.warn(`${logPrefix} ${user_id} ${i + 1}件目 caption ${finalCaption.length}文字で上限超え (想定外)`);
        }

        if (!finalCaption.trim() && !post.image_idea && !post.overlay_copy) {
            console.warn(`${logPrefix} ${user_id} ${i + 1}件目がほぼ空なのでスキップ`);
            continue;
        }

        const topicKey = classifyWeeklyTopic(post);
        if (topicKey !== 'other' && topicCounts[topicKey] >= 1) {
            console.warn(`${logPrefix} ${user_id} ${i + 1}件目は週内テーマ重複 (${topicKey}) のためスキップ`);
            continue;
        }

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
            image_idea: post.image_idea || null,
            topic_key: topicKey
        });
    }

    if (results.length === 0) return 0;

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
        console.error(`${logPrefix} ${user_id} DB挿入エラー:`, error);
        return 0;
    }

    if (sendEmail) {
        try {
            await sendApprovalEmail(email, results.length, appBaseUrl);
        } catch (mailErr) {
            console.error(`${logPrefix} ${user_id} メール送信失敗:`, mailErr);
        }
    }

    return results.length;
}
