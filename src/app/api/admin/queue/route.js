import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Make.comおよびフロントエンド（管理者）からの認証用シークレット
// .env.localに設定がない場合はデフォルト値を使用（※本番運用時は.envへの追加を推奨）
const ADMIN_SECRET = process.env.ADMIN_QUEUE_SECRET || 'dears-queue-2024-secret';

export const dynamic = "force-dynamic";

export async function GET(req) {
    // Make.com等の外部ツールが「次の投稿」を取得するためのエンドポイント
    try {
        const { searchParams } = new URL(req.url);
        const secret = searchParams.get('secret');
        const platform = searchParams.get('platform'); // 'twitter' or 'instagram'
        
        if (secret !== ADMIN_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!platform) {
            return NextResponse.json({ error: 'Platform parameter is required' }, { status: 400 });
        }

        // 予約時刻が現在時刻以前の、最も古い未投稿データを1件取得
        const { data: posts, error: fetchError } = await supabase
            .from('scheduled_posts')
            .select('*')
            .eq('status', 'queued')
            .eq('platform', platform)
            .lte('scheduled_at', new Date().toISOString())
            .order('scheduled_at', { ascending: true })
            .limit(1);

        if (fetchError) throw fetchError;

        if (!posts || posts.length === 0) {
            return NextResponse.json({ message: `No queued posts available for ${platform}` }, { status: 404 });
        }

        const post = posts[0];

        // 状態を 'published' に更新して二重投稿を防ぐ
        const { error: updateError } = await supabase
            .from('scheduled_posts')
            .update({ status: 'published', published_at: new Date().toISOString() })
            .eq('id', post.id);

        if (updateError) throw updateError;

        // Make.comが読み取りやすい形でレスポンスを返す
        return NextResponse.json({
            id: post.id,
            platform: post.platform,
            caption: post.caption,
            image_urls: post.image_urls
        });

    } catch (error) {
        console.error("Queue GET Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req) {
    // フロントエンド（管理者ブラウザ）で一括生成された投稿をDBに溜め込むためのエンドポイント
    try {
        const body = await req.json();
        const { secret, posts } = body;
        
        if (secret !== ADMIN_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!posts || !Array.isArray(posts)) {
            return NextResponse.json({ error: 'Invalid payload: "posts" array is required' }, { status: 400 });
        }

        // 保存用にデータを整形
        const records = posts.map(p => ({
            platform: p.platform,
            caption: p.caption,
            image_urls: p.image_urls || [],
            scheduled_at: p.scheduled_at || null,
            status: 'queued'
        }));

        // Supabaseに一括インサート
        const { data, error } = await supabase
            .from('scheduled_posts')
            .insert(records);

        if (error) throw error;

        return NextResponse.json({ success: true, count: records.length });

    } catch (error) {
        console.error("Queue POST Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
