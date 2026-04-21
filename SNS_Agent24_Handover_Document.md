# SNS Agent 24 (InstagramAuto) 技術仕様兼引き継ぎドキュメント

このドキュメントは、本プロジェクト（SNS Agent 24 / ディレクトリ名: InstagramAuto）を他のAIエージェントや開発者が完全に理解し、環境の構築・再現、および継続的な開発を行えるようにするための包括的な技術資料です。

## 1. プロジェクト概要
「SNS Agent 24」は、AIを活用したソーシャルメディア（Instagram, X(Twitter), Facebook）向けの自動コンテンツ生成・運用システムです。
指定したターゲットやビジネステーマに基づき、最新のトレンドをリサーチし、キャプション・ハッシュタグ・画像のアイデア・そして実際に投稿する画像までを全自動で一括構築（バッチ生成）できるプロフェッショナル向けツールです。

## 2. 技術スタック
*   **フレームワーク**: Next.js (App Routerベース)
*   **フロントエンド**: React, Tailwind CSS, Lucide React (アイコン群)
*   **認証基盤**: Clerk (`@clerk/nextjs`)
*   **データベース/ストレージ**: Supabase
*   **決済システム**: Stripe
*   **主要AIモデル (Google GenAI)**: 
    *   テキスト生成: `gemini-2.5-pro` 等
    *   画像生成: `imagen-3.0-generate-001`
*   **外部連携**: Make.com (Google Sheets等への一括転送処理用Webhook)
*   **分析ツール**: PostHog

## 3. ディレクトリ・アーキテクチャ
プロジェクト内の重要なディレクトリとファイルの役割は以下の通りです。

```text
InstagramAuto/
├── src/
│   ├── app/
│   │   ├── page.js                 # ランディングページ (LP)
│   │   ├── layout.js               # 全体レイアウト、ClerkProvider定義
│   │   ├── app/                    
│   │   │   └── page.js             # 【中核UI】メイン生成画面、バッチ処理UI
│   │   ├── dashboard/              # ユーザーの履歴や予約キュー管理画面
│   │   └── api/                    # バックエンドAPI (Route Handlers)
│   │       ├── admin/              # Supabaseキュー保存や特別な権限処理
│   │       ├── download/           # 生成画像の一括ダウンローダー機能
│   │       ├── webhooks/           # Make.com / Clerk / Stripe などのWebhook受信
│   │       └── generations/        # ユーザーの生成履歴保存
│   ├── components/                 
│   │   ├── features/               # セレクタ群 (Selectors.jsなど)
│   │   └── layout/                 # PricingSection.js などレイアウト関連
│   ├── lib/
│   │   ├── apiService.js           # 【要】Gemini APIとの通信処理、リトライ処理
│   │   ├── supabase.js             # Supabaseクライアント (Client-side)
│   │   ├── supabaseAdmin.js        # Supabaseクライアント (Server-side 権限)
│   │   └── stripe.js               # Stripe決済ユーティリティ
│   └── middleware.js               # Clerkによる認証ルート保護設定
├── .env.local                      # 環境変数群
├── tailwind.config.js              # Tailwind設定
└── package.json                    # 依存関係
```

## 4. コア機能の仕様と挙動

### 4.1. コンテンツの生成フロー (`src/lib/apiService.js`)
ユーザーが単発生成、または「1週間分自動構築」のバッチ生成を実行した際、以下のステップでAIが処理を行います。

1.  **`researchTrends()`**: 現在のトレンドやターゲットのインサイトを調べ、コンセプトを構築する。
2.  **`generatePost()`**: リサーチ結果と指定パラメータ（ターゲット、トーンなど）を元に、投稿文（キャプション）、ハッシュタグ、そして画像プロンプト（指示書）を生成する。
3.  **`generateImage()`**: 投稿文に合わせた画像（カルーセル用は複数枚）を `imagen-3.0-generate-001` モデルを用いて生成する。

### 4.2. クラウドへの保存とWebhook連携 (`src/app/app/page.js`)
*   生成された画像は `/api/upload-image` へ送られ、ストレージに保存後、公開URLを取得します。
*   出来上がったセットは `/api/admin/queue` によってSupabaseのデータベースに保存されます。
*   同時に `/api/webhooks/make` 経由で Make.com に送信され、Google Sheets等への自動連携フローが動きます。

## 5. 直近の課題とエラー対策（引き継ぎ時の重要事項）

直近の開発において、**「バッチ生成時（10件目など）に、一時的なGemini APIのレート制限（429 Too Many Requests）やサーバー高負荷（503 MODEL_CAPACITY_EXHAUSTED）により、プログラム全体がクラッシュしデータが消滅してしまう」**という課題が発生していました。

以下の改修が実装済みですが、再現環境構築時や更なる拡張の際に必ず念頭に置いてください。

1.  **Exponential Backoff リトライの実装（`apiService.js`）**:
    APIの呼び出しを `withRetry` というラッパー関数で囲んでいます。503や429エラーが出た場合、数秒〜十数秒の間隔を空けながら最大3回まで自動で再試行する仕組みです。
2.  **バッチ処理の耐障害性向上（`src/app/app/page.js - handleBatchGenerate`）**:
    ループ処理内で例外が発生しても全体を止めず、**エラーになったその1件だけをスキップし、長め（約10秒）の待機を挟んでから次の件の生成を続行する**ように `try...catch` で囲み、安全に残りのデータを保存できるように作られています。

## 6. 必須となる環境変数 (`.env.local`)
プロジェクトを動作させるには、以下の環境変数が設定されている必要があります。他のAIに環境構築を行わせる際は、これらが揃っているか確認してください。

```env
# Google Gemini API
NEXT_PUBLIC_GEMINI_API_KEY="..."

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="..."
CLERK_SECRET_KEY="..."
WEBHOOK_SECRET="..." # Clerk webhook検証用

# Supabase
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..." # supabaseAdmin.js 用

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="..."
STRIPE_SECRET_KEY="..."
STRIPE_WEBHOOK_SECRET="..."

# Other
NEXT_PUBLIC_POSTHOG_KEY="..."
NEXT_PUBLIC_POSTHOG_HOST="..."
```

## 7. 他のAIへ引き継ぎを行う際のプロンプト（指示）例
他のAI（ChatGPTやClaudeなど）に引き継ぐ際は、ファイル群と併せて以下のプロンプトを入力すると確実な理解を促せます。

> *"あなたはNext.js (App Router), Node.js, Google Gemini API, Supabaseに精通したシニアエンジニアです。現在、AIを活用したInstagram/X用コンテンツの自動生成ツール「SNS Agent 24」の開発を引き継いでいます。提供した技術仕様ドキュメント（ディレクトリ構造やAPIリトライロジック、バッチ生成の挙動など）を全て読み込み、システムの実装状態と直近の『API制限エラー対応』の堅牢化の文脈を完全に理解した上で、今後の改修・コーディングアシストを行なってください。"*
