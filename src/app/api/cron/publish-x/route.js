import { NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { authorizeCronRequest } from '@/lib/server/cronAuth';

export const dynamic = "force-dynamic";

// Vercel Cron Job として定期実行される（毎日 03:00 UTC = 12:00 JST）
// 予約時刻が来た X (Twitter) の queued 投稿を1件取得して投稿する
export async function GET(req) {
    try {
        const authError = authorizeCronRequest(req);
        if (authError) return authError;

        // 2. X API クライアントを作成（OAuth 1.0a User Context）
        if (!process.env.X_CONSUMER_KEY || !process.env.X_ACCESS_TOKEN) {
            throw new Error('X API credentials are not configured');
        }

        const client = new TwitterApi({
            appKey: process.env.X_CONSUMER_KEY,
            appSecret: process.env.X_CONSUMER_SECRET,
            accessToken: process.env.X_ACCESS_TOKEN,
            accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
        });

        // 3. 予約時刻が来た queued twitter 投稿を1件取得
        const { data: posts, error: fetchError } = await supabase
            .from('scheduled_posts')
            .select('*')
            .eq('status', 'queued')
            .eq('platform', 'twitter')
            .lte('scheduled_at', new Date().toISOString())
            .order('scheduled_at', { ascending: true })
            .limit(1);

        if (fetchError) throw fetchError;

        if (!posts || posts.length === 0) {
            return NextResponse.json({
                message: 'No queued tweets available',
                timestamp: new Date().toISOString()
            });
        }

        const post = posts[0];
        console.log(`[X Cron] Publishing tweet ID: ${post.id}`);

        // 4. X API で投稿
        let tweetResponse;

        try {
            if (post.image_urls && Array.isArray(post.image_urls) && post.image_urls.length > 0) {
                // 画像付き投稿
                const imageUrl = post.image_urls[0];
                console.log(`[X Cron] Downloading image: ${imageUrl}`);

                const imageResponse = await fetch(imageUrl);
                if (!imageResponse.ok) {
                    throw new Error(`Failed to download image: ${imageResponse.status}`);
                }
                const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

                // X API v1.1 でメディアアップロード（v2 直接投稿には対応していないため）
                console.log(`[X Cron] Uploading media to X (size: ${imageBuffer.length}, type: ${contentType})`);
                const mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType: contentType });
                console.log(`[X Cron] Media uploaded: ${mediaId}`);

                // X API v2 でツイート投稿（メディア付き）
                tweetResponse = await client.v2.tweet({
                    text: post.caption,
                    media: { media_ids: [mediaId] }
                });
            } else {
                // テキストのみ投稿
                tweetResponse = await client.v2.tweet({
                    text: post.caption
                });
            }

            console.log(`[X Cron] Tweet published: ${tweetResponse.data.id}`);

            // 5. ステータスを 'published' に更新
            const { error: updateError } = await supabase
                .from('scheduled_posts')
                .update({
                    status: 'published',
                    published_at: new Date().toISOString()
                })
                .eq('id', post.id);

            if (updateError) {
                console.error('[X Cron] Status update failed:', updateError);
            }

            return NextResponse.json({
                success: true,
                post_id: post.id,
                tweet_id: tweetResponse.data.id,
                message: `Tweet published successfully`
            });

        } catch (tweetError) {
            console.error('[X Cron] Tweet failed:', tweetError);

            // 投稿失敗時は status を queued のまま残す（次回自動再試行）
            return NextResponse.json({
                success: false,
                post_id: post.id,
                error: tweetError.message || 'Unknown error'
            }, { status: 500 });
        }

    } catch (error) {
        console.error('[X Cron] Fatal error:', error);
        return new NextResponse(
            `Internal Server Error: ${error.message}`,
            { status: 500 }
        );
    }
}
