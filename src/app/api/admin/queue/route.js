import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { isDuePost, matchPostSnapshot, publishingWindow } from '@/lib/postSafety.mjs';
import { verifyPostImages } from '@/lib/server/postImageSafety.mjs';

// Make.comからの認証用シークレット。未設定ならfail closed。
const ADMIN_SECRET = process.env.ADMIN_QUEUE_SECRET;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeAdminQueue(req) {
    if (!ADMIN_SECRET) {
        return new NextResponse('ADMIN_QUEUE_SECRET is not configured', { status: 500 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    const headerSecret = req.headers.get('x-admin-queue-secret');
    const supplied = bearer || headerSecret;

    if (supplied !== ADMIN_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return null;
}

export async function GET(req) {
    // Make.com等の外部ツールが「次の投稿」を取得するためのエンドポイント
    try {
        const { searchParams } = new URL(req.url);
        const authError = authorizeAdminQueue(req);
        if (authError) return authError;

        const platform = searchParams.get('platform'); // 'twitter' or 'instagram'
        if (!platform) {
            return NextResponse.json({ error: 'Platform parameter is required' }, { status: 400 });
        }

        const window = publishingWindow();

        // 30分を超えて遅れた投稿は取得しない。記録は変更せず、別途日程の確認を行う。
        const { data: posts, error: fetchError } = await supabase
            .from('scheduled_posts')
            .select('*')
            .eq('status', 'queued')
            .eq('platform', platform)
            .gte('scheduled_at', window.earliest)
            .lte('scheduled_at', window.latest)
            .order('scheduled_at', { ascending: true })
            .limit(1);

        if (fetchError) throw fetchError;

        if (!posts || posts.length === 0) {
            return NextResponse.json({ message: `No queued posts available for ${platform}` }, { status: 404 });
        }

        const candidate = posts[0];
        if (!isDuePost(candidate)) return NextResponse.json({ error: 'Publishing window expired' }, { status: 409 });
        if (platform === 'instagram') {
            if (!candidate.caption?.trim()) return NextResponse.json({ error: 'Post caption is missing' }, { status: 422 });
            const validation = await verifyPostImages(candidate);
            if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 422 });
        }

        // 状態を 'publishing' にclaimして二重取得を防ぐ。
        // 実際の投稿成功後は PATCH で 'published' に更新する。
        const claimWindow = publishingWindow();
        const { data: claimed, error: updateError } = await matchPostSnapshot(
            supabase.from('scheduled_posts').update({ status: 'publishing' }), candidate
        )
            .gte('scheduled_at', claimWindow.earliest)
            .lte('scheduled_at', claimWindow.latest)
            .select('*')
            .maybeSingle();

        if (updateError) throw updateError;
        if (!claimed) {
            return NextResponse.json({ error: 'Post was already claimed' }, { status: 409 });
        }

        // Make.comが読み取りやすい形でレスポンスを返す
        // - image_urls: 旧形式の string[] (後方互換)
        // - files: Make.com Instagram for Business "Create a carousel post" モジュールが
        //          期待する [{image_url, media_type}] のオブジェクト配列形式
        //          media_type は 'IMAGE' / 'VIDEO' / 'REELS' のいずれか (大文字必須)
        //          フィールド名は 'image_url' (just 'url' でも 'photo_url' でもなく)
        const rawUrls = Array.isArray(claimed.image_urls) ? claimed.image_urls : [];
        const files = rawUrls
            .filter(u => typeof u === 'string' && u.length > 0)
            .map(url => ({ image_url: url, media_type: 'IMAGE' }));

        return NextResponse.json({
            id: claimed.id,
            platform: claimed.platform,
            caption: claimed.caption,
            image_urls: claimed.image_urls,
            files,
            status: 'publishing',
            ack: {
                method: 'PATCH',
                path: '/api/admin/queue',
                body: { id: claimed.id, status: 'published' }
            }
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
        const authError = authorizeAdminQueue(req);
        if (authError) return authError;

        const { posts } = body;

        if (!posts || !Array.isArray(posts)) {
            return NextResponse.json({ error: 'Invalid payload: "posts" array is required' }, { status: 400 });
        }

        // 保存用にデータを整形
        const records = posts.map(p => ({
            platform: p.platform,
            caption: p.caption,
            image_urls: p.image_urls || [],
            scheduled_at: p.scheduled_at || null,
            status: 'pending_approval'
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

export async function PATCH(req) {
    try {
        const authError = authorizeAdminQueue(req);
        if (authError) return authError;

        const { id, status } = await req.json();
        if (!id || !['published', 'failed'].includes(status)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const updates = status === 'published'
            ? { status: 'published', published_at: new Date().toISOString() }
            : { status: 'failed' };

        const { data: updated, error } = await supabase
            .from('scheduled_posts')
            .update(updates)
            .eq('id', id)
            .eq('status', 'publishing')
            .select('id')
            .maybeSingle();

        if (error) throw error;
        if (!updated) {
            return NextResponse.json({ error: 'Post is not in publishing state' }, { status: 409 });
        }

        return NextResponse.json({ success: true, id, status });
    } catch (error) {
        console.error("Queue PATCH Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
