"use server";
// src/lib/apiService.js
import { GoogleGenAI } from '@google/genai';

// Gemini SDK 初期化関数 (モジュール読み込み時のエラーを防ぐための遅延評価)
// Vercelの本番環境で環境変数がロードされる前に呼ばれてクラッシュするのを防ぎます
const getAI = () => {
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
        console.error("Gemini API Key is missing!");
    }
    return new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });
};

// Google Search利用時はresponseMimeType: "application/json"が使えないため、
// 返却されたテキスト（マークダウン等）からJSON部分だけを安全に抽出してパースする関数
const extractJSON = (text, fallbackData = {}) => {
    try {
        // "```json ... ```" のようなマークダウンブロックがあれば除去
        const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to parse JSON from AI response:", text);
        console.error("Parse Error Details:", e);
        // エラーで画面がクラッシュしないよう、安全なデフォルトデータを返す
        return fallbackData;
    }
};

// モデル名
const TEXT_MODEL = 'gemini-2.5-pro'; // 高機能・最新の文章・推論用モデル
const IMAGE_MODEL = 'imagen-3.0-generate-001'; // 最新の画像生成モデル

/**
 * トレンドリサーチ
 */
export async function researchTrends(category, targetLabel, gender, businessStyle, platformId, location, siteContent) {
    try {
        const prompt = `
あなたは世界トップクラスのマーケター兼トレンドアナリストです。

ランダムシード: ${new Date().toISOString()}_${Math.random()}
※最重要指令: あなたはこれまで何度も似たような分析を出力しがちです。今回は【絶対に過去のパターンを踏襲せず】、これまでとは全く異なる斬新で独自の切り口、隠れたインサイト、あるいは逆張りの視点を持って以下の分析を行ってください。

# 言語制約（超重要）
すべての出力（JSONの各値など）は、**必ず完全で自然な「日本語」のみ**を使用してください。
英単語などの一般的な固有名詞等を除き、**ロシア語（例: готовые）、アラビア語、フランス語など、指定以外の言語が1文字でも混入することは固く禁じます。**

# 条件
- プラットフォーム: ${platformId}
- 業種/カテゴリ: ${category?.label || category}
- ターゲット層: ${targetLabel}
- 性別: ${gender === 'male' ? '男性' : gender === 'female' ? '女性' : '不問'}
- ビジネス形態: ${businessStyle === 'physical' ? '実店舗・サロン' : businessStyle === 'online' ? 'オンライン・EC' : 'サービス・レッスン'}
${location ? `- 地域: ${location}` : ''}
${siteContent ? `- 参考サイト情報: ${siteContent.substring(0, 1000)}...` : ''}

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
`;
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                temperature: 0.95, // 多様性を最大化
                tools: [{ googleSearch: {} }] // ← ここでGoogle Search Grounding（最新情報検索機能）を有効化
            }
        });

        return extractJSON(response.text);
    } catch (error) {
        console.error("researchTrends error:", error);
        throw new Error("トレンドリサーチに失敗しました。");
    }
}

/**
 * 投稿内容生成
 */
export async function generatePost(research, platformId, category, targetLabel, gender, businessStyle, tone, language = 'ja', textContext, siteContent, format = 'single') {
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
        if (format === 'carousel') {
            formatInstruction = `
# 出力形式 (JSONのみ)
{
    "caption": "一切の絵文字や顔文字を使用せず、ターゲットに深く響く知的で洗練されたプロフェッショナルな投稿文（最後にCTAやURLを含む）",
    "hashtags": ["ハッシュタグ1", "ハッシュタグ2", "ハッシュタグ3"],
    "carousel_slides": [
        { "overlay_copy": "1枚目(表紙)の強烈なキャッチコピー。視覚的に美しく適宜 '\\n' で改行", "text": "表紙の補足となる短い文章" },
        { "overlay_copy": "2枚目の見出し", "text": "2枚目での詳細な解説文" },
        { "overlay_copy": "3枚目の見出し", "text": "3枚目での詳細な解説文" },
        { "overlay_copy": "4枚目の見出し", "text": "4枚目での詳細な解説文" },
        { "overlay_copy": "最後の行動喚起(CTA)コピー", "text": "保存やフォロー、リンククリックを促す文章" }
    ],
    "image_idea": "この投稿全体の世界観を表す、${IMAGE_MODEL}で背景画像を生成するための詳細な画像プロンプト案（英語、50単語程度）",
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
    "image_idea": "動画のサムネイルとして使える、${IMAGE_MODEL}向けの画像プロンプト案（英語、50単語程度）",
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
    "image_idea": "この投稿文に合う、${IMAGE_MODEL}で生成するための詳細な画像プロンプト案（英語、50単語程度）",
    "overlay_copy": "写真上にデカデカと表示する短く強烈なキャッチコピー（10文字〜最大25文字程度。視覚的に美しくするために途中に改行記号 '\\n' を入れることを推奨）",
    "variants": [
        { "style": "標準", "caption": "...", "hashtags": ["..."] },
        { "style": "エモーショナル", "caption": "...", "hashtags": ["..."] },
        { "style": "問いかけ", "caption": "...", "hashtags": ["..."] }
    ]
}`;
        }

        const prompt = `
あなたはプロのSNS運用代行者です。以下の「3方向のトレンドリサーチ結果」とコンテキストに基づいて、読者の心を動かす極めて質の高いコンテンツ(${format}フォーマット)を生成してください。
「AIが診断しました」「AIとしての提案です」などの言葉は絶対に使わず、ビジネスオーナーが直接顧客に語りかける自然なテキストを作成してください。

ランダムシード: ${Date.now()}_${Math.random()}
※最重要指令: 生成するたびに前回の出力パターンを完全に捨て去り、【毎回全く異なる切り口、異なる語り口、異なるストーリー展開、異なるオファーの出し方】をして、ユーザーを飽きさせないクリエイティブなテキストを書き下ろしてください。テンプレ化は厳禁です。

# 前提
- プラットフォーム: ${platformId}
- 業種: ${category?.label}
- ターゲット: ${targetLabel} (${gender})
- トーン&マナー: ${tone?.label || tone}
- 言語仕様: ${languageInstruction}

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

${formatInstruction}
`;
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                temperature: 0.95, // 多様性を最大化
                tools: [{ googleSearch: {} }] // ← 投稿内容生成時にもネットの最新情報を統合
            }
        });

        return extractJSON(response.text);
    } catch (error) {
        console.error("generatePost error:", error);
        throw new Error("投稿内容の生成に失敗しました。");
    }
}

/**
 * 画像生成 (Gemini 3 Pro Image = imagen-3.0-generate-001 利用)
 */
export async function generateImage(category, targetLabel, gender, imageContext, textContext, platformId, visualDescription, count = 1) {
    try {
        // "Japanese" (日本人) を被写体として強力に指定し、かつ「文字を絶対に入れない」ようにネガティブプロンプト的に指示
        const basePrompt = `High quality, commercial photography, engaging social media post for ${platformId}, featuring Japanese ${targetLabel} ${gender}. Category: ${category?.label || category}. ${imageContext}. IMPORTANT: Absolutely NO text, NO words, NO letters, NO characters, NO typography, NO watermark in the generated image. Pure visual content only.`;
        const finalPrompt = visualDescription
            ? `${basePrompt}, incorporating product style: ${visualDescription}, specifically featuring Japanese/Asian models.`
            : `${basePrompt}, specifically featuring Japanese/Asian models.`;

        // Gemini 4 ImagenのURL (v1beta) - APIキーを埋め込み
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`;

        const response = await fetch(url, {
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

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini Image 4 API Error: ${errText}`);
        }

        const data = await response.json();

        // Base64エンコードされた画像の配列を取得してData URIに変換
        if (data && data.predictions && data.predictions.length > 0) {
            const imageUrls = data.predictions.map(pred =>
                `data:image/jpeg;base64,${pred.bytesBase64Encoded}`
            );
            return count === 1 ? [imageUrls[0]] : imageUrls;
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
            model: TEXT_MODEL,
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
    try {
        // 実際の商用ではPuppeteer等を使うが、ここでは簡易的なフェッチ
        const res = await fetch(url);
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
