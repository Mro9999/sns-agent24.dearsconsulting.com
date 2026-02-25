"use server";
// src/lib/apiService.js
import { GoogleGenAI } from '@google/genai';

// Gemini SDK 初期化
const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

// モデル名
const TEXT_MODEL = 'gemini-2.5-pro'; // Gemini 2.5 Pro (テキスト用最新)
const IMAGE_MODEL = 'imagen-3.0-generate-001'; // Gemini 3 Pro Image (画像生成用最新モデル)

/**
 * トレンドリサーチ
 */
export async function researchTrends(category, targetLabel, gender, businessStyle, platformId, location, siteContent) {
    try {
        const prompt = `
あなたはプロのSNSマーケターです。以下の条件に基づく最新のプラットフォームトレンドと見込み客の心理を分析してください。

# 条件
- プラットフォーム: ${platformId}
- 業種/カテゴリ: ${category?.label || category}
- ターゲット層: ${targetLabel}
- 性別: ${gender === 'male' ? '男性' : gender === 'female' ? '女性' : '不問'}
- ビジネス形態: ${businessStyle === 'physical' ? '実店舗・サロン' : businessStyle === 'online' ? 'オンライン・EC' : 'サービス・レッスン'}
${location ? `- 地域: ${location}` : ''}
${siteContent ? `- 参考サイト情報: ${siteContent.substring(0, 1000)}...` : ''}

# 出力形式 (JSONのみ)
{
    "insight": "最新トレンドと見込み客の深い心理分析、効果的なアプローチ方法（300文字程度）",
    "logic": {
        "query": "リサーチで使用した想定検索キーワード",
        "model": "使用モデル名"
    }
}
`;
        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.7,
            }
        });

        return JSON.parse(response.text);
    } catch (error) {
        console.error("researchTrends error:", error);
        throw new Error("トレンドリサーチに失敗しました。");
    }
}

/**
 * 投稿内容生成
 */
export async function generatePost(research, platformId, category, targetLabel, gender, businessStyle, tone, textContext, siteContent) {
    try {
        const prompt = `
あなたはプロのSNS運用代行者です。以下のリサーチ結果とコンテキストに基づいて、投稿キャプションと画像の一貫したアイデアを生成してください。
「AIが診断しました」「AIとしての提案です」などの言葉は絶対に使わず、ビジネスオーナーが直接顧客に語りかける自然な投稿文を作成してください。

# 前提
- プラットフォーム: ${platformId}
- 業種: ${category?.label}
- ターゲット: ${targetLabel} (${gender})
- トーン&マナー: ${tone?.label || tone}

# リサーチ結果・商材情報
- トレンドインサイト: ${research.insight}
- 訴求ポイント: ${textContext?.sellingPoint || '特になし'}
${siteContent ? `- サイト情報: ${siteContent.substring(0, 1000)}` : ''}

# 出力形式 (JSONのみ)
{
    "caption": "絵文字を適切に使った、ターゲットに響く魅力的な投稿文",
    "hashtags": ["ハッシュタグ1", "ハッシュタグ2", "ハッシュタグ3"],
    "image_idea": "この投稿文に合う、${IMAGE_MODEL}で生成するための詳細な画像プロンプト案（英語、50単語程度）",
    "variants": [
        { "style": "標準", "caption": "...", "hashtags": ["..."] },
        { "style": "エモーショナル", "caption": "...", "hashtags": ["..."] },
        { "style": "問いかけ", "caption": "...", "hashtags": ["..."] }
    ]
}
`;
        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.8,
            }
        });

        return JSON.parse(response.text);
    } catch (error) {
        console.error("generatePost error:", error);
        throw new Error("投稿内容の生成に失敗しました。");
    }
}

/**
 * 画像生成 (Gemini 3.1 Pro 利用)
 */
export async function generateImage(category, targetLabel, gender, imageContext, textContext, platformId, visualDescription, count = 1) {
    try {
        // 画像生成プロンプトの構築
        const basePrompt = `High quality, commercial photography, engaging social media post for ${platformId}, targeting ${targetLabel} ${gender}. Category: ${category?.label || category}. ${imageContext}`;
        const finalPrompt = visualDescription
            ? `${basePrompt}, incorporating product style: ${visualDescription}`
            : basePrompt;

        // Gemini 3.1 Pro を用いた画像生成API呼び出し
        const response = await ai.models.generateImages({
            model: IMAGE_MODEL,
            prompt: finalPrompt,
            config: {
                numberOfImages: count,
                aspectRatio: platformId === 'instagram' ? '1:1' : '16:9',
                outputMimeType: 'image/jpeg',
            },
        });

        // 戻り値の形式に合わせて抽出 (base64文字列 または URL)
        const imageUrls = response.generatedImages.map(img =>
            // GoogleGenAIのレスポンス形式に依存（base64の場合は `data:image/jpeg;base64,${img.image.imageBytes}` など）
            `data:image/jpeg;base64,${img.image.imageBytes}`
        );

        return imageUrls;
    } catch (error) {
        console.error("generateImage error:", error);
        // フォールバック用のダミープレースホルダー
        const fallback = Array(count).fill(`https://source.unsplash.com/random/800x800/?${encodeURIComponent(category?.label || 'business')}`);
        return count === 1 ? fallback[0] : fallback;
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
