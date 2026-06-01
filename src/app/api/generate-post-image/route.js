import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import sharp from 'sharp';
import { generateImage, refineSlideImageHint, auditSlideImage } from '@/lib/apiService';
import { composeOverlayImage, composeTextOnlySlide } from '@/lib/serverOverlayHelper';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const dynamic = "force-dynamic";
// 画像生成 (Imagen) + 各スライドの overlay 合成 (Satori) で時間がかかるため maxDuration を伸ばす
export const maxDuration = 120;

const COMPOSED_BUCKET = 'generated-images';
const IMAGE_RETRY_LIMIT = 1;

async function uploadComposedImage(userId, jpegBuffer) {
    const fileName = `${userId}/${Date.now()}_composed_${crypto.randomBytes(8).toString('hex')}.jpg`;
    const { error: upBkErr } = await supabase.storage
        .from(COMPOSED_BUCKET)
        .upload(fileName, jpegBuffer, { contentType: 'image/jpeg', upsert: false });
    if (upBkErr) throw upBkErr;
    const { data: pub } = supabase.storage.from(COMPOSED_BUCKET).getPublicUrl(fileName);
    return pub.publicUrl;
}

async function composeFallbackSlide(userId, overlayText, index, productContext, reason = '') {
    if (reason) {
        console.warn(`[generate-post-image] using text-only fallback for slide ${index + 1}: ${reason}`);
    }

    const jpegBuffer = await composeTextOnlySlide(overlayText, index, {
        companyName: productContext?.companyName
    });
    return await uploadComposedImage(userId, jpegBuffer);
}

const buildNaturalPhotoConstraints = (slideNumber, totalSlides) => `[Style constraints]
- Natural documentary/editorial photograph, Instagram-ready 4:5 portrait composition
- Use a believable real-world Japanese service, retail, hospitality, craft, product, or consultation setting
- Real camera look: natural window light, ordinary materials, human-scale composition, slight real-life imperfection
- Keep the scene quiet and specific, with clean negative space for the Japanese overlay copy
- No CGI, no 3D render, no illustration, no surreal/fantasy scene, no glowing particles, no neon sci-fi, no abstract brain/data graphics, no impossible objects
- Avoid uncanny AI artifacts: distorted hands or faces, plastic skin, overly perfect studio stock-photo staging
- If people appear, prefer natural distance, profile, back view, over-the-shoulder, or hands only when anatomically simple and realistic
- ABSOLUTELY NO text, letters, signs, labels, signage, captions, watermarks, logos in the image
- No readable books, documents, screens, whiteboards, charts, diagrams, posters, packaging labels, or UI
- Carousel slide ${slideNumber} of ${totalSlides}: visually distinct from the other slides, but keep the same realistic photo language`;

async function inspectGeneratedImage(url) {
    if (!url) return { usable: false, reason: 'missing URL' };

    try {
        const res = await fetch(url);
        if (!res.ok) return { usable: false, reason: `fetch ${res.status}` };

        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length < 4096) return { usable: false, reason: 'image too small' };

        const { data, info } = await sharp(buffer)
            .resize(48, 48, { fit: 'inside' })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const channels = info.channels || 3;
        let total = 0;
        let totalSq = 0;
        let pixels = 0;

        for (let i = 0; i < data.length; i += channels) {
            const r = data[i] || 0;
            const g = data[i + 1] || 0;
            const b = data[i + 2] || 0;
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            total += luma;
            totalSq += luma * luma;
            pixels++;
        }

        const mean = pixels ? total / pixels : 0;
        const variance = pixels ? (totalSq / pixels) - (mean * mean) : 0;
        const stddev = Math.sqrt(Math.max(0, variance));

        if (mean < 18 && stddev < 18) {
            return { usable: false, reason: `too dark or blank (mean=${mean.toFixed(1)}, std=${stddev.toFixed(1)})` };
        }
        if (stddev < 7) {
            return { usable: false, reason: `too flat or blank (mean=${mean.toFixed(1)}, std=${stddev.toFixed(1)})` };
        }

        return { usable: true, mean, stddev };
    } catch (error) {
        return { usable: false, reason: error?.message || 'inspect failed' };
    }
}

async function generateUsableSlideImage({ category, targetLabel, slideImageIdea, productContext, platform, slideNumber }) {
    let lastReason = '';

    for (let attempt = 0; attempt < IMAGE_RETRY_LIMIT; attempt++) {
        const retryInstruction = attempt === 0
            ? ''
            : `\n[CRITICAL RETRY] Previous image was rejected because it was ${lastReason}. Generate a clearly visible real-world photograph with a real environment and subject. Avoid black canvas, empty background, abstract darkness, and text-only looking visuals.`;

        const arr = await generateImage(
            category,
            targetLabel,
            'other',
            `${slideImageIdea}${retryInstruction}`,
            productContext,
            platform,
            null,
            1
        );
        const url = Array.isArray(arr) ? arr[0] : null;
        const inspection = await inspectGeneratedImage(url);

        if (inspection.usable) return url;

        lastReason = inspection.reason || 'unusable';
        console.warn(`[generate-post-image] slide ${slideNumber} rejected generated image attempt ${attempt + 1}: ${lastReason}`);
    }

    throw new Error(`slide ${slideNumber} image unusable after retries: ${lastReason}`);
}

// 承認画面から呼び出される、1投稿分の画像生成API
// body: { postId: string, variationIndex: number }
// 既に image_urls が入っている場合は何もせずに返す（重複生成防止）
export async function POST(req) {
    try {
        const { userId } = await auth();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });

        const body = await req.json();
        const { postId, variationIndex = 0 } = body;
        if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 });

        // 対象postを取得（所有者チェック含む）
        const { data: post, error: fetchErr } = await supabase
            .from('scheduled_posts')
            .select('*')
            .eq('id', postId)
            .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        if (post.user_id !== userId) return new NextResponse('Forbidden', { status: 403 });

        // 既に画像がある場合はスキップ
        if (Array.isArray(post.image_urls) && post.image_urls.length > 0) {
            return NextResponse.json({ success: true, image_urls: post.image_urls, skipped: true });
        }

        // 画像がなければ image_idea と product_context から画像を生成
        if (!post.image_idea || post.image_idea === 'なし') {
            return NextResponse.json({ success: true, image_urls: [], reason: 'no image_idea' });
        }

        const productContext = post.product_context || {};
        const isCarousel = Array.isArray(post.carousel_slides) && post.carousel_slides.length > 0;
        const imgCount = isCarousel ? 3 : 1;

        // カテゴリ/ターゲットは簡易オブジェクトに
        const category = { id: 'other', label: productContext.category || 'ビジネス' };
        const targetLabel = productContext.target || '一般';

        // 🎨 各スライド固有の image prompt を構築 (caption と画像のテーマ整合性向上)
        // 新設計v3: スライドに image_hint_en があれば、それを主役にして
        //   競合する post.image_idea / subjectAngle を抜く。
        //   理由: 旧設計では post.image_idea (汎用) と subjectAngle (例:「俯瞰構図の机上シーン」)
        //   が Imagen を支配し、各スライドが結局「ノート/PC/コーヒー」の汎用オフィスシーンに収束していた。
        //
        // image_hint_en が無い場合 (旧データ・single投稿) は従来の汎用構成にフォールバック。
        // 日本語は引き続き Imagen prompt に渡さない (文字化け回避)。
        // 🎬 編集者役 (Phase 1): 各スライドの本文に tightly-aligned な image_hint_en を再構築
        // generatePost が作った image_hint_en は caption と同時生成のため緩い結合になりがち。
        // ここで slide ごとに Gemini Flash で refocus して整合性を上げる。失敗時は既存hintを使う。
        const refinedHints = [];
        if (isCarousel && Array.isArray(post.carousel_slides)) {
            const refinePromises = [];
            for (let i = 0; i < imgCount; i++) {
                const slide = post.carousel_slides[i];
                if (!slide) { refinePromises.push(Promise.resolve(null)); continue; }
                refinePromises.push(
                    refineSlideImageHint(slide.overlay_copy, slide.text, slide.image_hint_en || '')
                );
            }
            const settled = await Promise.all(refinePromises);
            for (let i = 0; i < imgCount; i++) {
                refinedHints.push(settled[i] || post.carousel_slides[i]?.image_hint_en || null);
            }
            console.log(`[generate-post-image] refined ${refinedHints.filter(Boolean).length}/${imgCount} slide hints`);
        }

        const imagePromises = [];
        for (let i = 0; i < imgCount; i++) {
            // 編集者役が refine した hint を優先、無ければ generatePost 時の image_hint_en にフォールバック
            const slideHintEn = (isCarousel && refinedHints[i])
                ? refinedHints[i]
                : (isCarousel && post.carousel_slides && post.carousel_slides[i]?.image_hint_en
                    ? post.carousel_slides[i].image_hint_en
                    : null);

            let slideImageIdea;
            if (slideHintEn) {
                // 新設計: image_hint_en を主役にする (汎用 image_idea / 机上シーン強制 subjectAngle を排除)
                slideImageIdea = `${slideHintEn}

${buildNaturalPhotoConstraints(i + 1, imgCount)}`;
            } else {
                // フォールバック: image_hint_en が無い旧データ用
                const slidePositionContext = imgCount > 1
                    ? `\n\n[Carousel slide ${i + 1} of ${imgCount} — choose a unique angle/composition distinct from other slides]`
                    : '';
                slideImageIdea = `${post.image_idea}${slidePositionContext}

[Fallback scene direction]
- Choose a concrete real-world customer touchpoint, service scene, product handling moment, storefront detail, or quiet consultation table that fits the post topic
- Do not default to generic desk/laptop/notebook/coffee scenes

${buildNaturalPhotoConstraints(i + 1, imgCount)}`;
            }

            imagePromises.push(
                generateUsableSlideImage({
                    category,
                    targetLabel,
                    slideImageIdea,
                    productContext,
                    platform: post.platform,
                    slideNumber: i + 1
                })
                    .catch(err => {
                        console.error(`[generate-post-image] slide ${i} image gen failed:`, err);
                        return null;
                    })
            );
        }

        let slideResults = await Promise.all(imagePromises);

        let imageQualityWarnings = [];

        // 🔍 校閲者役 (Phase 2): 各画像を Gemini Vision で監査。
        // 承認画面ではユーザーが必ず目視確認するため、監査結果で投稿全体を止めない。
        // 以前は問題画像を再生成していたが、画像生成の遅延・失敗を増やすため警告保存に留める。
        if (isCarousel && Array.isArray(post.carousel_slides)) {
            const auditPromises = slideResults.map((url, i) => {
                if (!url) return Promise.resolve(null);
                const slide = post.carousel_slides[i];
                return auditSlideImage(url, slide?.overlay_copy || '', slide?.text || '');
            });
            const audits = await Promise.all(auditPromises);

            const ALIGNMENT_THRESHOLD = 60;
            for (let i = 0; i < audits.length; i++) {
                const a = audits[i];
                if (!a || a.skipped) continue;
                const failed = a.hasText === true
                    || a.isBlankOrDark === true
                    || a.looksAI === true
                    || (typeof a.alignmentScore === 'number' && a.alignmentScore < ALIGNMENT_THRESHOLD);
                if (failed) {
                    imageQualityWarnings.push({
                        slide: i + 1,
                        hasText: !!a.hasText,
                        isBlankOrDark: !!a.isBlankOrDark,
                        looksAI: !!a.looksAI,
                        alignmentScore: a.alignmentScore,
                        issues: a.issues || []
                    });
                }
            }
            if (imageQualityWarnings.length > 0) {
                console.warn('[generate-post-image] image audit warnings; saving for manual review:', JSON.stringify(imageQualityWarnings).slice(0, 500));
            }
        }

        // ⚡ サーバーサイド オーバーレイ合成
        // 旧設計: /approve ページで client-side canvas を使い合成 → CORS 等で無音失敗するケースあり
        // 新設計: Satori (@vercel/og) でサーバー側合成 → 信頼性向上、composedURL を直接 DB に保存
        // 各スライドの overlay_copy は post.carousel_slides[i].overlay_copy / post.overlay_copy
        const composedUrls = [];
        for (let i = 0; i < imgCount; i++) {
            const rawUrl = slideResults[i];
            let overlayText = post.overlay_copy || '';
            if (isCarousel && Array.isArray(post.carousel_slides) && post.carousel_slides[i]?.overlay_copy) {
                overlayText = post.carousel_slides[i].overlay_copy;
            }

            if (!rawUrl) {
                const fallbackUrl = await composeFallbackSlide(
                    userId,
                    overlayText,
                    i,
                    productContext,
                    'raw image generation returned no usable URL'
                );
                composedUrls.push(fallbackUrl);
                imageQualityWarnings.push({
                    slide: i + 1,
                    fallback: true,
                    reason: 'raw image generation failed'
                });
                continue;
            }

            try {
                const jpegBuffer = await composeOverlayImage(rawUrl, overlayText, i, {
                    companyName: productContext.companyName
                });
                composedUrls.push(await uploadComposedImage(userId, jpegBuffer));
            } catch (composeErr) {
                console.error(`[generate-post-image] overlay compose failed for slide ${i}:`, composeErr);
                const fallbackUrl = await composeFallbackSlide(
                    userId,
                    overlayText,
                    i,
                    productContext,
                    composeErr?.message || 'overlay compose failed'
                );
                composedUrls.push(fallbackUrl);
                imageQualityWarnings.push({
                    slide: i + 1,
                    fallback: true,
                    reason: composeErr?.message || 'overlay compose failed'
                });
            }
        }

        if (composedUrls.length === 0) {
            throw new Error('Image generation failed and fallback composition failed');
        }

        // DBに保存
        const { error: upErr } = await supabase
            .from('scheduled_posts')
            .update({ image_urls: composedUrls })
            .eq('id', postId);

        if (upErr) throw upErr;

        return NextResponse.json({
            success: true,
            image_urls: composedUrls,
            quality_warnings: imageQualityWarnings
        });
    } catch (error) {
        console.error('[generate-post-image] error:', error);
        return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
    }
}
