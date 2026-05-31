import { NextResponse } from 'next/server';
import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { generateWeeklyPostsForSettings } from '@/lib/weeklyBatchGenerator';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function pickId(value) {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return value.id || value.label || null;
    return null;
}

function sanitizeProductContext(productContext) {
    const clean = { ...(productContext || {}) };
    delete clean.logoUrl;
    delete clean.baseImage;
    delete clean.baseImages;
    return clean;
}

// Pro Max の「1週間分まとめて生成」をサーバー側で完結させる。
// ブラウザ側で7件を順番生成すると、タブ停止やスリープで保存前に中断されるため。
export async function POST(req) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const cc = await clerkClient();
        const clerkUser = await cc.users.getUser(userId);
        const role = clerkUser.publicMetadata?.role;
        const isAdmin = role === 'admin';
        const isProMax = role === 'promax' || isAdmin;
        if (!isProMax) {
            return new NextResponse('Forbidden - Pro Max Plan required', { status: 403 });
        }

        const body = await req.json().catch(() => null);
        if (!body) {
            return NextResponse.json({ error: 'JSON body required' }, { status: 400 });
        }

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress || null;
        const productContext = sanitizeProductContext(body.product_context);

        const settings = {
            user_id: userId,
            email,
            category_id: pickId(body.category_id ?? body.category),
            purpose_id: pickId(body.purpose_id ?? body.purpose),
            target_id: pickId(body.target_id ?? body.target),
            gender: body.gender || null,
            business_style: body.business_style || null,
            tone: body.tone || null,
            language: body.language || 'ja',
            overlay_language: body.overlay_language || 'ja',
            format: 'carousel',
            product_context: productContext,
            user_profile: body.user_profile || null,
            enabled: true,
            updated_at: new Date().toISOString()
        };

        const { error: settingsError } = await supabase
            .from('user_batch_settings')
            .upsert(settings, { onConflict: 'user_id' });

        if (settingsError) throw settingsError;

        const count = await generateWeeklyPostsForSettings(settings, {
            sendEmail: false,
            logPrefix: '[batch-generate]'
        });

        if (count === 0) {
            return NextResponse.json({
                error: '生成できた投稿がありませんでした。品質チェックまたはAPI制限で全件スキップされた可能性があります。'
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, count });
    } catch (error) {
        console.error('[batch-generate] POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
