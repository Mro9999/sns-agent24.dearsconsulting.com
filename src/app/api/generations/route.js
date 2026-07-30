import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { auth } from '@clerk/nextjs/server';

const jsonError = (message, status) => NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } }
);

const DEFAULT_HISTORY_PAGE_SIZE = 8;
const MAX_HISTORY_PAGE_SIZE = 12;

// 新規生成履歴の保存（POST）
export async function POST(req) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return jsonError('Unauthorized', 401);
        }

        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) {
            console.error("Supabase Admin client is not configured.");
            return jsonError('Database configuration error', 500);
        }

        const body = await req.json();
        const { platform, caption, imageUrls } = body;

        if (!platform) {
            return jsonError('Platform is required', 400);
        }

        const { data, error } = await supabaseAdmin
            .from('generations')
            .insert([
                { user_id: userId, platform, caption, image_urls: imageUrls || [] }
            ])
            .select()
            .single();

        if (error) {
            console.error("Supabase Insert Error:", error);
            return jsonError('Database error', 500);
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error saving generation:", error);
        return jsonError('Internal error', 500);
    }
}

// 過去の生成履歴の取得（GET）
export async function GET(req) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return jsonError('Unauthorized', 401);
        }

        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) {
            console.error("Supabase Admin client is not configured.");
            return jsonError('Database configuration error', 500);
        }

        const requestUrl = new URL(req.url);
        const requestedLimit = Number.parseInt(requestUrl.searchParams.get('limit') || '', 10);
        const requestedOffset = Number.parseInt(requestUrl.searchParams.get('offset') || '', 10);
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), MAX_HISTORY_PAGE_SIZE)
            : DEFAULT_HISTORY_PAGE_SIZE;
        const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;

        // iPadで大量のBase64画像を一度に展開しないよう、履歴はページ単位で取得する。
        const { data, error, count } = await supabaseAdmin
            .from('generations')
            .select('id, platform, caption, image_urls, created_at', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error("Supabase Select Error:", error);
            return jsonError('Database error', 500);
        }

        const items = (data || []).map((generation) => {
            const imageUrls = Array.isArray(generation.image_urls) ? generation.image_urls : [];
            return {
                ...generation,
                image_count: imageUrls.length,
                // 一覧では代表画像だけを返す。全画像のBase64転送・展開を避ける。
                image_urls: imageUrls.slice(0, 1)
            };
        });
        const total = Number.isFinite(count) ? count : offset + items.length;

        return NextResponse.json({
            items,
            total,
            hasMore: offset + items.length < total,
            nextOffset: offset + items.length
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error("Error fetching generations:", error);
        return jsonError('Internal error', 500);
    }
}
