"use server";
// src/lib/apiService.js
import { GoogleGenAI } from '@google/genai';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabaseAdmin';
import crypto from 'crypto';

// 注: "use server" ファイルでは async 関数以外を export できないため、
// maxDuration はここに置けない (Next.js の制約)。Server Action のタイムアウトは
// Vercel Hobby のデフォルト 60秒 で動作する。flash 切替 (d80b048) で
// API 呼び出しが高速化したので、現状はデフォルトで十分。

// Gemini SDK 初期化関数 (モジュール読み込み時のエラーを防ぐための遅延評価)
// Vercelの本番環境で環境変数がロードされる前に呼ばれてクラッシュするのを防ぎます
const getAI = () => {
    if (!process.env.GEMINI_API_KEY) {
        console.error("Gemini API Key is missing!");
    }
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
};

// 絵文字をプログラムレベルで再帰的に完全削除するヘルパー関数
const removeEmojis = (obj) => {
    if (typeof obj === 'string') {
        // 絵文字、顔文字、特殊な絵文字結合子を幅広く除去する強力な正規表現
        return obj.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F]/gu, '');
    }
    if (Array.isArray(obj)) {
        return obj.map(removeEmojis);
    }
    if (obj !== null && typeof obj === 'object') {
        const newObj = {};
        for (const key in obj) {
            newObj[key] = removeEmojis(obj[key]);
        }
        return newObj;
    }
    return obj;
};

// Google Search利用時はresponseMimeType: "application/json"が使えないため、
// 返却されたテキスト（マークダウン等）からJSON部分だけを安全に抽出してパースする関数
const extractJSON = (text, fallbackData = {}) => {
    try {
        // "```json ... ```" のようなマークダウンブロックがあれば除去
        const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanText);
        // パースしたJSONオブジェクトから絵文字を強制的にプログラムレベルで除去
        return removeEmojis(parsed);
    } catch (e) {
        console.error("Failed to parse JSON from AI response:", text);
        console.error("Parse Error Details:", e);
        // エラーで画面がクラッシュしないよう、安全なデフォルトデータを返す
        return fallbackData;
    }
};

// APIリトライ用の汎用ヘルパー関数
// 503 (MODEL_CAPACITY_EXHAUSTED) や 429 などの一時的なエラー時に自動で再試行する
const withRetry = async (fn, maxRetries = 3, baseDelay = 3000) => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await fn();
        } catch (error) {
            attempt++;
            const errorMessage = String(error?.message || error).toLowerCase();
            
            // リトライ対象となるエラー文字列の判定
            const isRetryable = errorMessage.includes('503') || 
                                errorMessage.includes('429') || 
                                errorMessage.includes('capacity') || 
                                errorMessage.includes('exhausted') || 
                                errorMessage.includes('timeout') || 
                                errorMessage.includes('fetch');

            console.error(`[API Error] Attempt ${attempt}/${maxRetries} failed:`, error.message || error);

            if (!isRetryable || attempt >= maxRetries) {
                throw error; // リトライ不可、または最大回数に達した場合はエラーを投げる
            }
            
            const delay = baseDelay * Math.pow(2, attempt - 1); // 3秒, 6秒, 12秒... と待機時間を増やす(Exponential Backoff)
            console.log(`[API Retry] Wait for ${delay / 1000} seconds before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};


// モデル名
const TEXT_MODEL = 'gemini-2.5-pro'; // 高機能・最新の文章・推論用モデル (generatePost のメイン用)
// researchTrends は Google Search Grounding が情報源なので flash で十分 + 暗黙キャッシュ閾値が 1,024 tok と低く効きやすい
// (Pro は 4,096 tok 以上必要 → researchTrends 静的部 1,149 tok では Pro キャッシュ発動不可)
const RESEARCH_MODEL = 'gemini-2.5-flash';
const IMAGE_MODEL = 'imagen-4.0-generate-001'; // 最新の画像生成モデル

const STEP_PROMISE_PATTERN = /([3３]\s*(?:つの)?(?:具体的な)?\s*(?:ステップ|手順|工程)|三\s*(?:つの)?(?:具体的な)?\s*(?:ステップ|手順|工程)|[3３]\s*steps?)/i;
const STEP_LABEL_PATTERNS = [
    /(?:step|STEP)\s*0?[1１]|ステップ\s*[1１]|手順\s*[1１]|工程\s*[1１]|[1１][.．、:：]/i,
    /(?:step|STEP)\s*0?[2２]|ステップ\s*[2２]|手順\s*[2２]|工程\s*[2２]|[2２][.．、:：]/i,
    /(?:step|STEP)\s*0?[3３]|ステップ\s*[3３]|手順\s*[3３]|工程\s*[3３]|[3３][.．、:：]/i
];

const getSlideText = (slide) => `${slide?.overlay_copy || ''}\n${slide?.text || ''}`;

const hasStepPromise = (post = {}) => {
    const slidesText = Array.isArray(post.carousel_slides)
        ? post.carousel_slides.map(getSlideText).join('\n')
        : '';
    return STEP_PROMISE_PATTERN.test(`${post.caption || ''}\n${slidesText}`);
};

const hasExplicitStepSlides = (slides = []) => {
    if (!Array.isArray(slides) || slides.length < 3) return false;
    return STEP_LABEL_PATTERNS.every((pattern, index) => pattern.test(getSlideText(slides[index])));
};

const hasCarouselStepMismatch = (post = {}, format = 'single') => {
    return format === 'carousel' && hasStepPromise(post) && !hasExplicitStepSlides(post.carousel_slides);
};

const softenStepPromiseText = (value) => {
    if (typeof value !== 'string') return value;
    return value
        .replace(/[3３]\s*つの\s*具体的な\s*(?:ステップ|手順|工程)で解説します/g, '3つの観点から整理します')
        .replace(/[3３]\s*つの\s*具体的な\s*(?:ステップ|手順|工程)/g, '3つの観点')
        .replace(/三\s*つの\s*具体的な\s*(?:ステップ|手順|工程)/g, '3つの観点')
        .replace(/[3３]\s*(?:ステップ|手順|工程)/g, '3つの観点');
};

const softenCarouselStepPromises = (post = {}) => {
    const softened = {
        ...post,
        caption: softenStepPromiseText(post.caption),
        overlay_copy: softenStepPromiseText(post.overlay_copy),
        carousel_slides: Array.isArray(post.carousel_slides)
            ? post.carousel_slides.map(slide => ({
                ...slide,
                overlay_copy: softenStepPromiseText(slide?.overlay_copy),
                text: softenStepPromiseText(slide?.text)
            }))
            : post.carousel_slides,
        variants: Array.isArray(post.variants)
            ? post.variants.map(variant => ({
                ...variant,
                caption: softenStepPromiseText(variant?.caption)
            }))
            : post.variants
    };
    return softened;
};

const repairCarouselStepNarrative = async (ai, post, overlayLangLabel) => {
    const repairPrompt = `
以下のInstagramカルーセルJSONは、キャプションまたはスライド見出しで「3ステップ」と約束しているのに、3枚のスライドが Step 1 / Step 2 / Step 3 として対応していません。
キャプションと carousel_slides を、読者が本当に3つの手順を読める構成へ修正してください。

厳守ルール:
- JSONのみで返すこと。
- caption, hashtags, carousel_slides, image_idea, variants のキー構造は維持すること。
- carousel_slides は必ず3枚。
- 1枚目 overlay_copy は必ず「1. ...」で始める。
- 2枚目 overlay_copy は必ず「2. ...」で始める。
- 3枚目 overlay_copy は必ず「3. ...」で始める。
- 各ステップはタイトルだけでなく、顧客体験を再設計するための具体的な行動にする。
- caption 内で「3つの具体的なステップ」と書く場合は、本文中にも同じ3ステップ名を短く列挙する。
- overlay_copy は各スライド全角24文字以内、最大2行、スマホで読める短さにする。
- overlay_copy は必ず${overlayLangLabel}のみ。絵文字は禁止。
- image_hint_en は英語のみで、各ステップの具体的な行動を視覚化する。

修正対象JSON:
${JSON.stringify(post)}
`;

    const response = await withRetry(async () => {
        return await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: repairPrompt,
            config: { temperature: 0.25 }
        });
    }, 2, 2000);

    return extractJSON(response.text, post);
};

const RESULT_METRIC_CONTEXT = '(売上|EC売上|広告費|CVR|CPA|ROAS|LTV|客単価|顧客満足度|問い合わせ|問合せ|申込|申し込み|成約率|離脱率|継続率|リピート率|利益|粗利|予約数|集客|フォロワー|再購入|購入率|解約率)';
const RESULT_CHANGE_CONTEXT = '(削減|改善|増加|向上|短縮|伸び|上昇|低下|達成|実現|成功|改善)';
const UNSUPPORTED_METRIC_PATTERNS = [
    new RegExp(`${RESULT_METRIC_CONTEXT}.{0,24}(\\d+(?:\\.\\d+)?\\s*(?:%|％|倍)|[0-9０-９]+割|半数|約半数)`, 'i'),
    new RegExp(`(\\d+(?:\\.\\d+)?\\s*(?:%|％|倍)|[0-9０-９]+割|半数|約半数).{0,24}${RESULT_METRIC_CONTEXT}`, 'i'),
    new RegExp(`(\\d+(?:\\.\\d+)?\\s*(?:%|％|倍)).{0,24}${RESULT_CHANGE_CONTEXT}`, 'i'),
    new RegExp(`(?:ある調査|調査では|データでは|研究では|レポートでは|市場データ).{0,36}\\d+(?:\\.\\d+)?\\s*(?:%|％|倍)`, 'i')
];
const SOURCE_HINT_PATTERN = /(出典|によると|省|庁|機構|協会|白書|調査20\d{2}|20\d{2}年版|令和[0-9０-９]+年)/;
const UNSUPPORTED_PROOF_PATTERNS = [
    /(?:私たち|当社|弊社|DEARS\s*CONSULTING).{0,36}(?:実際に支援|支援した|伴走支援|伴走した|実現しました|改善しました|成果|事例)/i,
    /(?:クライアント|顧客企業|導入企業|支援先).{0,36}(?:売上|広告費|成果|改善|増加|削減|実践|実現|成功)/i,
    /(?:実際に|実在の|具体的な).{0,24}(?:支援|伴走|事例|成功|変化|成果)/i,
    /(?:年商|月商).{0,18}(?:クライアント|顧客企業|支援先|企業).{0,36}(?:支援|伴走|実践|実現|改善|成果)/i
];
const ENGLISH_TRANSLATION_PATTERN = /\[?\s*English Translation\s*\]?/i;
const LONG_ENGLISH_SENTENCE_PATTERN = /[A-Za-z]{4,}(?:[\s,.;:'"!?()-]+[A-Za-z]{3,}){5,}/;
const HARD_WHITEPAPER_TERMS = [
    '貸借対照表',
    'B/S',
    '有形資産',
    '無形資産',
    '客観的に評価',
    '中長期的',
    '不可欠',
    '貴社',
    '弊社',
    '事業者様',
    '競争優位性',
    '経営資産',
    '企業価値',
    'ブランド資産',
    '情緒的価値',
    '戦略的に高める'
];
const SPIRITUAL_DRIFT_TERMS = [
    '哲学',
    '美学',
    '思想',
    '魂',
    '本質',
    '内なる声',
    '静寂',
    '余白',
    '在り方',
    'らしさ',
    '覚悟',
    '解像度',
    '世界観',
    'ストーリー',
    '物語',
    '共感',
    '共鳴',
    '感情価値'
];
const OVERUSED_VALUE_MARKETING_TERMS = [
    '価格競争',
    '価格で比べ',
    '価格だけで判断',
    'スペック',
    '感情価値',
    '情緒的価値',
    '心理価値',
    'ブランド資産',
    '顧客体験',
    '心が動',
    '買う理由',
    '良いもの',
    '価値を伝',
    'ファンが増',
    '選ばれる理由'
];

const MAX_OVERLAY_VISUAL_LENGTH = 24;

const overlayVisualLength = (value = '') => {
    let len = 0;
    for (const ch of String(value).replace(/\\n/g, '\n').replace(/\s+/g, '')) {
        len += ch.charCodeAt(0) < 256 ? 0.5 : 1;
    }
    return len;
};

const collectOverlayCopies = (post = {}) => {
    const overlays = [];
    if (post.overlay_copy) overlays.push({ label: 'overlay_copy', value: post.overlay_copy });
    if (Array.isArray(post.carousel_slides)) {
        post.carousel_slides.forEach((slide, index) => {
            if (slide?.overlay_copy) {
                overlays.push({ label: `carousel_slides[${index}].overlay_copy`, value: slide.overlay_copy });
            }
        });
    }
    return overlays;
};

const getTextExcerpt = (text = '', pattern) => {
    const match = String(text).match(pattern);
    if (!match) return '';
    const start = Math.max(0, match.index - 20);
    return String(text).slice(start, start + 120).replace(/\s+/g, ' ').trim();
};

const stripJapaneseLanguageLeak = (value, language) => {
    if (language !== 'ja' || typeof value !== 'string') return value;
    return value
        .replace(/\n?\s*\[?\s*English Translation\s*\]?[\s\S]*$/i, '')
        .replace(/\n?\s*Many executives[\s\S]*$/i, '')
        .trim();
};

const normalizeGeneratedPostLanguage = (post = {}, language = 'ja') => ({
    ...post,
    caption: stripJapaneseLanguageLeak(post.caption, language),
    overlay_copy: stripJapaneseLanguageLeak(post.overlay_copy, language),
    carousel_slides: Array.isArray(post.carousel_slides)
        ? post.carousel_slides.map(slide => ({
            ...slide,
            overlay_copy: stripJapaneseLanguageLeak(slide?.overlay_copy, language),
            text: stripJapaneseLanguageLeak(slide?.text, language)
        }))
        : post.carousel_slides,
    variants: Array.isArray(post.variants)
        ? post.variants.map(variant => ({
            ...variant,
            caption: stripJapaneseLanguageLeak(variant?.caption, language)
        }))
        : post.variants
});

const collectQualityText = (post = {}) => {
    const parts = [];
    if (post.caption) parts.push(post.caption);
    if (post.overlay_copy) parts.push(post.overlay_copy);
    if (Array.isArray(post.carousel_slides)) {
        post.carousel_slides.forEach(slide => {
            if (slide?.overlay_copy) parts.push(slide.overlay_copy);
            if (slide?.text) parts.push(slide.text);
        });
    }
    if (Array.isArray(post.variants)) {
        post.variants.forEach(variant => {
            if (variant?.caption) parts.push(variant.caption);
        });
    }
    return parts.join('\n');
};

const detectUnsafeCopyIssues = (post = {}, language = 'ja') => {
    const text = collectQualityText(post);
    const issues = [];

    for (const pattern of UNSUPPORTED_PROOF_PATTERNS) {
        if (pattern.test(text)) {
            issues.push({
                type: 'unsupported_case_study',
                excerpt: getTextExcerpt(text, pattern),
                reason: 'ユーザー提供にない自社・クライアント実績のように読める表現です。'
            });
            break;
        }
    }

    for (const pattern of UNSUPPORTED_METRIC_PATTERNS) {
        if (pattern.test(text) && !SOURCE_HINT_PATTERN.test(text)) {
            issues.push({
                type: 'unsupported_metric',
                excerpt: getTextExcerpt(text, pattern),
                reason: '出典なしの成果数値・割合・倍率に見えるため、虚偽広告リスクがあります。'
            });
            break;
        }
    }

    if (language === 'ja' && (ENGLISH_TRANSLATION_PATTERN.test(text) || LONG_ENGLISH_SENTENCE_PATTERN.test(text))) {
        issues.push({
            type: 'language_contamination',
            excerpt: getTextExcerpt(text, ENGLISH_TRANSLATION_PATTERN.test(text) ? ENGLISH_TRANSLATION_PATTERN : LONG_ENGLISH_SENTENCE_PATTERN),
            reason: '日本語投稿に英語翻訳や長い英文が混入しています。'
        });
    }

    const hardTerms = HARD_WHITEPAPER_TERMS.filter(term => text.includes(term));
    if (hardTerms.length >= 2 || hardTerms.some(term => ['貸借対照表', 'B/S', '有形資産', '無形資産', 'ブランド資産', '情緒的価値'].includes(term))) {
        issues.push({
            type: 'hard_whitepaper_style',
            excerpt: hardTerms.slice(0, 6).join(', '),
            reason: 'Instagram投稿として硬すぎる提案書・白書・会計資料寄りの表現です。'
        });
    }

    const spiritualTerms = SPIRITUAL_DRIFT_TERMS.filter(term => text.includes(term));
    if (spiritualTerms.length >= 4) {
        issues.push({
            type: 'spiritual_overuse',
            excerpt: spiritualTerms.slice(0, 8).join(', '),
            reason: '実務投稿ではなく、抽象的なブランディング/マインドセット投稿に寄っています。'
        });
    }

    const overusedValueTerms = OVERUSED_VALUE_MARKETING_TERMS.filter(term => text.includes(term));
    if (overusedValueTerms.length >= 3) {
        issues.push({
            type: 'generic_value_marketing_drift',
            excerpt: overusedValueTerms.slice(0, 8).join(', '),
            reason: '価格競争・感情価値・スペック周辺の一般論に寄りすぎています。'
        });
    }

    const longOverlay = collectOverlayCopies(post).find(item => overlayVisualLength(item.value) > MAX_OVERLAY_VISUAL_LENGTH);
    if (longOverlay) {
        issues.push({
            type: 'overlay_too_long',
            excerpt: `${longOverlay.label}: ${String(longOverlay.value).replace(/\s+/g, ' ').slice(0, 80)}`,
            reason: '画像内テキストが長く、スマホ表示で読みにくくなります。'
        });
    }

    return issues;
};

const repairUnsafePostCopy = async (ai, post, language, textContext, userProfile, issues = []) => {
    const repairPrompt = `
以下のInstagram投稿JSONには、根拠のない実績表現・具体数字・言語混入のリスクがあります。
危険箇所だけを修正し、JSONのみで返してください。

検出された問題:
${JSON.stringify(issues)}

厳守ルール:
- caption, hashtags, carousel_slides, image_idea, variants のキー構造は維持する。
- carousel_slides がある場合は3枚を維持する。
- ユーザー提供にない「支援実績」「クライアント成果」「売上改善」「広告費削減」「実際に支援した」等は書かない。
- 出典機関名と発表年がない %・倍率・成果数字は、範囲表現または定性的表現に置換する。
- 「DEARS CONSULTINGが支援した事例」ではなく、「よくある構造」「見直しポイント」「設計手順」として書く。
- language が ja の場合、caption / text / overlay_copy は日本語のみ。英語翻訳セクションは削除する。
- ただし image_hint_en は英語のまま維持してよい。
- 抽象論ではなく、読者が明日見直せる具体的な作業・チェック項目へ落とす。
- 「貸借対照表」「B/S」「有形資産」「無形資産」「貴社」「事業者様」「不可欠」「中長期的」「客観的に評価」は使わない。必要なら「数字に出にくい強み」「会社の強み」「まず見直すポイント」などに言い換える。
- Instagram向けに、短い文・自然な話しかけ・保存したくなるチェック項目へ書き換える。
- overlay_copy はスマホで読めるように、全角換算24文字以内、最大2行、1枚1メッセージにする。本文の要約ではなく、読者が止まる短い一言にする。
- 「ブランド資産」「情緒的価値」「顧客体験」のような抽象語は、必要なら「価格で比べられにくい理由」「買った後に嬉しくなる理由」「お客さんが迷わない導線」などの日常語へ置き換える。

ユーザー提供コンテキスト:
- 会社名: ${textContext?.companyName || '未設定'}
- 訴求ポイント: ${textContext?.sellingPoint || '未設定'}
- 業種: ${userProfile?.industry || '未設定'}
- 顧客層: ${userProfile?.targetAudience || '未設定'}
- USP: ${userProfile?.usp || '未設定'}
- language: ${language}

修正対象JSON:
${JSON.stringify(post)}
`;

    const response = await withRetry(async () => {
        return await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: repairPrompt,
            config: { temperature: 0.2 }
        });
    }, 2, 2000);

    return extractJSON(response.text, post);
};

/**
 * トレンドリサーチ
 */
export async function researchTrends(category, targetLabel, gender, businessStyle, platformId, location, siteContent, userProfile = {}) {
    try {
        // ⚡ プロンプト構造の重要原則 (Gemini 暗黙キャッシュ最適化):
        //   - 静的指示は冒頭に集約 (キャッシュ可能なプレフィックス最大化)
        //   - 動的な ${...} 補間は末尾近くに集約
        //   - ランダムシードは最末尾 (キャッシュ阻害を最小化)
        // 暗黙キャッシュは 1,024 token 以上の一致プレフィックスで自動発動 → 75% 割引
        const STATIC_PREFIX = `
あなたは世界トップクラスのマーケター兼トレンドアナリストです。

# 言語制約（超重要）
すべての出力（JSONの各値など）は、**必ず完全で自然な「日本語」のみ**を使用してください。
英単語などの一般的な固有名詞等を除き、**ロシア語（例: готовые）、アラビア語、フランス語など、指定以外の言語が1文字でも混入することは固く禁じます。**

# 分析要件
以下の3方向から最新情報をリサーチし、キャプション案と生成画像に活かせる具体的な「統合インサイト」を導き出してください。
1. 世の中の大きなトレンド（社会情勢、流行語、価値観の変化など）
2. 業界内でのトレンド（競合の動き、最新のビジネスモデルや提供価値など）
3. ターゲット層のトレンド（対象ユーザーが今一番関心を持っていること、行動・消費パターンなど）

# リサーチ品質の絶対基準
- 「価格競争から脱却」「価値を伝える」「顧客体験を設計する」のような一般論だけで終わらせないでください。
- 読者が思わず保存する投稿にするため、対象読者が朝の業務中に実際に困っている具体的な場面、見落としている判断基準、すぐ見直せる作業を抽出してください。
- 支援実績・クライアント成果・売上増加率など、ユーザー提供にない事実は作らないでください。実績が必要な場合は「よくある構造」「見直し観点」「仮説」として扱ってください。
- 出典名と発表年を明示できない具体的な %・倍率・成果数字は禁止です。数字が必要ならレンジ表現または定性的表現にしてください。
- 投稿で避けるべき「ありきたりな角度」も必ず列挙してください。

# 出力形式 (JSONのみ)
{
    "insight_macro": "①世の中の大きなトレンド (100文字程度)",
    "insight_industry": "②業界内でのトレンド (100文字程度)",
    "insight_target": "③ターゲット層のトレンド (100文字程度)",
    "insight_summary": "これら3方向のトレンドを掛け合わせた、今回の投稿内容や画像生成に活かすべき見込み客の深い心理と全く新しいアプローチ方針（200文字程度）",
    "audience_tension": "読者が今まさに困っている、表に出にくい具体的な葛藤や業務上の摩擦 (120文字程度)",
    "non_obvious_angle": "Instagramでよくある一般論と違う、保存されやすい逆張り・盲点・実務切り口 (120文字程度)",
    "scroll_stopper": "1枚目で止めるための強い切り口。煽りではなく、読者の現場に刺さる具体的な違和感 (80文字程度)",
    "save_worthy_action": "読者が明日実行できるチェック項目・手順・見直し作業 (120文字程度)",
    "avoid_angles": ["避けるべきありきたりな切り口1", "避けるべきありきたりな切り口2", "避けるべき危険な捏造/実績表現"],
    "evidence_notes": ["参照した事実・トレンドのメモ。出典名が曖昧な数字は書かない"],
    "logic": {
        "query": "代表的なリサーチ検索キーワード",
        "queries": ["検索キーワード1", "検索キーワード2", "検索キーワード3"],
        "why_not_generic": "なぜこの切り口が一般論ではなく、このビジネス/読者に刺さるのか",
        "model": "使用モデル名"
    }
}

※最重要指令: あなたはこれまで何度も似たような分析を出力しがちです。今回は【絶対に過去のパターンを踏襲せず】、これまでとは全く異なる斬新で独自の切り口、隠れたインサイト、あるいは逆張りの視点を持って以下の分析を行ってください。
`;

        const dynamicContext = `
# 条件（一般）
- プラットフォーム: ${platformId}
- 業種/カテゴリ: ${category?.label || category}
- ターゲット層: ${targetLabel}
- 性別: ${gender === 'male' ? '男性' : gender === 'female' ? '女性' : '不問'}
- ビジネス形態: ${businessStyle === 'physical' ? '実店舗・サロン' : businessStyle === 'online' ? 'オンライン・EC' : 'サービス・レッスン'}
${location ? `- 地域: ${location}` : ''}
${siteContent ? `- 参考サイト情報: ${siteContent.substring(0, 1000)}...` : ''}

# ユーザー固有コンテキスト（超重要）
この分析は以下の「特定のビジネス」のために行われます。一般的な分析ではなく、このビジネスに深く刺さる独自のインサイトを導き出してください。
- 実際の業種・ビジネス内容: ${userProfile.industry || '未設定'}
- メインの顧客層（具体的なターゲット）: ${userProfile.targetAudience || '未設定'}
- 自社の強み / 競合との差別化ポイント: ${userProfile.usp || '未設定'}

ランダムシード: ${new Date().toISOString()}_${Math.random()}
`;

        const prompt = STATIC_PREFIX + dynamicContext;

        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: RESEARCH_MODEL, // flash (Google Search Grounding 主導なので flash で十分 + キャッシュ条件を満たす)
                contents: prompt,
                config: {
                    temperature: 0.95, // 多様性を最大化
                    tools: [{ googleSearch: {} }] // ← ここでGoogle Search Grounding（最新情報検索機能）を有効化
                }
            });
        });

        // 📊 暗黙キャッシュヒット率モニタリング (Vercel Logs で確認)
        const usage = response.usageMetadata;
        if (usage) {
            const cached = usage.cachedContentTokenCount || 0;
            const total = usage.promptTokenCount || 0;
            const hitRate = total > 0 ? Math.round((cached / total) * 100) : 0;
            console.log(`[researchTrends:flash] cache: ${cached}/${total} tok (${hitRate}% hit)`);
        }

        return extractJSON(response.text);
    } catch (error) {
        console.error("researchTrends error:", error);
        throw new Error("トレンドリサーチに失敗しました。");
    }
}

/**
 * 投稿内容生成
 */
export async function generatePost(research, platformId, category, targetLabel, gender, businessStyle, tone, language = 'ja', textContext, siteContent, format = 'single', userProfile = {}, purpose = null, overlayLanguage = 'ja') {
    try {
        // ---- A. キャプション・本文系の言語 (キャプション/ハッシュタグ/スライド本文 text/image_idea) ----
        // 多言語併記可。インバウンド対応はここでハンドル。
        let captionLangInstruction = "**必ず完全で自然な「日本語」のみ**で作成してください。";
        if (language === 'ja_en') {
            captionLangInstruction = "【日本語】とネイティブな【英語】の両方を併記してください。ハッシュタグも日本語と英語を混ぜて生成してください。";
        } else if (language === 'ja_zh') {
            captionLangInstruction = "【日本語】と自然な【中国語(繁体字)】の両方を併記してください。ハッシュタグも日本語と中国語を混ぜて生成してください。";
        } else if (language === 'ja_ko') {
            captionLangInstruction = "【日本語】と自然な【韓国語】の両方を併記してください。ハッシュタグも日本語と韓国語を混ぜて生成してください。";
        } else if (language === 'all') {
            captionLangInstruction = "【日本語】【英語】【中国語(繁体字)】【韓国語】の4ヶ国語すべてを各段落に分けて併記してください。ハッシュタグも4言語のハイブリッドで幅広く生成してください。";
        }

        // ---- B. 画像オーバーレイ (overlay_copy) 専用の言語: 必ず単一 ----
        // 視認性のため画像内に乗せるテキストは1言語に絞る。インバウンド設定でも複数併記不可。
        const OVERLAY_LANG_LABELS = {
            ja: '日本語',
            en: 'English (英語)',
            zh_TW: '繁體中文 (中国語繁体字)',
            ko: '한국어 (韓国語)'
        };
        const overlayLangLabel = OVERLAY_LANG_LABELS[overlayLanguage] || '日本語';

        let languageInstruction = `【出力言語ルール（重要・必読）】

A. キャプション / ハッシュタグ / スライド本文 (carousel_slides[].text) / image_idea / variants:
   → ${captionLangInstruction}

B. 画像オーバーレイ (overlay_copy / carousel_slides[].overlay_copy):
   → **必ず ${overlayLangLabel} のみ** で生成してください。複数言語の併記は絶対に禁止です。理由: overlay_copy は画像上に直接表示されるため、視認性確保のため1言語に厳密制限しています。たとえキャプション側が多言語併記設定 (例: ja_en) であっても、overlay_copy だけは必ず ${overlayLangLabel} のみで書いてください。

C. image_hint_en は Imagen 画像生成プロンプト用のため、上記設定に関わらず **必ず英語で固定** してください。`;

        // 選択された言語（日本語単体、またはインバウンドを含む複数言語）以外の混入を強力に防ぐための共通ルール
        languageInstruction += `\n\n【超重要・多言語混入防止】上記で指定された各フィールドの言語以外（および一般的な固有名詞を除く）が1文字でも混入することはシステムエラーとなるため固く禁じます。特にロシア語（例: готовые）、アラビア語、フランス語などが意図せず出力されないよう、出力言語を極めて厳密にコントロールしてください。`;

        let formatInstruction = "";
        let basePurpose = purpose;
        let additionalInstruction = "";
        
        if (purpose && typeof purpose === 'string' && purpose.includes('【重要指示：今回の投稿テーマ切り口】')) {
            const parts = purpose.split('。\n');
            basePurpose = parts[0];
            additionalInstruction = '\n' + parts.slice(1).join('。\n');
        }

        let goalText = '指定なし（通常の魅力発信）';
        if (basePurpose === 'reservation') goalText = '来店・予約を増やしたい（キャンペーン・新規集客・予約誘導）';
        else if (basePurpose === 'relationship') goalText = '既存客との関係を深めたい（日常・スタッフ紹介・こだわりの裏側）';
        else if (basePurpose === 'branding') goalText = 'ブランドの強みを実務目線で語る（価格で比べられにくい理由、紹介される理由、初回相談・Webサイト・商品説明で見直せる具体的な接点の3軸で構成。"哲学" "美意識" "世界観" のような抽象語だけで終わる発信は禁止。読者がその場で実務に応用できる粒度まで具体化する）';
        else if (basePurpose === 'announcement') goalText = '新メニュー・商品を告知したい（新商品・季節メニュー・限定企画）';
        else if (basePurpose) goalText = basePurpose;

        goalText += additionalInstruction;
        if (format === 'carousel') {
            formatInstruction = `
# 出力形式 (JSONのみ)
{
    "caption": "一切の絵文字や顔文字を使用せず、Instagramで読みやすい自然な投稿文。硬い提案書口調は禁止。500〜800字程度、短い段落で構成し、最後にCTAやURLを含む",
    "hashtags": ["ハッシュタグ1", "ハッシュタグ2", "ハッシュタグ3", "ハッシュタグ4", "ハッシュタグ5"],
    "carousel_slides": [
        { "overlay_copy": "1枚目(表紙): 全角15〜24文字以内、最大2行。スマホで一瞬で読める1メッセージ。専門語・かぎ括弧の多用は禁止。適宜 '\\n' で改行", "text": "表紙の補足。50〜90字程度で短く", "image_hint_en": "Natural documentary English photo prompt (40-60 words) reinforcing slide 1's overlay_copy theme. NO TEXT in image. Use a believable Japanese service, retail, hospitality, craft, product, or consultation scene. No CGI, 3D render, surreal metaphor, glowing particles, or abstract graphics." },
        { "overlay_copy": "2枚目: 全角15〜24文字以内、最大2行。原因・見落とし・比較軸を日常語で示す", "text": "2枚目の解説。80〜130字程度。箇条書き可。専門用語は必ず言い換える", "image_hint_en": "Natural documentary English photo prompt (40-60 words) for slide 2's specific message. NO TEXT. Distinct real-world setting/subject from slide 1. No generic office, no fake diagrams, no uncanny hands/faces, no symbolic fantasy objects." },
        { "overlay_copy": "3枚目: 全角15〜24文字以内、最大2行。読者が次に試す行動を示す", "text": "3枚目の解説。80〜130字程度。読者の行動を促す", "image_hint_en": "Natural documentary English photo prompt (40-60 words) for slide 3's solution/outcome. NO TEXT. Distinct realistic setting from slides 1-2. Keep clean negative space for overlay, no readable books, screens, labels, or documents." }
    ],
    "image_idea": "この投稿全体の世界観を表す、${IMAGE_MODEL}で背景画像を生成するための詳細な画像プロンプト案（★毎回必ず異なる構図・切り口・被写体にする。英語、50単語程度）",
    "variants": [
        { "style": "標準", "caption": "...", "hashtags": ["..."] },
        { "style": "エモーショナル", "caption": "...", "hashtags": ["..."] }
    ]
}

# 【最重要】キャプションとカルーセル3枚の内容同期
- caption で「3ステップ」「3つの具体的なステップ」「3手順」「3工程」と約束する場合、carousel_slides の3枚は必ずその3ステップそのものにしてください。
- その場合、1枚目 overlay_copy は「1. ...」、2枚目は「2. ...」、3枚目は「3. ...」で始めてください。英字の Step 表記は長くなりやすいので原則使わないでください。
- 「3ステップ」と言いながら、1枚目=問題提起、2枚目=タイトル、3枚目=まとめ のような構成にすることは禁止です。
- 3枚のうち1枚だけに「3ステップ」と書くことは禁止です。読者が各スライドを見ただけで Step 1 / Step 2 / Step 3 の中身を理解できる構成にしてください。
- もしスライド構成が「問題提起 → 原因分解 → 解決の方向性」の場合、caption では「3ステップ」と書かず、「3つの観点」「3枚で整理します」のように表現してください。

# 【超重要】Instagram向けの文体・読みやすさ
- 提案書、白書、論文、営業資料のような硬い文章は禁止です。
- 読者はスマホで流し見しています。1文は35〜45文字前後まで。1段落は2文まで。長い説明はスライドに分けてください。
- 「貴社」「弊社」「不可欠です」「〜といえるでしょう」「〜少なくありません」「客観的に評価」「計画的に高める」のような硬い表現を避けてください。
- 代わりに「自社」「私たち」「まず見直したいのは」「ここで差が出ます」「置き去りになりがちです」のような自然な言葉を使ってください。
- キャプションは、1.共感できる現場の違和感 → 2.なぜ起こるか → 3.今日見直すポイント → 4.プロフィールリンクへの自然なCTA、の流れにしてください。
- ハッシュタグは日本語中心で5〜8個まで。英語ハッシュタグの大量追加は禁止です。
- 画像内テキストは本文の要約ではなく、読者が止まる短い一言にしてください。全角24文字を超える overlay_copy は失敗です。
- 「DEARS CONSULTINGでは」は最後のCTA段落で最大1回だけ使えます。本文冒頭や途中で何度も出すのは禁止です。
- 「貸借対照表」「B/S」「有形資産」「無形資産」「客観的に評価」「中長期的」「不可欠」「事業者様」「ブランド資産」「情緒的価値」は使用禁止です。
- 「ブランド価値」を使う場合は、すぐ後ろで「お客さんが選び続ける理由」「紹介される理由」「価格で比べられにくい理由」のように日常語へ言い換えてください。
- 良い画像コピー例: 「いい商品なのに、価格で比べられる」「説明を足すほど、伝わりにくい」「まず削る言葉を決める」
- 良い文体例: 「情報を足すほど、なぜか伝わりにくくなることがあります。まず見るべきなのは、何を書くかではなく、何を削るかです。」
- 悪い文体例: 「中長期的に企業価値を向上させるためには、無形資産を客観的に評価する視点が不可欠です。」

# 【超重要】image_hint_en の品質基準 (AIっぽいCG・抽象画像・genericなオフィス写真を避ける)

## 必ず守るルール
1. **そのスライドの overlay_copy を、現実に存在しそうな日本の事業現場・顧客接点・商品接点で視覚化** すること
2. **AIっぽく見える以下の表現は禁止**:
   - CGI / 3D render / surreal object / fantasy scene / glowing particles / neon sci-fi / abstract brain or data graphics
   - 不自然な手や顔、プラスチックのような肌、過度に完璧なストックフォト風の人物
   - 架空の文字が出やすい本、資料、画面、ホワイトボード、図表、ポスター、ラベル、パッケージ正面
3. **以下の generic 要素は禁止** (画像が「ノート・PC・コーヒー・手書き」に収束するため):
   - desk with laptop / notebook / pen / coffee cup / hands writing / person at computer / typical office scene
   - 単独の「businessperson in suit at office」「woman reading a book」のような無内容な記述
4. **各スライドは互いに異なる real-world setting / subject** にすること (例: 相談テーブル、商品棚、受付、工房、客室、梱包台、店頭ディスプレイ)
5. **画像内にテキスト・文字・看板・ラベル・ロゴが一切含まれないこと** (Imagen が日本語を文字化けで再現するため)
6. 40-60語の英語。自然光、普通の素材感、人物との距離、背景の余白を具体的に記述

## BAD vs GOOD 例
BAD: "A businessperson sitting at a desk with a laptop, writing in a notebook, with a coffee cup nearby, in a modern office with soft lighting"
GOOD: "A quiet Japanese consultation table in a small hospitality office, two people seen from the side reviewing blank material samples with no readable text, natural window light, simple wooden surfaces, realistic human posture, calm negative space above the table for overlay copy"

BAD: "Hands writing on a notebook with abstract symbols, representing thought"
GOOD: "A realistic product shelf in a small Japanese specialty shop, plain unlabeled packages arranged with one item being gently adjusted by a staff member, natural daylight, ordinary imperfections, shallow depth of field, no visible writing, no logos, no surreal lighting"
`;
        } else if (format === 'video_script') {
            formatInstruction = `
# 出力形式 (JSONのみ)
{
    "caption": "（※投稿文用）一切の絵文字や顔文字を使用せず、Instagramで読みやすい自然な投稿文。硬い提案書口調は禁止",
    "hashtags": ["ハッシュタグ1", "ハッシュタグ2", "ハッシュタグ3"],
    "video_script": [
        { "time": "0-3秒 (フック)", "visual": "画面に映すべき映像や行動の指示", "audio": "音声読み上げ用・セリフ", "text_overlay": "画面にデカデカと出すテロップ" },
        { "time": "3-15秒 (展開)", "visual": "画面指示...", "audio": "セリフ...", "text_overlay": "テロップ..." },
        { "time": "15-25秒 (解決・価値提供)", "visual": "画面指示...", "audio": "セリフ...", "text_overlay": "テロップ..." },
        { "time": "25-30秒 (CTA)", "visual": "画面指示...", "audio": "セリフ...", "text_overlay": "テロップ..." }
    ],
    "image_idea": "動画のサムネイルとして使える、${IMAGE_MODEL}向けの画像プロンプト案（★毎回必ず異なる構図・切り口・被写体にする。英語、50単語程度）",
    "variants": [
        { "style": "標準", "caption": "...", "hashtags": ["..."] }
    ]
}`;
        } else {
            // format === 'single' (デフォルト)
            formatInstruction = `
# 出力形式 (JSONのみ)
{
    "caption": "一切の絵文字や顔文字を使用せず、Instagramで読みやすい自然な投稿文。硬い提案書口調は禁止。500〜800字程度、短い段落で構成し、最後にCTAやURLを含む",
    "hashtags": ["ハッシュタグ1", "ハッシュタグ2", "ハッシュタグ3"],
    "image_idea": "この投稿文に合う、${IMAGE_MODEL}で生成するための詳細な画像プロンプト案（★毎回必ず異なる構図・切り口・被写体にする。英語、50単語程度）",
    "overlay_copy": "写真上に表示するキャッチコピー（全角15〜24文字以内、最大2行、'\\n'で改行推奨）。★スマホで一瞬で読める1メッセージにすること。『美学』『本質』『哲学』『情緒的価値』等の抽象語だけのコピーは禁止。読者の具体的な悩み・願望・行動に言及する",
    "variants": [
        { "style": "標準", "caption": "...", "hashtags": ["..."] },
        { "style": "エモーショナル", "caption": "...", "hashtags": ["..."] },
        { "style": "問いかけ", "caption": "...", "hashtags": ["..."] }
    ]
}`;
        }

        // ⚡ プロンプト構造の重要原則 (Gemini 暗黙キャッシュ最適化):
        //   - 静的指示 (役割・禁止事項・出力形式) を冒頭に集約 → ~3000 token のキャッシュ可能プレフィックス
        //   - 動的な ${...} 補間 (前提・コンテキスト・research) は末尾近くに集約
        //   - ランダムシードは最末尾でキャッシュ阻害を回避
        // formatInstruction は format ('single'/'carousel'/'video_script') ごとに固定文字列のため
        // STATIC_PREFIX 内に含めて OK (3 つのキャッシュキーが format ごとに育つ)
        const STATIC_PREFIX = `
あなたは特定の店舗・ブランドに所属し、その魅力を発信する「天才的なSNS運用担当者（中の人）」です。以下の「3方向のトレンドリサーチ結果」とコンテキストに基づいて、読者の心を動かす極めて質の高いコンテンツ(${format}フォーマット)を生成してください。
「私が考えたキャプションです」「AIとしての提案です」などの言葉は絶対に使わず、ビジネスオーナーや店舗スタッフが直接顧客に語りかける自然なテキストを完成品として出力してください。

※最重要指令: 生成するたびに前回の出力パターンを完全に捨て去り、【毎回全く異なる切り口、異なる語り口、異なるストーリー展開、異なるオファーの出し方】をして、ユーザーを飽きさせないクリエイティブなテキストを書き下ろしてください。テンプレ化は厳禁です。

# リサーチ活用の絶対ルール
- research.audience_tension / research.non_obvious_angle / research.scroll_stopper / research.save_worthy_action を必ず投稿の骨格に反映してください。
- 「価格競争から脱却」「価値を伝える」「顧客体験を再設計する」だけで終わる投稿は禁止です。必ず、読者が明日触れるWebページ、初回ヒアリング、見積書、導入事例、商品説明、購入後フォローなどの具体的な接点へ落としてください。
- research.avoid_angles に含まれる切り口は使わないでください。
- ユーザー提供にない「DEARS CONSULTINGが実際に支援した」「クライアント企業で実践した」「広告費を35%削減した」「売上2.8倍」等の実績・成果は絶対に書かないでください。
- 自社実績を語れない場合は「実績」ではなく、「よくある構造」「見直し手順」「チェックリスト」「仮説検証」として書いてください。

# Instagram文体の絶対ルール
- 難しい内容を、経営者が朝の移動中にスマホで読める文章にしてください。
- 「貴社」「弊社」「有形資産」「無形資産」「貸借対照表」「B/S」「客観的に評価」「戦略的に高める」「不可欠です」「ブランド資産」「情緒的価値」は使用禁止です。
- 必要な専門語は1投稿につき2つまでに抑え、すぐに日常語で言い換えてください。
- キャプションは500〜800字を目安にし、スマホで読みやすい短い段落で構成してください。カルーセルで伝えられる内容を本文に詰め込みすぎないでください。
- 1文は短く。硬い断定より、読者の現場に寄り添う自然な言い方にしてください。
- 「これは、〜です。」「〜することが不可欠です。」の連続は禁止です。リズムを作ってください。
- 投稿者は高圧的なコンサルではなく、事業者の隣で整理を手伝う伴走者として話してください。
- 冒頭は20〜45文字程度の「あるある」や違和感から入ってください。例:「いい商品なのに、価格で比べられることがあります。」
- 「DEARS CONSULTINGでは」は最後のCTA段落で最大1回だけ使用可。本文の主語は読者の現場に置いてください。
- 画像上の overlay_copy は全角15〜24文字以内、最大2行、1枚1メッセージにしてください。スマホで読めない長文は失敗です。

# ★★★最重要★★★ 投稿品質の絶対基準（このプロジェクトの命）

このプロジェクトでは、以下の3つの失敗パターンを徹底排除します。違反した投稿は生成失敗とみなします。生成を開始する前にこの3つを必ず確認してください。

## ❌ 失敗パターン1: スピリチュアル/マインドセット化
読者は実務に使える情報を求めています。哲学・美学・思想・魂・本質・存在意義・内なる声・無意識・静寂・余白・在り方・らしさ・覚悟・解像度・選ばれる理由・不可欠性・代替不可能などの抽象語を多用すると、ターゲットの経営者から「実務に関係ない」と即座にスワイプされます。

→ 抽象語クラスター（哲学/美学/思想/魂/本質/存在意義/内なる声/無意識/静寂/余白/在り方/らしさ/覚悟/解像度/選ばれる理由/不可欠性/代替不可能/世界観/ストーリー/物語/共感/共鳴/レガシー）の使用は1投稿につき**合計2語まで**。それ以上はスピリチュアル化として失敗扱い。

## ❌ 失敗パターン2: 個人エピソード起点エッセイ
「先日〜に行きました」「朝の散歩で気づきました」「個展で作品を見て」「読書で感じた」「クライアントとの対話でふと気づいた」型の個人体験起点エッセイは禁止。「これはビジネスにも全く同じことが言えます」型の哲学敷衍構文も禁止。

## ❌ 失敗パターン3: 数値→哲学転回（実投稿で発生したパターン）
データや数字を冒頭に出した後、人間哲学・非合理価値・抽象的なブランド概念に橋渡しする構文は禁止。これは「具体性のフリ」をしながら結局スピリチュアル化する典型的な失敗です。

悪い例:
- 「AIによる市場分析の精度は90%超、それでも残る10%の『非合理的な信頼』がブランドの生命線です」（数値→哲学転回）
- 「業界の代替率は78%、しかし最後に人を動かすのは数字ではなく、企業の独自の美学です」（数値→美学転回）
- 「データはあくまで手段、本当に重要なのは経営者の覚悟と思想です」（データ否定→哲学転回）

良い例（同じ数値を使った実務化）:
- 「AI市場分析の精度90%超 → 残りの10%（自社の顧客特性に特化したセグメント解釈）を埋める3つの分析手順」（数値→具体的手順）
- 「業界代替率78%の中で、上位22%が共通して持っていた3つの実装パターン」（数値→具体パターン）

→ 数字を提示したら、必ず実装手順 / 運用テクニック / 業務プロセス に直結させること。「人間にしか出せない価値」「哲学」「美学」「思想」への転回は禁止。

## ✅ すべての投稿が満たすべき具体性アンカー（最低2つ以上必須）
1. 具体的な数字（年商・%・倍率・期間・人数・価格など。ただし架空数字の捏造は別途禁止、業界レンジで表現）
2. 業種・業態の固有名詞（化粧品メーカー / 地方旅館 / 士業事務所 / SaaS企業 等）
3. 業務プロセスの手順（Step 1〜3形式、チェックリスト形式）
4. 実在するツール / フレームワーク / 書籍 / 調査機関の名前
5. Before / After の具体的な差分

これら2つ以上を必ず含める。含まれない投稿はスピリチュアル化として失敗扱い。

# 【絶対厳守の禁止事項（絵文字の完全禁止）】
- **いかなる場合でも、文中に絵文字（Emojis）や顔文字を絶対に１つも使用しないでください。**
- 洗練されたプロフェッショナルな印象を与えるため、使用できる記号は一般的な句読点（、。！？「」【】『』など）や箇条書きのハイフン・ナカグロ（・）のみです。
- このルールは他のすべてのルールよりも優先されます。

# 【絶対厳守の禁止事項（上から目線・断定的な物言いの禁止）】
- **「〜だ」「〜である」「〜せよ」「〜しろ」「〜すべきだ」「〜に決まっている」など、読者に対して上から目線・高圧的・説教的に感じられる表現は一切使用禁止です。**
- 代わりに「〜です」「〜ます」「〜してみませんか」「〜かもしれません」「〜ではないでしょうか」など、読者と対等な目線で丁寧に語りかける表現を使ってください。
- 画像上のテキスト（overlay_copy）やキャッチコピーでも同様に、命令口調や断定口調ではなく、共感・提案・問いかけのトーンにしてください。
- このルールはキャプション、overlay_copy、carousel_slidesのすべてのテキスト出力に適用されます。

# 【絶対厳守の禁止事項（抽象的・哲学的コピーの禁止）】
- **overlay_copyやcarousel_slidesの見出しに、「美学」「本質」「哲学」「真髄」「至高」「極み」「物語」などの抽象的・哲学的な言葉だけで構成されたコピーは絶対に使用禁止です。**
- 読者が見た瞬間に「何のサービスか」「自分にどんなメリットがあるか」が伝わる具体的な内容にしてください。
- 良い例:「いい商品なのに、価格で比べられる」「説明を足すほど、伝わりにくい」「初回相談で聞くことを変える」
- 悪い例:「美学を、語り合いませんか」「本質を追求する」「あなたの物語」
- 具体的な数字、悩み、行動、サービス名、ビフォーアフターなどを積極的に盛り込んでください。

# 【絶対厳守の禁止事項（経営者ポエム・問いかけ系の禁止）】
- **読者（経営者・ビジネスパーソン）の内面・心理・人生観に「問いかける」タイプの投稿は絶対に禁止します。** これは特にBtoBコンサルティング・士業・経営支援系の業種で AI が陥りがちな失敗パターンです。
- 以下のフォーミュラ（型）に該当するコピーは、たとえ業種がコンサル系でも、絶対に作らないでください:
  - 「〜を達成した、その先に [問いかけ]」（例: 「売上目標を達成した、その先に広がる景色とは？」）
  - 「〜の先に、本当に [理想・願い]」（例: 「売上目標の先に、本当に描きたい世界はありますか？」）
  - 「〜は満たされていましたか？」「〜に虚しさを感じていませんか？」
  - 「100年後、〜は何を遺しますか？」「100年後の [事業・会社] 〜」
  - 「経営者の本当の願い」「人生で本当に求めるもの」「達成しても満たされない」系の内省的問いかけ
- 禁止する具体的な単語クラスター: 「達成後の虚しさ」「100年後」「燃える」「遺す」「満たされる」「描きたい世界」「本当に求めるもの」「内なる声」「人生の意味」
- **代わりに以下のような実用的・具体的な内容を出力してください:**
  - 数字・データ・事例で語る業界知識（例:「コンサル業界の単価平均は◯円」「導入企業の◯%が3ヶ月で◯◯改善」）
  - 業務で使える具体的なノウハウ・手順・チェックリスト（例:「初回商談でやるべき3ステップ」）
  - 業界用語・専門知識の解説（例:「ストラテジーマップとは？図解で5分」）
  - 具体的なツール・書籍・リソースの紹介
  - 経営者の日常的なエピソード（朝のルーティン、読書、健康習慣等）— ただし「人生観」「哲学」に発展させない
- このルールは他の禁止事項と同等に優先されます。違反した場合、その投稿は失敗とみなされます。

# 【絶対厳守の禁止事項（個人的エピソード起点のエッセイ化禁止）】
- 「先日、〇〇に行きました」「散歩で気づきました」「個展で作品を見て」「読書で感じたこと」「対話でふと気づいた」のような個人的体験を起点に、そこから抽象的な気づき・ビジネスへの敷衍へと展開するエッセイ/ブログ風の構成は絶対に禁止します。
- 失敗の典型構造: 個人的エピソード冒頭 → 個人的感情・気づき → 「これはビジネスにも全く同じことが言えます」 → 抽象論で締める → スピリチュアル化
- 悪い例（実投稿で実際に発生したパターン）:
  - 「先日、敬愛する現代アーティストの個展に足を運びました。たった一本の線で描かれた作品の前に立ったとき、作家の膨大な思索と哲学、そして情熱の積み重ねに圧倒されたのです。これは、企業ブランディングにおいても全く同じことが言えます」
  - 「朝の散歩で気づいたのです。経営者が毎朝同じ道を歩く理由を」
  - 「あるクライアントとの対話で、ふと気づきました。本当のブランドとは...」
- VARIETY_ANGLES に「経営者の日常・人間味のある話題」テーマがある場合でも、以下を厳守:
  - 「朝のルーティン」「使っているツール」「読書習慣」等は、具体的なツール名・書籍名・時間配分・所要分・効果数値などを必ず含めて「実用情報」として書くこと。
  - 「気づき」「感想」「人生観」「内省」への発展は禁止。読者がそのまま真似できる具体的なノウハウのみで構成すること。
  - 「これは事業/ブランディングにも言える」のような敷衍構文は禁止。日常テーマは日常テーマで完結させる。
- 良い例（同じ「経営者の日常」テーマでも実用化された書き方）:
  - 「経営者の朝ルーティン3選: ニュースキュレーション(NewsPicks 15分) / 業界レポート読破(20分) / Slack整理(10分)」
  - 「経営者がよく購読しているビジネス書のジャンル分布(過去6ヶ月、サブスク型サービス3社の集計)」
  - 「Zoom疲れを軽減する3つの具体策: 会議の合間に5分歩く / 画面オフ会議の解禁 / 30分単位の予定枠化」

# 【絶対厳守の禁止事項（スピリチュアル系・マインドセット系・自己啓発系の語彙禁止）】
- 投稿が「ふわふわしたコーチング・スピリチュアル系のアカウント」のように見える失敗パターンを徹底排除します。これは BtoB コンサル・士業・経営支援系で頻発する失敗で、ターゲットの経営者からは「実務に使えない」「自分には関係ない」と即座にスワイプされる致命的な品質劣化を引き起こします。
- 以下のスピリチュアル/マインドセット系の語彙クラスターは、**1投稿につき合計で2語まで**しか使用を許可しません。それ以上の連発は禁止です:
  - 「不可欠性」「不可欠な存在」「Indispensability」「代替不可能」（ブランド固有用語として最大1回まで）
  - 「美意識」「美学」「審美眼」「真髄」「極み」「至高」（抽象的に1単独使用は禁止、具体例とセットでのみ）
  - 「思想」「哲学」「魂」「本質」「核」「源泉」「DNA」（抽象的単独使用は禁止）
  - 「無意識」「深層心理」「内なる声」「内なる思想」「胸の奥」「心の奥底」
  - 「静寂」「余白」「侘び寂び」「気配」「佇まい」（具体的なサービスや製品の文脈なしでは使用禁止）
  - 「存在意義」「存在そのもの」「あり方」「生き方」「在り方」「らしさ」「自分らしさ」
  - 「物語」「ストーリー」「世界観」「レガシー」「共感」「共鳴」（単独で多用禁止、具体例必須）
  - 「覚悟」「解像度」「向き合う」「腹落ち」「言語化」（実務文脈を伴わない単独使用は禁止）
  - 「選ばれる理由」「選ばれ続ける」「指名される」（抽象的な単独使用は禁止、具体的な施策・数字とセットで使う場合のみ可）
- **悪い例（スピリチュアル化した文）**:
  - 「経営者の内なる声と、顧客の心の奥底にある願いが、静かに重なり合った時に訪れるものです」
  - 「事業の核となる思想を抽出し、表面的なデザインではなく、存在そのものをデザインします」
  - 「不可欠性とは、顧客の心を動かす仕組みから生まれます」
  - 「静寂の中から始まる、貴社だけの不可欠性を見つけ出す対話」
- **良い例（同じテーマを実務語で書き直し）**:
  - 「単価40万円のサービスを"指名買い"してもらう、初回商談3ステップ」
  - 「広告費を月50万円→0円にした老舗旅館の、施策と数字」
  - 「価格交渉が一切発生しないブランドの作り方（製品パッケージの再設計4手順）」
  - 「リブランディング前後の客単価変化（業種別の参考データ3例）」
- **必須条件**: すべてのカルーセル投稿で、以下の「具体性アンカー」のうち**最低2つ以上**を必ず含めてください:
  1. 具体的な数字（年商・%・倍率・期間・人数・価格・面積など）※ただし次の「架空数字の捏造禁止」ルールに従い、ユーザー提供情報に基づくか、業界一般のレンジ表現（例:「年商数千万〜数億円規模」「単価10〜30万円帯」）に留めること。根拠不明の特定数値（「73%が回答」「2.8倍に増加」等）の創作は厳禁。
  2. 業種または業態の固有名詞（化粧品メーカー、地方旅館、士業事務所、SaaS企業 等）
  3. 業務プロセスの手順（Step 1〜3形式、チェックリスト形式）
  4. 実在する/実在しうるツール・フレームワーク・書籍・調査機関の名前
  5. ビフォーアフターの具体的な差分（数字・行動・反応）
- これら2つ以上のアンカーが無い投稿は「スピリチュアル化」とみなし、生成失敗です。

# 【絶対厳守の必須事項（投稿の骨格を実務化する補強ルール）】

## ルールA: 各投稿の最初に「誰が・何を・どう変えるか」を1文で明記
- カルーセル1枚目の overlay_copy または text に、以下の構造を1文以上含めること:
  - 構造: 「[対象の業種・属性] が、[直面している実務課題] のために、[実行できる具体的な行動]」
  - 良い例:「年商1〜5億のBtoB企業が、問い合わせ単価を下げるために、導入事例ページを再設計する」
  - 良い例:「地方の老舗旅館が、客単価を上げるために、宿泊プランの体験設計を見直す」
  - 悪い例:「経営者が、不可欠な存在になるために、内なる思想と向き合う」（対象が広すぎ・行動が抽象）

## ルールB: カルーセル各スライドに最低1つ「検証可能な具体物」を含めること
- 検証可能な具体物とは: KPI名、業務プロセス名、ツール名、施策名、顧客属性、比較対象、業界用語、数字レンジ、業種固有名詞 等
- 各スライドの text または overlay_copy のどこかに必ず1つ以上含める
- 「思想」「美意識」「不可欠性」のような抽象概念は具体物にはカウントしない

## ルールC: カルーセル3枚の推奨構造テンプレ（強く推奨）
- **1枚目（フック）**: よくある失敗 / 業界の盲点 + 対象業種を明示
  - 例:「士業サイトで『信頼感』を語るほど、問い合わせ率が落ちる理由」
  - 例:「化粧品メーカーが新規顧客にリピートされない、よくある3つの構造的問題」
- **2枚目（本論）**: 原因を業務プロセス・数字・顧客行動で分解
  - 例:「比較検討者は3社を30秒で見比べ、料金・実績・対応範囲を確認する」
  - 例:「初回購入から2回目までの離脱率が業界平均で65%、その大半は1〜3日以内の体験設計に起因」
- **3枚目（解決・CTA）**: 改善手順 + Before/After + 行動誘導
  - 例:「Before: 理念中心の自己紹介 → After: 対応業種一覧+料金目安+事例3件+初回相談導線」
  - 例:「Step 1: 商品説明から5つの感情ワードを抽出 / Step 2: 顧客接点別に翻訳 / Step 3: 月1回の検証MTG」
- この型から外れる場合でも、必ず「失敗→分解→改善手順」または「課題→事例→打ち手」の論理が通る構成にすること

## ルールD: 「3ステップ」と書いたら、3枚すべてをステップ化する
- caption に「3ステップ」「3つの具体的なステップ」「3手順」「3工程」と書く場合、carousel_slides の1枚目から3枚目は必ず Step 1 / Step 2 / Step 3 そのものにすること。
- 各見出しは overlay_copy 冒頭に「1.」「2.」「3.」で明記すること。text だけに隠してはいけない。
- 「3ステップ」と言いながら、スライドが表紙・タイトル・まとめだけで終わる構成は禁止。これはキャプションと画像の不一致として生成失敗です。
- 3枚構成で問題提起・原因・解決を語るだけなら、「3ステップ」ではなく「3つの観点」「3つの構造」「3枚で整理」と表現すること。

# 【絶対厳守の禁止事項（架空の事実・イベント・数字の捏造禁止）】
- **ユーザーから提供されていない「具体的な事実情報」を絶対に創作してはいけません。** 以下は特に頻繁に発生する捏造パターンで、固く禁止します:
  - **架空のイベント開催:** 「セミナーを開催します」「ウェビナー開催決定」「来月◯◯セミナーを開催」「特別講座開催」「説明会を実施」「新セミナーを企画しました」など、ユーザー入力に存在しないイベント情報の創作
  - **架空の新サービス・新商品:** 「新サービスをリリース」「新商品発表」「新プラン開始」など、ユーザーが言及していないリリース情報
  - **架空の統計・調査結果:** 「73%の経営者が…と回答」「過去5年で2.8倍に増加」「78%がAIで代替可能」など、出典が明示できない具体的な％・倍数・年数の数字
  - **架空の事例・実績:** 「あるクライアントは売上が30%増加」「申込数が1.7倍になった」など、ユーザー提供以外の具体的成果数値
  - **架空の期間限定キャンペーン:** 「席数限定」「先着◯名様」「期間限定」など、実在しないオファー
- ユーザーが提供したコンテキスト（textContext / userProfile / siteContent）に明示的に書かれている事実のみを使ってください。書かれていない情報は「一般論」「思考の枠組み」「考え方」として記述し、具体的な数字・イベント・固有の実績の言及は避けてください。
- CTA も「セミナーへ」「お申込みは」のようなイベント誘導ではなく、「プロフィールのリンクから詳細をご覧ください」「お気軽にご相談ください」など、ユーザー提供のWebサイト/SNS URLへの誘導に統一してください。
- このルールに違反した投稿は虚偽広告となり、ユーザーのビジネスに深刻なダメージを与えます。最優先で遵守してください。

## 数字使用の三層ルール (これに従わないと捏造が起きる)

実際にAIが過去に生成した捏造例:
- 「小学生のスクリーンタイム、28.6%が3時間以上」← こども家庭庁の実数は 61.7%。28.6% は実在しない数字
- 「73%の経営者が哲学を重視と回答」← 出典確認不可能、調査自体が架空
- 「過去5年で2.8倍に増加」← 出典なし、根拠不明
- 「申込数が1.7倍になった」← ユーザー提供のない自社実績の創作
- 「78%がAIで代替可能」← 元データ確認できない断定

これらは "それっぽい" 数字に見えても、実際の統計と一致せず、虚偽広告として SNS で発信すると企業の信用毀損につながります。

数字を投稿に含めたい場合は、以下の三層を厳格に守ってください:

### 層1 (推奨): 出典を明示できる場合のみ具体数字を使う
- 「こども家庭庁 令和7年度調査によると、小学生のインターネット利用時間が3時間以上の割合は61.7%」
- 「経済産業省◯◯白書(2025年版)では…」
- 出典機関名と発表年(月) を必ず明示。出典なしで具体的な %・倍率・年数を書くことは禁止。

### 層2 (代替推奨): 出典が示せない場合は範囲表現に置き換える
- ❌ 「28.6%が3時間以上」 → ✅ 「調査によっては、長時間のメディア利用が一定数みられます」
- ❌ 「2.8倍に増加」 → ✅ 「ここ数年で着実に増えている傾向」
- ❌ 「73%が回答」 → ✅ 「多くの経営者から、同様の声が聞かれます」
- ❌ 「申込数が1.7倍に」 → ✅ 「申込数が大きく伸びた事例があります」
- 範囲表現の例: 「ある調査では」「一般に〜と言われる」「業界では指摘されている」「過半数」「3割前後」「数倍規模」「ここ数年」「傾向として」

### 層3 (絶対禁止): 出典を伴わない断定的な数字の創作
- 出典機関名なしで「N%」「N倍」「N年で」「N件」のような決め打ちの数字を書くことは絶対禁止。これは虚偽広告です。
- 「研究では」「調査では」「最新データによると」のような曖昧な前置きで具体数字を出すことも禁止 (Geminiが頻繁にやる失敗パターン)。

### 自己チェック必須
キャプションを生成した後、自分の出力に含まれる%・倍率・年数の数字をすべて確認し、出典機関名と発表年が明示されているか確認すること。明示されていない数字は範囲表現に必ず書き換えてからJSONを出力すること。

${formatInstruction}

# 【最重要】発信者と読者（誰から誰へのメッセージか）
- 発信者 (You): 自店舗・自社ブランドの現場スタッフ、またはオーナー（中の人）です。
- 読者 (Reader): その商品やサービスに興味を持ちうる、来店・購入見込みのある一般ユーザーや顧客です。
※警告: **絶対に「同業者に向けたビジネス哲学」や「SNS運用者向けのマーケティング論や集客ノウハウ」「他社のSNS運用を代行するサービスのアピール」を語らないでください。** あなたの唯一の使命は、「自分たちのお店やサービス（＝入力されたURLや業種の店舗）に読者を惹きつけ、来店・購入やファン化させるためのBtoC（またはBtoB）の魅力発信・宣伝メッセージ」を書くことです。画像に乗せるテキスト（overlay_copy）も、彼ら（見込み客）の興味を惹く強烈なキャッチコピーにしてください。
`;

        const dynamicContext = `
# 前提
- プラットフォーム: ${platformId}
- 業種: ${category?.label}
- ターゲット: ${targetLabel} (${gender})
- トーン&マナー: ${tone?.label || tone}
- 言語仕様: ${languageInstruction}

# 発信者と読者（具体）
- 発信者: 「${category?.label}」を運営する自店舗・自社ブランド
- 読者: 「${targetLabel} (${gender})」の見込み客

# 【最重要】投稿の目的（Purpose）
あなたの今回の執筆のゴールは以下の通りです。このゴールが達成される（ユーザーが行動を起こす）ようにキャプション構成や訴求内容をフルカスタマイズしてください。
- ゴール: **${goalText}**

# ユーザー固有コンテキスト（超重要）
この投稿は以下の「特定のビジネス」からのメッセージとして作成してください。
- 実際の業種・ビジネス内容: ${userProfile.industry || '未設定'}
- メインの顧客層（具体的なターゲット）: ${userProfile.targetAudience || '未設定'}
- 自社の強み / 競合との差別化ポイント: ${userProfile.usp || '未設定'}

# リサーチ結果・商材情報
- ① 世の中のトレンド: ${research.insight_macro}
- ② 業界のトレンド: ${research.insight_industry}
- ③ ターゲット層のトレンド: ${research.insight_target}
- 総合アプローチ方針: ${research.insight_summary}
- 読者の具体的な葛藤: ${research.audience_tension || '未設定'}
- 一般論ではない切り口: ${research.non_obvious_angle || '未設定'}
- 1枚目で止める違和感: ${research.scroll_stopper || '未設定'}
- 保存される実行アクション: ${research.save_worthy_action || '未設定'}
- 避けるべき切り口: ${Array.isArray(research.avoid_angles) ? research.avoid_angles.join(' / ') : (research.avoid_angles || '未設定')}
- 根拠メモ: ${Array.isArray(research.evidence_notes) ? research.evidence_notes.join(' / ') : (research.evidence_notes || '未設定')}
- 自社・ブランド名: ${textContext?.companyName || '特になし'}
- 訴求ポイント: ${textContext?.sellingPoint || '特になし'}
${siteContent ? `- サイト情報: ${siteContent.substring(0, 1000)}` : ''}
${textContext?.companyName ? `\n※重要事項1: 内容の中立性を保ちつつ、不自然にならないように「${textContext.companyName}」という名前を適度に織り込んでください。` : ''}
${textContext?.websiteUrl || textContext?.snsUrl ? `\n※重要事項2: 最後のCTAで、「${textContext.snsUrl || textContext.websiteUrl}」など、読者に行動を促す動線（プロフィールリンクやURLへの誘導）を自然な形で必ず配置してください。` : ''}

ランダムシード: ${Date.now()}_${Math.random()}
`;

        const prompt = STATIC_PREFIX + dynamicContext;

        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: TEXT_MODEL,
                contents: prompt,
                config: {
                    temperature: 0.95, // 多様性を最大化
                    tools: [{ googleSearch: {} }] // ← 投稿内容生成時にもネットの最新情報を統合
                }
            });
        });

        // 📊 暗黙キャッシュヒット率モニタリング
        const usage = response.usageMetadata;
        if (usage) {
            const cached = usage.cachedContentTokenCount || 0;
            const total = usage.promptTokenCount || 0;
            const hitRate = total > 0 ? Math.round((cached / total) * 100) : 0;
            console.log(`[generatePost:${format}] cache: ${cached}/${total} tok (${hitRate}% hit)`);
        }

        let generatedPost = normalizeGeneratedPostLanguage(extractJSON(response.text), language);
        if (hasCarouselStepMismatch(generatedPost, format)) {
            console.warn('[generatePost] carousel step mismatch detected; attempting repair');
            try {
                generatedPost = normalizeGeneratedPostLanguage(
                    await repairCarouselStepNarrative(ai, generatedPost, overlayLangLabel),
                    language
                );
            } catch (repairError) {
                console.error('[generatePost] carousel step repair failed:', repairError?.message || repairError);
            }
        }

        if (hasCarouselStepMismatch(generatedPost, format)) {
            console.warn('[generatePost] carousel step mismatch remained after repair; softening step promise');
            generatedPost = softenCarouselStepPromises(generatedPost);
        }

        let qualityIssues = detectUnsafeCopyIssues(generatedPost, language);
        if (qualityIssues.length > 0) {
            console.warn('[generatePost] unsafe copy detected; attempting repair:', JSON.stringify(qualityIssues).slice(0, 300));
            try {
                generatedPost = normalizeGeneratedPostLanguage(
                    await repairUnsafePostCopy(ai, generatedPost, language, textContext, userProfile, qualityIssues),
                    language
                );
                qualityIssues = detectUnsafeCopyIssues(generatedPost, language);
            } catch (repairError) {
                console.error('[generatePost] unsafe copy repair failed:', repairError?.message || repairError);
            }
        }

        if (qualityIssues.length > 0) {
            console.warn('[generatePost] unsafe copy remained after repair; marking as blocked:', JSON.stringify(qualityIssues).slice(0, 300));
            generatedPost.quality_blocked = true;
            generatedPost.quality_issues = qualityIssues;
        }

        return generatedPost;
    } catch (error) {
        console.error("generatePost error:", error);
        throw new Error("投稿内容の生成に失敗しました。");
    }
}

/**
 * 校閲者役 (Phase 2): 生成された画像を Gemini Vision で監査。
 * - 画像内に文字 / 看板 / ラベル等が混入していないかチェック
 * - 黒背景だけ、抽象CG、AIっぽい不自然さをチェック
 * - スライドの overlay_copy と画像内容の整合性スコア (0-100)
 *
 * 戻り値: { hasText, isBlankOrDark, looksAI, alignmentScore, issues[], skipped, error }
 * 失敗時は { hasText: false, alignmentScore: 70 } を返して上位処理を継続させる (品質ゲートを過剰に厳格にしない)。
 */
export async function auditSlideImage(rawImageUrl, slideOverlay = '', slideText = '') {
    try {
        if (!rawImageUrl) return { hasText: false, isBlankOrDark: false, looksAI: false, alignmentScore: 70, issues: [], skipped: true };

        // 画像をフェッチして base64 化 (Gemini Vision の inline_data 用)
        const imgResp = await fetch(rawImageUrl);
        if (!imgResp.ok) throw new Error(`image fetch ${imgResp.status}`);
        const arrayBuf = await imgResp.arrayBuffer();
        const base64 = Buffer.from(arrayBuf).toString('base64');

        const prompt = `Audit this image for a Japanese B2B Instagram carousel slide.

Slide overlay text (to be overlaid later as Japanese text on top): "${slideOverlay}"
Slide body context: "${slideText}"

Evaluate on 4 critical criteria.

1. TEXT CONTAMINATION (CRITICAL — must catch this):
   Does the image itself contain ANY visible text, letters, numbers, signs, labels, words, captions, watermarks, or readable typography of any language (Japanese kanji/kana, English alphabet, numerals)?
   - "yes" if you can read or identify ANY rendered text in the image
   - "no" only if the image is completely free of typography

2. ALIGNMENT SCORE (0-100):
   How well does the image visually reinforce the slide's specific message?
   - 100 = perfectly visualizes the exact concept stated in the overlay
   - 80 = strong, realistic, on-topic visual with clear relevance
   - 60 = somewhat related but generic
   - 40 = loosely related
   - 0 = unrelated, contradictory, or hallucinated

3. BLANK / DARK FAILURE:
   Mark isBlankOrDark=true if the image is mostly black, nearly empty, text-only-looking, has no meaningful photographic subject, or would appear as a black square behind overlay text.

4. AI-LIKE / SYNTHETIC FAILURE:
   Mark looksAI=true if the image looks like CGI, 3D render, fantasy/surreal composition, glowing particles, abstract brain/data art, impossible objects, distorted hands/faces, plastic skin, or an obviously synthetic stock-photo hallucination.

Output strictly as JSON:
{"hasText": true|false, "isBlankOrDark": true|false, "looksAI": true|false, "alignmentScore": 0-100, "issues": ["..."]}`;

        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: RESEARCH_MODEL, // gemini-2.5-flash (multimodal対応)
                contents: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64 } },
                    { text: prompt }
                ],
                config: { temperature: 0.2 } // 採点は安定性優先
            });
        });

        const parsed = extractJSON(response?.text || '');
        if (!parsed || typeof parsed.alignmentScore !== 'number') {
            return { hasText: false, alignmentScore: 70, issues: ['audit parse failed'], error: 'parse' };
        }
        return {
            hasText: !!parsed.hasText,
            isBlankOrDark: !!parsed.isBlankOrDark,
            looksAI: !!parsed.looksAI,
            alignmentScore: Math.max(0, Math.min(100, parsed.alignmentScore)),
            issues: Array.isArray(parsed.issues) ? parsed.issues : []
        };
    } catch (e) {
        console.error('[auditSlideImage] error:', e?.message);
        return { hasText: false, isBlankOrDark: false, looksAI: false, alignmentScore: 70, issues: [], error: e?.message };
    }
}

/**
 * 品質監督役 (Phase 3): OpenAI GPT-5-mini でキャプション全体をファクトチェック。
 * - 出典なしの具体数字 (捏造)
 * - スピリチュアル/マインドセット系語彙の過剰使用
 * - 架空のイベント・キャンペーン
 * - 個人エピソード起点エッセイ
 *
 * OPENAI_API_KEY が無い場合は skip (Pro Max 限定機能のため)。
 * 失敗時は passed=true (ゲート開放) を返す — 監督役の障害で投稿停止を起こさない。
 */
export async function factCheckPost(caption = '', slides = [], language = 'ja') {
    const localIssues = detectUnsafeCopyIssues({ caption, carousel_slides: slides }, language);
    if (localIssues.length > 0) {
        return { passed: false, issues: localIssues, source: 'local' };
    }

    if (!process.env.OPENAI_API_KEY) {
        return { passed: true, issues: [], skipped: true, reason: 'OPENAI_API_KEY not set' };
    }
    try {
        const slideSummary = (slides || []).map((s, i) =>
            `Slide ${i + 1}: overlay="${s?.overlay_copy || ''}", text="${s?.text || ''}"`
        ).join('\n');

        const systemPrompt = `あなたは日本のBtoB向け Instagram 投稿のファクトチェッカーです。以下の10個の違反パターンを検出してください。
1. fabricated_stat: 出典機関名と発表年が明示されていない具体数字 (例: "73%", "2.8倍", "+30%向上", "1.5倍に増加")
2. spiritual_overuse: スピリチュアル系語彙の過剰使用 (魂・不可欠性・本質・思想・内なる声・静寂・余白・在り方・らしさ・覚悟・選ばれる理由 等。1投稿で合計3個以上なら違反)
3. fake_event: 実在しないイベント・セミナー・キャンペーン・新サービス開始の言及
4. personal_anecdote: 「先日〜に行きました」「散歩で気づいた」型の個人エピソード起点
5. unsupported_case_study: ユーザー提供にない「実際に支援した」「伴走支援した」「クライアント企業で実践」「導入企業で成果」などの自社/顧客実績表現
6. unsupported_metric: 出典なしの成果数値・割合・倍率 (例: "EC売上2.8倍", "広告費35%削減", "顧客満足度95%")
7. language_contamination: 日本語投稿に英語翻訳セクションや長い英文が混入している
8. hard_whitepaper_style: Instagram投稿として硬すぎる提案書・白書・会計資料口調 (例: "貸借対照表", "B/S", "無形資産", "客観的に評価", "中長期的", "不可欠", "貴社")
9. generic_value_marketing_drift: 「価格競争」「感情価値」「スペック」「共感」「心が動く」「選ばれる理由」などの一般的な価値訴求に寄りすぎ、具体的な実務接点が薄い
10. overlay_too_long: 画像上の overlay_copy が全角24文字を超える、または1枚に複数メッセージを詰め込みすぎてスマホで読みにくい

JSONのみで応答。説明文不要。`;

        const userPrompt = `## 検査対象

### Caption
${caption}

### Slides
${slideSummary}

## 出力形式 (JSON厳守)
{
  "passed": true/false,
  "issues": [
    { "type": "fabricated_stat|spiritual_overuse|fake_event|personal_anecdote|unsupported_case_study|unsupported_metric|language_contamination|hard_whitepaper_style|generic_value_marketing_drift|overlay_too_long", "excerpt": "問題の該当文(短く)", "reason": "なぜ違反か" }
  ]
}

issuesが空配列なら passed=true、1つでも検出されたら passed=false にすること。`;

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-5-mini', // ファクトチェック用途には十分・低コスト
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' }
            })
        });

        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`OpenAI ${res.status}: ${errBody.slice(0, 200)}`);
        }
        const json = await res.json();
        const content = json?.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(content);
        return {
            passed: parsed.passed !== false, // 不明なら通す
            issues: Array.isArray(parsed.issues) ? parsed.issues : []
        };
    } catch (e) {
        console.error('[factCheckPost] error (skipping gate):', e?.message);
        return { passed: true, issues: [], error: e?.message };
    }
}

/**
 * 編集者役: スライド本文 (overlay_copy + text) を読み、そのスライド固有の
 * 視覚的メッセージに tightly-aligned な英語の image_hint_en を Gemini Flash で再構築。
 *
 * 背景: generatePost が一回の呼び出しで caption + slides + image_hint_en を全部
 * 生成すると、image_hint_en がスライド本文と緩い結合になりがち（チェス画像が
 * 「3ステップBefore/After」に出る等）。これを slide ごとに focused 生成し直す。
 *
 * 失敗時 (API エラーや空応答) は fallback を返し、既存の image_hint_en を温存する。
 */
export async function refineSlideImageHint(overlayCopy, slideText, fallback = '') {
    try {
        if (!overlayCopy && !slideText) return fallback || '';
        const prompt = `You are a realistic photo editor for premium Japanese Instagram carousel posts. Given a single slide's text content, generate a precise English image prompt that DIRECTLY visualizes the slide's main message as a believable real-world photograph, not AI art.

Slide overlay (the headline text shown on the image):
"${overlayCopy || ''}"

Slide body text (additional context):
"${slideText || ''}"

Requirements:
- 40-60 English words
- Must visually communicate THE EXACT specific message of this slide, not a generic version
- Use a natural Japanese service, retail, hospitality, craft, product, storefront, customer touchpoint, or quiet consultation setting
- Use realistic camera language: natural window light, ordinary materials, human-scale composition, slight real-life imperfection, clean negative space for overlay copy
- If the slide mentions "3 steps" / "3つのステップ", show 3 simple real objects or service touchpoints in a believable scene, not fantasy symbols
- If the slide mentions "Before / After" / "ビフォーアフター", show a subtle realistic contrast or arrangement, not a split-screen graphic
- If a specific industry is named (e.g. SaaS / 旅館 / 化粧品メーカー / 士業), reflect that industry's environment
- If a specific action or process is described, show that action being performed
- If a specific failure pattern is named, show the realistic customer or service situation behind it
- ABSOLUTELY NO text, letters, numbers, signs, labels, captions, watermarks, logos anywhere in the image
- No books, documents, screens, whiteboards, charts, diagrams, posters, packaging labels, or UI with readable writing
- No CGI, 3D render, illustration, surreal/fantasy scene, glowing particles, neon sci-fi, abstract brain/data graphics, impossible objects
- Avoid uncanny AI artifacts: distorted hands/faces, plastic skin, overly perfect studio stock-photo staging
- Natural documentary/editorial photography style, 4:5 portrait composition
- Avoid generic stock-photo cliches (no plain desk + laptop + coffee unless the slide explicitly needs them)

Output ONLY the English image prompt itself. No prefix, no explanation, no quotes around it.`;

        const ai = getAI();
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: RESEARCH_MODEL, // gemini-2.5-flash (低コスト、高速)
                contents: prompt,
                config: {
                    temperature: 0.7, // 多様性は適度に、整合性を優先
                }
            });
        });

        const refined = (response?.text || '').trim();
        if (!refined || refined.length < 20) {
            console.warn('[refineSlideImageHint] empty/too-short response, using fallback');
            return fallback || '';
        }
        return refined;
    } catch (e) {
        console.error('[refineSlideImageHint] error, using fallback:', e?.message);
        return fallback || '';
    }
}

/**
 * 画像生成 (Gemini 3 Pro Image = imagen-4.0-generate-001 利用)
 */
export async function generateImage(category, targetLabel, gender, imageContext, textContext, platformId, visualDescription, count = 1) {
    try {
        // "Japanese" (日本人) を被写体として強力に指定し、かつ「文字を絶対に入れない」ようにネガティブプロンプト的に指示
        // Imagen 4 は日本語テキストを生成できず、強制的に描こうとすると文字化けした「日本語に見える模様」を
        // 背景に描き込んでしまう (実観測あり)。anti-text 指示は徹底的に強化する。
        const basePrompt = `Realistic documentary/editorial photograph for ${platformId}, featuring Japanese ${targetLabel} ${gender}. Category: ${category?.label || category}. ${imageContext}.

REALISTIC PHOTO CONSTRAINT (HIGHEST PRIORITY):
The image must look like a believable photograph taken by a human photographer in a real Japanese business, service, retail, hospitality, craft, product, or consultation setting.
- No CGI, no 3D render, no illustration, no anime, no surreal or fantasy objects
- No glowing particles, neon sci-fi effects, abstract brain/data graphics, impossible architecture, or synthetic diagram overlays
- No overly perfect stock-photo staging, plastic skin, distorted anatomy, uncanny faces, or complicated close-up hands
- Prefer natural window light, ordinary materials, human-scale composition, imperfect real environments, and simple negative space for overlay copy

CRITICAL TEXT-FREE CONSTRAINT (HIGHEST PRIORITY):
The generated image MUST be completely TEXT-FREE. Absolutely zero of the following anywhere in the image:
- No Japanese kanji, hiragana, katakana, or any Japanese characters
- No English letters, words, or alphabets
- No numbers or digits visible as text
- No typography of any language or script
- No signs, signage, billboards with text
- No book covers with visible titles, no book pages with visible writing
- No screens, monitors, or phones displaying text or UI text
- No papers, documents, notebooks with visible writing
- No labels, captions, watermarks, logos with text
- No fake or garbled text patterns that resemble Japanese
If a book or document appears, it must be CLOSED or shown from an angle where any text is invisible. Pure visual photography only — show people, objects, scenes, atmosphere through composition and color, NEVER through written text.`;
        const finalPrompt = visualDescription
            ? `${basePrompt}, incorporating product style: ${visualDescription}, specifically featuring Japanese/Asian models.`
            : `${basePrompt}, specifically featuring Japanese/Asian models.`;

        // Gemini 3.0 ImagenのURL (v1beta) - APIキーを埋め込み
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${process.env.GEMINI_API_KEY}`;

        const response = await withRetry(async () => {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    instances: [
                        { prompt: finalPrompt }
                    ],
                    parameters: {
                        sampleCount: count,
                        outputOptions: {
                            mimeType: 'image/jpeg'
                        }
                    }
                })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Gemini Image API Error (Status ${res.status}): ${errText}`);
            }
            return res;
        });

        const data = await response.json();

        // Base64エンコードされた画像の配列を取得してData URIに変換
        if (data && data.predictions && data.predictions.length > 0) {
            const BUCKET_NAME = 'generated-images';
            let currentUserId = 'anonymous';
            try {
                const clerkAuth = await auth();
                if (clerkAuth && clerkAuth.userId) currentUserId = clerkAuth.userId;
            } catch (e) {}

            const uploadPromises = data.predictions.map(async (pred) => {
                try {
                    const rawBase64 = pred.bytesBase64Encoded;
                    const buffer = Buffer.from(rawBase64, 'base64');
                    
                    const randomString = crypto.randomBytes(16).toString('hex');
                    const fileName = `${currentUserId}/${Date.now()}_${randomString}.jpg`;
                    
                    const { error: uploadError } = await supabaseAdmin.storage
                        .from(BUCKET_NAME)
                        .upload(fileName, buffer, {
                            contentType: 'image/jpeg',
                            upsert: false
                        });
                        
                    if (uploadError) {
                        console.error("Supabase Upload Error:", uploadError);
                        return `data:image/jpeg;base64,${rawBase64}`; // Fallback to base64 if upload fails
                    }
                    
                    const { data: publicUrlData } = supabaseAdmin.storage
                        .from(BUCKET_NAME)
                        .getPublicUrl(fileName);
                        
                    return publicUrlData.publicUrl;
                } catch (err) {
                    console.error("Image Processing Error:", err);
                    return `data:image/jpeg;base64,${pred.bytesBase64Encoded}`;
                }
            });

            const publicUrls = await Promise.all(uploadPromises);
            return count === 1 ? [publicUrls[0]] : publicUrls;
        } else {
            throw new Error("No image data returned from API.");
        }
    } catch (error) {
        console.error("generateImage error:", error);
        // フォールバック
        let searchKeyword = 'business';
        if (category?.label) searchKeyword = category.label;
        const fallback = Array(count).fill(`https://source.unsplash.com/random/800x800/?${encodeURIComponent(searchKeyword)}`);
        return count === 1 ? fallback : fallback;
    }
}

/**
 * プロダクト画像解析
 */
export async function analyzeProductImage(base64Images) {
    if (!base64Images || base64Images.length === 0) return null;

    try {
        const parts = base64Images.map(imgStr => {
            const base64Data = imgStr.split(',')[1];
            return {
                inlineData: {
                    data: base64Data,
                    mimeType: imgStr.match(/data:(.*?);/)?.[1] || "image/jpeg"
                }
            };
        });

        const ai = getAI();
        const response = await ai.models.generateContent({
            model: RESEARCH_MODEL, // flash で十分 (単純な視覚記述タスク、Pro は過剰)
            contents: [
                "Describe the visual style, colors, and key elements of these product/service images in English so they can be used as references for image generation.",
                ...parts
            ]
        });

        return response.text;
    } catch (error) {
        console.error("analyzeProductImage error:", error);
        return null;
    }
}

/**
 * Webサイトスクレイピングのモック実装
 */
export async function scrapeWebsite(url) {
    if (!url) return null;
    
    // 【重要バグ修正】
    // URLに "http" がない場合、Next.js(Vercel)のfetchがこれを「相対パス(/est-kisarazu.com)」と解釈してしまい、
    // 自社サイトのLanding Page（SNS Agent24）を誤ってスクレイピングしてしまう現象を防止。
    let validUrl = url.trim();
    if (!/^https?:\/\//i.test(validUrl)) {
        validUrl = 'https://' + validUrl;
    }

    try {
        // 実際の商用ではPuppeteer等を使うが、ここでは簡易的なフェッチ
        const res = await fetch(validUrl);
        if (!res.ok) return null;
        const html = await res.text();

        // titleと簡単なテキスト抽出（正規表現による簡易版）
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : '';

        // 簡易的にbodyのテキストのみ抽出
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        let text = '';
        if (bodyMatch) {
            text = bodyMatch[1].replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        return `Title: ${title}\nContent: ${text.substring(0, 1500)}`; // トークン制限のため切り詰め
    } catch (error) {
        console.error("scrapeWebsite error:", error);
        return null;
    }
}
