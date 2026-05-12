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
