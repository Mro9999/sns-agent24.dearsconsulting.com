import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { generateImage, refineSlideImageHint, auditSlideImage } from '@/lib/apiService';
import { VISUAL_VARIETY_DIRECTIVES, SUBJECT_VARIETY_DIRECTIVES } from '@/lib/canvasHelper';
import { composeOverlayImage } from '@/lib/serverOverlayHelper';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const dynamic = "force-dynamic";
// 画像生成 (Imagen) + 各スライドの overlay 合成 (Satori) で時間がかかるため maxDuration を伸ばす
export const maxDuration = 120;

const COMPOSED_BUCKET = 'generated-images';

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
            // スライド毎にビジュアル指示を回転させて多様性を担保
            const visualTone = VISUAL_VARIETY_DIRECTIVES[(variationIndex + i) % VISUAL_VARIETY_DIRECTIVES.length];
            const subjectAngle = SUBJECT_VARIETY_DIRECTIVES[(variationIndex + i) % SUBJECT_VARIETY_DIRECTIVES.length];

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

[Style constraints]
- High-quality professional photography or cinematic visual, Instagram-ready 4:5 portrait composition
- The scene MUST visually reinforce the message above through symbolism, metaphor, or evocative setting
- ABSOLUTELY NO text, letters, signs, labels, signage, captions, watermarks, logos in the image
- Avoid generic stock-photo clichés (no plain office desks with laptops/notebooks/coffee unless the hint explicitly calls for them)
- Carousel slide ${i + 1} of ${imgCount} — visually distinct from other slides`;
            } else {
                // フォールバック: image_hint_en が無い旧データ用
                const slidePositionContext = imgCount > 1
                    ? `\n\n[Carousel slide ${i + 1} of ${imgCount} — choose a unique angle/composition distinct from other slides]`
                    : '';
                slideImageIdea = `${post.image_idea}${slidePositionContext}

【ビジュアルトーン指示】${visualTone}
【構図・被写体指示】${subjectAngle}`;
            }

            imagePromises.push(
                generateImage(
                    category,
                    targetLabel,
                    'other',
                    slideImageIdea,
                    productContext,
                    post.platform,
                    null,
                    1 // スライド毎に 1 枚ずつ
                )
                    .then(arr => (Array.isArray(arr) ? arr[0] : null))
                    .catch(err => {
                        console.error(`[generate-post-image] slide ${i} image gen failed:`, err);
                        return null;
                    })
            );
        }

        let slideResults = await Promise.all(imagePromises);

        // 🔍 校閲者役 (Phase 2): 各画像を Gemini Vision で監査し、
        // 「画像内に文字混入」または「整合性スコア < 60」のスライドを1回だけ再生成
        if (isCarousel && Array.isArray(post.carousel_slides)) {
            const auditPromises = slideResults.map((url, i) => {
                if (!url) return Promise.resolve(null);
                const slide = post.carousel_slides[i];
                return auditSlideImage(url, slide?.overlay_copy || '', slide?.text || '');
            });
            const audits = await Promise.all(auditPromises);

            const ALIGNMENT_THRESHOLD = 60;
            const regenIndices = [];
            for (let i = 0; i < audits.length; i++) {
                const a = audits[i];
                if (!a || a.skipped) continue;
                const failed = a.hasText === true || (typeof a.alignmentScore === 'number' && a.alignmentScore < ALIGNMENT_THRESHOLD);
                if (failed) regenIndices.push(i);
            }
            if (regenIndices.length > 0) {
                console.log(`[generate-post-image] audit found ${regenIndices.length} problematic slide(s); regenerating`);
                const regenPromises = regenIndices.map(async (i) => {
                    const slide = post.carousel_slides[i];
                    const hint = refinedHints[i] || slide?.image_hint_en || post.image_idea;
                    // 再生成時は監査で見つかった問題を抑制する追加注意書きを加える
                    const auditNote = audits[i].hasText
                        ? '\n[CRITICAL] The previous attempt contained visible text/letters/signs in the image. ABSOLUTELY NO text of any language in the regenerated image.'
                        : '\n[CRITICAL] The previous attempt did not align with the slide message. Make the image more specifically tied to the slide concept.';
                    const retryPrompt = `${hint}${auditNote}

[Style constraints]
- High-quality professional photography or cinematic visual, Instagram-ready 4:5 portrait composition
- ABSOLUTELY NO text, letters, signs, labels, signage, captions, watermarks, logos in the image
- Avoid generic stock-photo cliches
- Carousel slide ${i + 1} of ${imgCount}`;
                    try {
                        const arr = await generateImage(category, targetLabel, 'other', retryPrompt, productContext, post.platform, null, 1);
                        return { i, url: Array.isArray(arr) ? arr[0] : null };
                    } catch (err) {
                        console.error(`[generate-post-image] regen slide ${i} failed:`, err?.message);
                        return { i, url: null };
                    }
                });
                const regenResults = await Promise.all(regenPromises);
                for (const r of regenResults) {
                    if (r.url) slideResults[r.i] = r.url;
                }
            }

            const finalAuditPromises = slideResults.map((url, i) => {
                if (!url) return Promise.resolve(null);
                const slide = post.carousel_slides[i];
                return auditSlideImage(url, slide?.overlay_copy || '', slide?.text || '');
            });
            const finalAudits = await Promise.all(finalAuditPromises);
            const finalFailures = [];
            for (let i = 0; i < finalAudits.length; i++) {
                const a = finalAudits[i];
                if (!a || a.skipped) continue;
                const failed = a.hasText === true || (typeof a.alignmentScore === 'number' && a.alignmentScore < ALIGNMENT_THRESHOLD);
                if (failed) {
                    finalFailures.push({
                        slide: i + 1,
                        hasText: !!a.hasText,
                        alignmentScore: a.alignmentScore,
                        issues: a.issues || []
                    });
                }
            }

            if (finalFailures.length > 0) {
                console.warn('[generate-post-image] final image audit failed; not saving images:', JSON.stringify(finalFailures).slice(0, 500));
                return NextResponse.json({
                    error: 'Generated image did not pass final quality audit',
                    message: '画像内の文字混入またはスライド内容との不一致が残ったため、保存を中止しました。もう一度画像生成を試してください。',
                    failures: finalFailures
                }, { status: 422 });
            }
        }

        const rawUrls = slideResults.filter(Boolean);

        if (rawUrls.length === 0) {
            throw new Error('Image generation failed for all slides');
        }

        // ⚡ サーバーサイド オーバーレイ合成
        // 旧設計: /approve ページで client-side canvas を使い合成 → CORS 等で無音失敗するケースあり
        // 新設計: Satori (@vercel/og) でサーバー側合成 → 信頼性向上、composedURL を直接 DB に保存
        // 各スライドの overlay_copy は post.carousel_slides[i].overlay_copy / post.overlay_copy
        const composedUrls = [];
        for (let i = 0; i < rawUrls.length; i++) {
            const rawUrl = rawUrls[i];
            let overlayText = post.overlay_copy || '';
            if (isCarousel && Array.isArray(post.carousel_slides) && post.carousel_slides[i]?.overlay_copy) {
                overlayText = post.carousel_slides[i].overlay_copy;
            }

            try {
                const jpegBuffer = await composeOverlayImage(rawUrl, overlayText, i, {
                    companyName: productContext.companyName
                });
                const fileName = `${userId}/${Date.now()}_composed_${crypto.randomBytes(8).toString('hex')}.jpg`;
                const { error: upBkErr } = await supabase.storage
                    .from(COMPOSED_BUCKET)
                    .upload(fileName, jpegBuffer, { contentType: 'image/jpeg', upsert: false });
                if (upBkErr) throw upBkErr;
                const { data: pub } = supabase.storage.from(COMPOSED_BUCKET).getPublicUrl(fileName);
                composedUrls.push(pub.publicUrl);
            } catch (composeErr) {
                console.error(`[generate-post-image] overlay compose failed for slide ${i}:`, composeErr);
                // 合成失敗時は raw URL をフォールバックとして使用 (テキストなし画像)
                composedUrls.push(rawUrl);
            }
        }

        // DBに保存
        const { error: upErr } = await supabase
            .from('scheduled_posts')
            .update({ image_urls: composedUrls })
            .eq('id', postId);

        if (upErr) throw upErr;

        return NextResponse.json({ success: true, image_urls: composedUrls });
    } catch (error) {
        console.error('[generate-post-image] error:', error);
        return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
    }
}
