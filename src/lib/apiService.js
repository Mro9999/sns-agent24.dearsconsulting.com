"use server";
// src/lib/apiService.js
import { GoogleGenAI } from '@google/genai';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabaseAdmin';
import crypto from 'crypto';

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
export async function generatePost(research, platformId, category, targetLabel, gender, businessStyle, tone, language = 'ja', textContext, siteContent, format = 'single', userProfile = {}, purpose = null) {
    try {
        let languageInstruction = "【基本言語】すべての出力テキスト（キャプション、ハッシュタグ、コピーなど）は、**必ず完全で自然な「日本語」のみ**で作成してください。";

        if (language === 'ja_en') {
            languageInstruction = "【インバウンド対応】キャプション文章などは【日本語】とネイティブな【英語】の両方を併記してください。ハッシュタグも日本語と英語を混ぜて生成してください。";
        } else if (language === 'ja_zh') {
            languageInstruction = "【インバウンド対応】キャプション文章などは【日本語】と自然な【中国語(繁体字)】の両方を併記してください。ハッシュタグも日本語と中国語を混ぜて生成してください。";
        } else if (language === 'ja_ko') {
            languageInstruction = "【インバウンド対応】キャプション文章などは【日本語】と自然な【韓国語】の両方を併記してください。ハッシュタグも日本語と韓国語を混ぜて生成してください。";
        } else if (language === 'all') {
            languageInstruction = "【インバウンド最強対応】キャプション文章などは【日本語】【英語】【中国語(繁体字)】【韓国語】の4ヶ国語すべてを各段落に分けて併記してください。ハッシュタグも4言語のハイブリッドで幅広く生成してください。";
        }

        // 選択された言語（日本語単体、またはインバウンドを含む複数言語）以外の混入を強力に防ぐための共通ルール
        languageInstruction += `\n\n【超重要・多言語混入防止】上記で指定された言語（および一般的な固有名詞）以外の言語が1文字でも混入することはシステムエラーとなるため固く禁じます。特にロシア語（例: готовые）、アラビア語、フランス語などが意図せず出力されないよう、出力言語を極めて厳密にコントロールしてください。`;

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
        else if (basePurpose === 'branding') goalText = 'ブランドの世界観を伝えたい（哲学・審美眼・ストーリー）';
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
        { "overlay_copy": "1枚目(表紙): 読者の具体的な悩みや願望に刺さる一言。抽象論禁止。適宜 '\\n' で改行", "text": "表紙の補足となる短い文章" },
        { "overlay_copy": "2枚目: 具体的な事実・数字・事例を含む見出し", "text": "2枚目での詳細な解説文" },
        { "overlay_copy": "3枚目: 読者が『自分のことだ』と感じる具体的な見出し", "text": "3枚目での詳細な解説文" },
        { "overlay_copy": "4枚目: 解決策・提供価値を具体的に示す見出し", "text": "4枚目での詳細な解説文" },
        { "overlay_copy": "5枚目: 具体的な次の行動を促すCTA（例:『まずは無料相談から』等）", "text": "保存やフォロー、リンククリックを促す文章" }
    ],
    "image_idea": "この投稿全体の世界観を表す、${IMAGE_MODEL}で背景画像を生成するための詳細な画像プロンプト案（★毎回必ず異なる構図・切り口・被写体にする。英語、50単語程度）",
    "variants": [
        { "style": "標準", "caption": "...", "hashtags": ["..."] },
        { "style": "エモーショナル", "caption": "...", "hashtags": ["..."] }
    ]
}`;
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
 * 画像生成 (Gemini 3 Pro Image = imagen-4.0-generate-001 利用)
 */
export async function generateImage(category, targetLabel, gender, imageContext, textContext, platformId, visualDescription, count = 1) {
    try {
        // "Japanese" (日本人) を被写体として強力に指定し、かつ「文字を絶対に入れない」ようにネガティブプロンプト的に指示
        const basePrompt = `High quality, commercial photography, engaging social media post for ${platformId}, featuring Japanese ${targetLabel} ${gender}. Category: ${category?.label || category}. ${imageContext}. IMPORTANT: Absolutely NO text, NO words, NO letters, NO characters, NO typography, NO watermark in the generated image. Pure visual content only.`;
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
