# SNS Agent24

事業情報をもとに、SNS投稿の企画・文章・画像をまとめて作成するWebサービスです。

- Production: https://sns-agent24.dearsconsulting.com/
- Framework: Next.js App Router
- Authentication: Clerk
- Data: Supabase
- Billing: Stripe
- Hosting: Vercel

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Clerkの本番キーは `dearsconsulting.com` 配下でのみブラウザ認証が動作します。ローカルで認証UIまで確認する場合は、Clerkの開発用キーを利用してください。秘密情報はリポジトリへ追加せず、Vercelまたは `.env.local` で管理します。

## Verification

```bash
npm run lint
npm run build
npm audit --omit=dev
```

公開前には、未認証状態で `/app` が `/sign-in` へ転送されること、cron APIが `CRON_SECRET` なしで拒否されること、Stripe・Clerk・SupabaseのWebhook用環境変数が対象環境に登録されていることを確認します。

詳細な運用情報は [SNS_Agent24_Handover_Document.md](./SNS_Agent24_Handover_Document.md) を参照してください。
