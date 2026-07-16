import { NextResponse } from 'next/server';
import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { waitUntil } from '@vercel/functions';
import { generateWeeklyPostsForSettings } from '@/lib/weeklyBatchGenerator';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
const BATCH_REQUEST_TTL_MS = 15 * 60 * 1000;

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

// Pro Max の「1週間分まとめて生成」をサーバー側で開始する。
// iPhone Safari は長いPOST待機中に Load failed になりやすいため、
// APIはすぐ202を返し、実生成はVercel waitUntilで継続する。
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

        const { count: pendingCount, error: pendingError } = await supabase
            .from('scheduled_posts')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'pending_approval');

        if (pendingError) throw pendingError;
        if ((pendingCount || 0) > 0) {
            return NextResponse.json({
                success: true,
                started: false,
                already_pending: true,
                count: pendingCount
            });
        }

        const body = await req.json().catch(() => null);
        if (!body) {
            return NextResponse.json({ error: 'JSON body required' }, { status: 400 });
        }
        const clientRequestId = typeof body.client_request_id === 'string' ? body.client_request_id : null;

        if (clientRequestId) {
            const { data: existingSettings, error: existingSettingsError } = await supabase
                .from('user_batch_settings')
                .select('product_context')
                .eq('user_id', userId)
                .maybeSingle();

            if (existingSettingsError) throw existingSettingsError;

            const existingContext = existingSettings?.product_context || {};
            const existingStartedAt = existingContext.__batch_generation_started_at
                ? new Date(existingContext.__batch_generation_started_at).getTime()
                : 0;
            const isSameRecentRequest =
                existingContext.__batch_request_id === clientRequestId &&
                Number.isFinite(existingStartedAt) &&
                Date.now() - existingStartedAt < BATCH_REQUEST_TTL_MS;

            if (isSameRecentRequest) {
                return NextResponse.json({
                    success: true,
                    started: true,
                    duplicate: true,
                    expected_count: 7,
                    started_at: existingContext.__batch_generation_started_at
                }, { status: 202 });
            }
        }

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress || null;
        const startedAt = new Date().toISOString();
        const productContext = sanitizeProductContext(body.product_context);
        if (clientRequestId) {
            productContext.__batch_request_id = clientRequestId;
            productContext.__batch_generation_started_at = startedAt;
        }

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

        waitUntil(
            generateWeeklyPostsForSettings(settings, {
                sendEmail: false,
                logPrefix: '[batch-generate]'
            })
                .then((count) => {
                    console.log(`[batch-generate] ${userId} background completed: ${count} posts`);
                })
                .catch((err) => {
                    console.error(`[batch-generate] ${userId} background failed:`, err);
                })
        );

        return NextResponse.json({
            success: true,
            started: true,
            expected_count: 7,
            started_at: startedAt
        }, { status: 202 });
    } catch (error) {
        console.error('[batch-generate] POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
