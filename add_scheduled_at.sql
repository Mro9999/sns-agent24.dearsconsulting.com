-- ==========================================
-- scheduled_posts テーブルに予約投稿時刻カラムを追加
-- ==========================================
-- Supabaseダッシュボードの「SQL Editor」で実行してください。

-- 1. scheduled_at カラムを追加（予約投稿時刻）
ALTER TABLE public.scheduled_posts
ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone;

-- 2. 既存の queued レコード（126件）に仮の scheduled_at を設定
--    created_at を基準に、1件ごとに3時間ずらして割り当て
UPDATE public.scheduled_posts
SET scheduled_at = created_at + (ROW_NUMBER() OVER (ORDER BY created_at) - 1) * INTERVAL '3 hours'
WHERE status = 'queued' AND scheduled_at IS NULL;

-- 3. インデックス追加（ポーリング時のクエリ高速化）
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_queue
ON public.scheduled_posts (status, platform, scheduled_at);

-- ==========================================
-- 確認方法:
-- SELECT id, platform, scheduled_at, status FROM scheduled_posts ORDER BY scheduled_at LIMIT 10;
-- ==========================================
