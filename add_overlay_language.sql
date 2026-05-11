-- ==========================================
-- 画像オーバーレイ用の言語設定を追加
-- ==========================================
-- 背景:
--   既存の `language` カラムは「キャプション」「ハッシュタグ」「スライド本文(text)」など、
--   長文系の出力テキストを多言語化するために使われている (例: 'ja_en' で日英併記)。
--   一方、画像に重ねる overlay_copy は視認性の都合で1言語が圧倒的に読みやすい。
--   そのため、画像オーバーレイ専用の言語設定を別カラムで持つ。
--
-- 既存ユーザーの挙動:
--   - overlay_language が NULL のレコードはアプリ側で 'ja' (日本語) として扱う。
--   - 既存の language 設定 (ja_en 等) は影響を受けない。

ALTER TABLE public.user_batch_settings
ADD COLUMN IF NOT EXISTS overlay_language text DEFAULT 'ja';

-- 確認:
-- SELECT user_id, language, overlay_language FROM user_batch_settings;
