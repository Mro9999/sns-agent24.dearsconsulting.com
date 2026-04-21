-- ==========================================
-- 週次自動バッチ生成のためのユーザー設定テーブル
-- ==========================================

-- 1. ユーザーごとの最後のバッチ生成設定を保存するテーブル
CREATE TABLE IF NOT EXISTS public.user_batch_settings (
    user_id text PRIMARY KEY,
    email text,
    enabled boolean DEFAULT true NOT NULL,
    category_id text,
    purpose_id text,
    target_id text,
    gender text,
    business_style text,
    tone text,
    language text DEFAULT 'ja',
    format text DEFAULT 'carousel',
    product_context jsonb,
    user_profile jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. RLS設定（サーバー側からのみアクセス）
ALTER TABLE public.user_batch_settings ENABLE ROW LEVEL SECURITY;

-- 3. scheduled_posts に 'pending_approval' ステータスを追加可能にする
--    既存の CHECK制約がある場合は ALTER して 'pending_approval' も許可
--    （現状は制約なしのようなので何もしなくてOK）

-- 4. scheduled_posts に user_id カラム追加（複数ユーザー対応のため）
ALTER TABLE public.scheduled_posts
ADD COLUMN IF NOT EXISTS user_id text;

-- 5. 承認時にブラウザCanvasでoverlay再合成するために必要なデータを保持
ALTER TABLE public.scheduled_posts
ADD COLUMN IF NOT EXISTS overlay_copy text;

ALTER TABLE public.scheduled_posts
ADD COLUMN IF NOT EXISTS carousel_slides jsonb;

ALTER TABLE public.scheduled_posts
ADD COLUMN IF NOT EXISTS product_context jsonb;

-- image_idea: 承認画面で後から画像を生成するための指示文
ALTER TABLE public.scheduled_posts
ADD COLUMN IF NOT EXISTS image_idea text;

-- 6. インデックス（承認待ち取得の高速化）
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_pending
ON public.scheduled_posts (user_id, status, scheduled_at);

-- ==========================================
-- 確認:
-- SELECT * FROM user_batch_settings;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'scheduled_posts';
-- ==========================================
