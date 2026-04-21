import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { generateImage } from '@/lib/apiService';
import { VISUAL_VARIETY_DIRECTIVES, SUBJECT_VARIETY_DIRECTIVES } from '@/lib/canvasHelper';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

        // 多様性指示をpost毎にずらす
        const visualTone = VISUAL_VARIETY_DIRECTIVES[variationIndex % VISUAL_VARIETY_DIRECTIVES.length];
        const subjectAngle = SUBJECT_VARIETY_DIRECTIVES[variationIndex % SUBJECT_VARIETY_DIRECTIVES.length];
        const variedImageIdea = `${post.image_idea}\n【ビジュアルトーン指示】${visualTone}\n【構図・被写体指示】${subjectAngle}`;

        // カテゴリ/ターゲットは簡易オブジェクトに
        const category = { id: 'other', label: productContext.category || 'ビジネス' };
        const targetLabel = productContext.target || '一般';

        const imgRes = await generateImage(
            category,
            targetLabel,
            'other',
            variedImageIdea,
            productContext,
            post.platform,
            null,
            imgCount
        );

        if (!imgRes || imgRes.error || !Array.isArray(imgRes)) {
            throw new Error('Image generation failed');
        }

        const cleanUrls = imgRes.filter(Boolean);

        // DBに保存
        const { error: upErr } = await supabase
            .from('scheduled_posts')
            .update({ image_urls: cleanUrls })
            .eq('id', postId);

        if (upErr) throw upErr;

        return NextResponse.json({ success: true, image_urls: cleanUrls });
    } catch (error) {
        console.error('[generate-post-image] error:', error);
        return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
    }
}
