import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { generateImage } from '@/lib/apiService';
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
        // 旧設計: 1つの image_idea で sampleCount: imgCount → 全スライドが同テーマ
        // 新設計: スライド毎に overlay_copy / text を含む prompt を作って 1枚ずつ生成
        //         → カルーセル各スライドが個別の主題に沿った画像になる
        const imagePromises = [];
        for (let i = 0; i < imgCount; i++) {
            // スライド毎にビジュアル指示を回転させて多様性を担保
            const visualTone = VISUAL_VARIETY_DIRECTIVES[(variationIndex + i) % VISUAL_VARIETY_DIRECTIVES.length];
            const subjectAngle = SUBJECT_VARIETY_DIRECTIVES[(variationIndex + i) % SUBJECT_VARIETY_DIRECTIVES.length];

            let slideContext = '';
            if (isCarousel && post.carousel_slides && post.carousel_slides[i]) {
                const slide = post.carousel_slides[i];
                const overlayCopy = slide.overlay_copy || '';
                const slideBody = slide.text || '';
                if (overlayCopy || slideBody) {
                    slideContext = `

【このスライド (${i + 1}/${imgCount}) 固有の主題】
- 画面に表示される見出し: 「${overlayCopy}」
- 補足テキスト: 「${slideBody}」
- この画像は **このスライド固有の主題** を視覚的に補強する構図・被写体にしてください (投稿全体のテーマだけではなく、このスライドの見出しに直結した画像)`;
                }
            } else if (post.overlay_copy) {
                slideContext = `

【主題】
- 画面に表示される見出し: 「${post.overlay_copy}」
- この画像はこの見出しを視覚的に補強する構図・被写体にしてください`;
            }

            const slideImageIdea = `${post.image_idea}${slideContext}

【ビジュアルトーン指示】${visualTone}
【構図・被写体指示】${subjectAngle}`;

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

        const slideResults = await Promise.all(imagePromises);
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
