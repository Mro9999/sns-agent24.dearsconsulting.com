-- ==========================================
-- SNS Agent 24: 自動予約投稿キュー制作用スクリプト
-- ==========================================
-- 以下のSQL文をすべてコピーし、Supabaseダッシュボードの
-- 「SQL Editor」画面に貼り付けて「RUN（実行）」してください。

-- 1. キュー用テーブルの作成
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    platform text NOT NULL, -- 'twitter' または 'instagram'
    caption text,           -- SNSへ投稿する本文
    image_urls jsonb,       -- 生成された画像URLの配列
    status text DEFAULT 'queued' NOT NULL, -- 'queued' (未投稿), 'published' (投稿済)
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone
);

-- 2. セキュリティ設定（RLS）
-- このテーブルへのアクセスはサーバー（サービスロールキー）からのみ行うため、
-- クライアントからの直接アクセスをすべて遮断します
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

-- ※ もし将来ダッシュボード等で一覧を見たい場合は以下のようなポリシーを追加しますが、
-- 現状はフロントエンドからの取得は行わないため不要です。
-- CREATE POLICY "Enable read access for all users" ON "public"."scheduled_posts" AS PERMISSIVE FOR SELECT TO public USING (true);

-- ==========================================
-- 実行確認方法:
-- 左メニューの「Table Editor」を開き、
-- `scheduled_posts` というテーブルが作成されていれば成功です！
-- ==========================================
