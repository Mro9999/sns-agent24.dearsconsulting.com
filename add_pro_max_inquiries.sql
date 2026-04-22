-- ==========================================
-- Pro Max Plan 個別相談申込テーブル
-- ==========================================
-- Pro Max Plan はセルフ契約ではなく、個別相談 → カスタム設定 → 契約 という
-- エンタープライズ型フローで提供する。申込情報をここに保存して運営側で対応する。

CREATE TABLE IF NOT EXISTS public.pro_max_inquiries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id text,                                          -- ログイン中のClerk user_id（未ログインの場合はnull）
    company_name text NOT NULL,
    contact_name text NOT NULL,
    email text NOT NULL,
    phone text,
    business_description text,                             -- 事業内容（簡単な説明）
    inquiry_details text,                                  -- 相談内容の詳細
    status text DEFAULT 'new' NOT NULL,                    -- new / contacted / onboarding / contracted / declined
    admin_notes text,                                      -- 運営側メモ
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.pro_max_inquiries ENABLE ROW LEVEL SECURITY;

-- ステータス別インデックス（ダッシュボードで新規申込を素早く取得するため）
CREATE INDEX IF NOT EXISTS idx_pro_max_inquiries_status
ON public.pro_max_inquiries (status, created_at DESC);

-- ==========================================
-- 確認:
-- SELECT * FROM pro_max_inquiries ORDER BY created_at DESC LIMIT 10;
-- ==========================================
