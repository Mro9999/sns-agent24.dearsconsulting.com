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

# 出力形式 (JSONのみ)
{
    "insight_macro": "①世の中の大きなトレンド (100文字程度)",
    "insight_industry": "②業界内でのトレンド (100文字程度)",
    "insight_target": "③ターゲット層のトレンド (100文字程度)",
    "insight_summary": "これら3方向のトレンドを掛け合わせた、今回の投稿内容や画像生成に活かすべき見込み客の深い心理と全く新しいアプローチ方針（200文字程度）",
    "logic": {
        "query": "リサーチで使用した想定検索キーワード",
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
        else if (basePurpose === 'branding') goalText = 'ブランド資産を実務目線で語る（具体的なポジショニング戦略・差別化施策・実在の業界事例・数字に基づく根拠の4軸で構成。"哲学" "美意識" "世界観" のような抽象語だけで終わる発信は禁止。読者がその場で実務に応用できる粒度まで具体化する）';
        else if (basePurpose === 'announcement') goalText = '新メニュー・商品を告知したい（新商品・季節メニュー・限定企画）';
        else if (basePurpose) goalText = basePurpose;

        goalText += additionalInstruction;
        if (format === 'carousel') {
            formatInstruction = `
# 出力形式 (JSONのみ)
{
    "caption": "一切の絵文字や顔文字を使用せず、ターゲットに深く響く知的で洗練されたプロフェッショナルな投稿文（最後にCTAやURLを含む）",
    "hashtags": ["ハッシュタグ1", "ハッシュタグ2", "ハッシュタグ3"],
    "carousel_slides": [
        { "overlay_copy": "1枚目(表紙): 読者の具体的な悩みや願望に刺さる一言。抽象論禁止。適宜 '\\n' で改行", "text": "表紙の補足となる短い文章", "image_hint_en": "Symbolic English visual (40-60 words) reinforcing slide 1's overlay_copy theme. NO TEXT in image. NO generic office (desk/laptop/notebook/coffee). Use metaphor, landscape, or specific human action." },
        { "overlay_copy": "2枚目: 具体的な事実・事例・本論を含む見出し", "text": "2枚目での詳細な解説文", "image_hint_en": "Symbolic English visual (40-60 words) for slide 2's specific message. NO TEXT. NO generic office. Distinct setting/subject from slide 1." },
        { "overlay_copy": "3枚目: 解決策・価値・次の一歩を具体的に示す見出し（CTAを兼ねる）", "text": "3枚目での詳細な解説文（読者の行動を促す）", "image_hint_en": "Symbolic English visual (40-60 words) for slide 3's solution/outcome. NO TEXT. NO generic office. Distinct setting from slides 1-2." }
    ],
    "image_idea": "この投稿全体の世界観を表す、${IMAGE_MODEL}で背景画像を生成するための詳細な画像プロンプト案（★毎回必ず異なる構図・切り口・被写体にする。英語、50単語程度）",
    "variants": [
        { "style": "標準", "caption": "...", "hashtags": ["..."] },
        { "style": "エモーショナル", "caption": "...", "hashtags": ["..."] }
    ]
}

# 【超重要】image_hint_en の品質基準 (これに従わないと画像がgenericなオフィス写真に収束し、キャプションと画像が乖離します)

## 必ず守るルール
1. **そのスライドの overlay_copy の意味的テーマを「比喩」「象徴的シーン」「具体的な人間の行動」で視覚化** すること
2. **以下の generic 要素は禁止** (画像が「ノート・PC・コーヒー・手書き」に収束するため):
   - desk with laptop / notebook / pen / coffee cup / hands writing / person at computer / typical office scene
   - 単独の「businessperson in suit at office」「woman reading a book」のような無内容な記述
3. **各スライドは互いに完全に異なる setting / subject** にすること (例: スライド1=山頂、2=賑わう市場、3=静謐な工房 等)
4. **画像内にテキスト・文字・看板・ラベル・ロゴが一切含まれないこと** (Imagen が日本語を文字化けで再現するため)
5. 40-60語の英語、人物の姿勢/表情・物体・照明・雰囲気・構図・色調を具体的に記述

## 推奨される視覚モチーフ (テーマ別の例)
- 「価格競争から脱却」: 群衆から離れて静かな道を歩く後ろ姿 / 賑やかな市場の喧騒の外で凛と佇むシルエット
- 「思想/哲学を言語化」: 山頂で広大な景色を見渡す人 / 暗い部屋で一筋の光に向かう人物
- 「美意識/作品性」: 職人が一点の道具を丁寧に磨くクローズアップ / 静謐な日本庭園 / 美術館の彫刻
- 「無意識の願望」: 鏡に映る自分を見つめる人物 / 水面の波紋 / 霧の中から現れる人影
- 「選ばれ続ける」: 多数の手の中で一つだけ選ばれて差し出される花 / 群衆を背景に光が当たる一人
- 「具体的なステップ」: 階段を一段ずつ登る足元 / 連なる扉が開いていく構図 / 橋を渡る人物
- 「データ/事実」: 抽象的な光のグラフィック / 星空や天体図 / 結晶構造のマクロ撮影

## BAD vs GOOD 例
BAD: "A businessperson sitting at a desk with a laptop, writing in a notebook, with a coffee cup nearby, in a modern office with soft lighting"
GOOD: "A solitary figure standing at the edge of a serene mountain plateau at golden hour, gazing toward distant peaks beyond a sea of clouds, conveying clarity of vision and quiet resolve, warm cinematic light, shallow depth of field, painterly atmosphere"

BAD: "Hands writing on a notebook with abstract symbols, representing thought"
GOOD: "Close-up of weathered artisan hands carefully shaping clay on a potter's wheel in a dim warm-lit workshop, single beam of light from a high window catching airborne dust, conveying patient craftsmanship and embodied philosophy"
`;
        } else if (format === 'video_script') {
            formatInstruction = `
# 出力形式 (JSONのみ)
{
    "caption": "（※投稿文用）一切の絵文字や顔文字を使用せず、ターゲットに深く響く知的で洗練されたプロフェッショナルな投稿文",
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
    "caption": "一切の絵文字や顔文字を使用せず、ターゲットに深く響く知的で洗練されたプロフェッショナルな投稿文（最後にCTAやURLを含む）",
    "hashtags": ["ハッシュタグ1", "ハッシュタグ2", "ハッシュタグ3"],
    "image_idea": "この投稿文に合う、${IMAGE_MODEL}で生成するための詳細な画像プロンプト案（★毎回必ず異なる構図・切り口・被写体にする。英語、50単語程度）",
    "overlay_copy": "写真上に表示するキャッチコピー（10〜25文字程度、'\\n'で改行推奨）。★必ず読者の具体的な悩み・願望・行動に言及すること。『美学』『本質』『哲学』等の抽象語だけのコピーは禁止。具体的なサービス内容・メリット・数字を含めて書く",
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
- 良い例:「カット後、周りの反応が変わります」「月5万円の広告費を0円に」「予約が3倍になった理由」
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

        return extractJSON(response.text);
    } catch (error) {
        console.error("generatePost error:", error);
        throw new Error("投稿内容の生成に失敗しました。");
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
        const prompt = `You are a visual director for premium Japanese B2B Instagram carousel posts. Given a single slide's text content, generate a precise English image prompt that DIRECTLY visualizes the slide's main message.

Slide overlay (the headline text shown on the image):
"${overlayCopy || ''}"

Slide body text (additional context):
"${slideText || ''}"

Requirements:
- 40-60 English words
- Must visually communicate THE EXACT specific message of this slide, not a generic version
- If the slide mentions "3 steps" / "3つのステップ", show 3 distinct visual elements (e.g. three stones in sequence, three doors, three paths converging)
- If the slide mentions "Before / After" / "ビフォーアフター", show a transformation, contrast, or split composition
- If a specific industry is named (e.g. SaaS / 旅館 / 化粧品メーカー / 士業), reflect that industry's environment
- If a specific action or process is described, show that action being performed
- If a specific failure pattern is named, show the negative state symbolically
- ABSOLUTELY NO text, letters, numbers, signs, labels, captions, watermarks, logos anywhere in the image
- Premium editorial/cinematic photography style, 4:5 portrait composition
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
        const basePrompt = `High quality, commercial photography, engaging social media post for ${platformId}, featuring Japanese ${targetLabel} ${gender}. Category: ${category?.label || category}. ${imageContext}.

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
