# SNS Agent 24 — マルチAI編成ガイド

このプロジェクトは Claude Code（指揮役）が Codex CLI / Gemini CLI を用途別に呼び分ける編成で開発する。

## 役割分担

| モデル | 担当 |
|---|---|
| **Claude Code (Opus, 私)** | 指揮・設計・対話判断・日本語ニュアンス・論理/文脈整合性チェック・MCP/プラグイン・最終取りまとめ |
| **Codex (GPT-5)** | 数字検算・コード精度レビュー・gpt-image-2 画像生成 (dev時のみ)・Web事実検証・短時間精密タスク |
| **Gemini (2.5)** | 本番ランタイムの researchTrends / generatePost / Imagen 4 画像生成・Google Search Grounding・1M token 長文要約・低コスト推論 |

## 呼び出しトリガー（ユーザー指示語 → CLI）

| 日本語トリガー | 起動するCLI |
|---|---|
| 「Codexと相談しながら」「Codexにも見てもらって」「Codexにセカンドオピニオン」「Codexにファクトチェック」 | `codex exec - <<EOF ... EOF` |
| 「Geminiと相談しながら」「Geminiにも見てもらって」 | `gemini <<EOF ... EOF` |

## 階層化された検証ポリシー（コスト最適化）

- **通常タスク**: 1モデル単独で完結
- **重要判断**: 2モデルでクロスチェック（Claude が指揮 + Codex か Gemini）
- **取り返しのつかない判断**（料金変更・本番DB変更・外部公開する原稿など）: 3モデル合議

「全員ファクトチェック」は冗長なので避ける。

## SNS Agent 24 固有のルーティング

| 作業内容 | 担当 | 理由 |
|---|---|---|
| 本番ランタイムの画像生成 | Imagen 4 (Gemini) | API直叩き可能、量産コスト$0.04/枚 |
| dev中のサンプル画像生成・品質基準の可視化 | gpt-image-2 (Codex builtin image_gen) | ChatGPT Plus課金内で無料、象徴的シーン優位 |
| Geminiプロンプトの設計レビュー | Claude → Codex セカンドオピニオン | プロンプトの捏造禁止・論理整合性をクロスチェック |
| 投稿テキストのファクトチェック | Codex（web search 標準搭載） | リアルタイム事実検証はCodex/Gemini優位、Claudeは学習カットオフあり |
| 長文ドキュメント要約・大量バッチ | Gemini Flash | 1M tok 長文 + 低コスト |
| 数字・料金試算の検算 | Codex | 数学・論理検証で安心感が高い |
| 日本語コピーの最終ニュアンス調整 | Claude | 行間・色気・トーン再現の主担当 |

## Codex 呼び出し時の注意

- 必ずプロジェクトルート（git管理下）から呼ぶ（`--cd "$PWD"`）
- 画像生成は組み込み `image_gen` ツールを明示指定（「APIキーやスクリプトは書かず、組み込みimage_genツールを使う」）
- `--dangerously-bypass-approvals-and-sandbox` はユーザー明示許可がない限り使わない
- 出力先パスは `test-images/sample-{key}.png` のような workdir 内に統一

## ランタイム品質保証パイプライン（dev時設計、runtime はGeminiチームで実行）

「全体ディレクションは Claude Code が管理、ランタイム実行は Gemini チーム」の原則。
Claude Code が dev 時に設計・実装・改善するが、Vercel本番は Claude/Codex を呼ばず Gemini族のみで完結する（追加APIキー不要・低コスト・低レイテンシ）。

### ランタイムの役者編成（投稿生成→Instagram公開までの流れ）

| 役者 | 担当モデル | 責務 |
|---|---|---|
| **作家** | Gemini Pro | caption + carousel_slides[].overlay_copy/.text 生成 |
| **編集者** (Phase 1) | Gemini Flash | 各スライドの本文を読み、tightly-aligned `image_hint_en` を slide ごとに refocus |
| **画家** | Imagen 4 | refined hint で画像生成 |
| **校閲者** (Phase 2, 未実装) | Gemini Vision | 生成画像 vs overlay_copy の整合性採点、低スコアなら編集者に差戻し |
| **品質監督** (Phase 3, Pro Max 限定オプション) | Codex/GPT-5 (要 OpenAI API key) | キャプション全体のファクトチェック・捏造数字検出・スピリチュアル化検出 |

### Phase 1 実装ポイント

- `refineSlideImageHint(overlayCopy, slideText, fallback)` を `src/lib/apiService.js` に追加
- `src/app/api/generate-post-image/route.js` の Imagen 呼び出し直前に各スライドで実行
- 失敗時は generatePost が生成した既存 `image_hint_en` を fallback として使用
- 編集者プロンプトは「DIRECT visual translation of the slide's specific concrete message」を要求

### 全体方針

- Claude Code は dev時にパイプラインを設計・改善し、CLAUDE.md と apiService.js に記録する
- 本番ランタイムは Gemini族（Pro/Flash/Vision/Imagen）で完結（追加APIキー不要）
- Codex/GPT-5 は dev時のセカンドオピニオン専用（runtime には載せない）
- ただし Phase 3 で Pro Max 限定の高精度ファクトチェックを runtime に追加する可能性あり
