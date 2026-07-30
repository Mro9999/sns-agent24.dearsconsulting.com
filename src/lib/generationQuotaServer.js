import 'server-only';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from './supabaseAdmin';
import {
    FREE_DAILY_GENERATION_LIMIT,
    hasUnlimitedGenerationAccess
} from './generationQuota.mjs';

function primaryEmailFor(user) {
    return user.emailAddresses?.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress
        || user.emailAddresses?.[0]?.emailAddress
        || null;
}

function isAdminEmail(email) {
    if (!email) return false;
    const adminEmails = [
        process.env.ADMIN_EMAIL,
        ...(process.env.ADMIN_ACCESS_EMAILS || '').split(',')
    ]
        .map((value) => value?.trim().toLowerCase())
        .filter(Boolean);
    return adminEmails.includes(email.toLowerCase());
}

export async function reserveGenerationQuota() {
    const { userId } = await auth();
    if (!userId) {
        throw new Error('ログイン状態を確認できませんでした。もう一度ログインしてください。');
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const metadataRole = user.publicMetadata?.role || 'free';
    const role = isAdminEmail(primaryEmailFor(user)) ? 'admin' : metadataRole;

    if (hasUnlimitedGenerationAccess(role)) {
        return {
            allowed: true,
            charged: false,
            limit: null,
            remaining: null,
            role
        };
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        throw new Error('生成回数を確認できませんでした。時間をおいて、もう一度お試しください。');
    }

    const { data, error } = await supabase.rpc('reserve_generation_quota', {
        p_user_id: userId,
        p_daily_limit: FREE_DAILY_GENERATION_LIMIT
    });
    if (error) {
        console.error('[generation-quota] reserve failed:', error);
        throw new Error('生成回数を確認できませんでした。時間をおいて、もう一度お試しください。');
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
        allowed: row?.allowed === true,
        charged: row?.allowed === true,
        limit: FREE_DAILY_GENERATION_LIMIT,
        used: Number(row?.used_count || 0),
        remaining: Number(row?.remaining_count || 0),
        quotaDate: row?.quota_date || null,
        role
    };
}

export async function releaseGenerationQuota(reservation) {
    if (!reservation?.charged) return;

    try {
        const { userId } = await auth();
        if (!userId) {
            console.error('[generation-quota] release skipped because the user session is unavailable');
            return;
        }

        const supabase = getSupabaseAdmin();
        if (!supabase) {
            console.error('[generation-quota] release skipped because Supabase Admin is unavailable');
            return;
        }

        const { error } = await supabase.rpc('release_generation_quota', {
            p_user_id: userId
        });
        if (error) {
            console.error('[generation-quota] release failed:', error);
        }
    } catch (error) {
        // 回数返却の失敗で本来の生成エラーを上書きしない。
        console.error('[generation-quota] release failed unexpectedly:', error);
    }
}
