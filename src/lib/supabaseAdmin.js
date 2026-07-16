import 'server-only';
import { createClient } from '@supabase/supabase-js';

let client = null;

// Build時に秘密情報がなくてもモジュール評価で失敗しないよう遅延初期化する。
export function getSupabaseAdmin() {
    if (client) return client;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return null;

    client = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
    return client;
}

// 既存のRoute Handler向け互換エクスポート。実クライアントは最初のアクセス時に生成する。
export const supabaseAdmin = new Proxy({}, {
    get(_target, property) {
        const current = getSupabaseAdmin();
        if (!current) {
            throw new Error('Supabase Admin is not configured');
        }
        const value = Reflect.get(current, property);
        return typeof value === 'function' ? value.bind(current) : value;
    },
});
