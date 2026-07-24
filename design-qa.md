# Instagramカード操作性 Design QA

## 対象

- 実装画面: `https://sns-agent24.dearsconsulting.com/app`
- 正解画像: `/Users/maedamasahiro/Desktop/スクリーンショット 2026-07-24 15.22.37.png`
- 実装キャプチャ: `/Users/maedamasahiro/Documents/SNS Agent24/design-qa-instagram-card-final.png`
- 比較画像: `/Users/maedamasahiro/Documents/SNS Agent24/design-qa-instagram-card-comparison.png`
- 初回確認画像: `/Users/maedamasahiro/Documents/SNS Agent24/design-qa-instagram-card-before.png`

## キャプチャ条件

- Chrome viewport: 1350 × 900 CSS px
- Device pixel ratio: 1
- 比較用crop: x=301, y=752, 748 × 388 px
- 認証状態: `m.maeda@razu-biz.jp` でログイン済み
- 表示状態: アプリ画面の「対応プラットフォーム」セクション

## 実装と操作確認

- Instagramカードを静的な `div` から、`href="#create-methods"` を持つリンクへ変更した。
- クリック後にURLのhashが `#create-methods` となり、「作成方法を選ぶ」がviewport上端約96pxの位置に表示されることを確認した。
- Enterキーでも同じ位置へ移動することを確認した。
- リンクのアクセシブルネームは「Instagramの投稿作成方法へ移動」。
- `focus-visible` のフォーカスリングを設定した。
- 見た目だけで操作可能と分かるよう「作成方法を見る」と下向き矢印を追加した。

## 見た目比較

- フォント: 既存の見出し、本文、カード内文字の体系を維持。
- 間隔: カード幅176pxを維持し、CTA追加後の高さは165.5px。初回実装の190 × 189.5pxから縮小した。
- 色: Instagramの既存グラデーション、白文字、ピンク系シャドウを維持。
- アイコン: 既存Instagramアイコンを維持し、CTAに既存の矢印アイコンを追加。
- コピー: 説明文を「カードを押すと、下の『作成方法を選ぶ』へ移動します。」へ更新。
- 意図的な差分: 操作可能性を伝えるCTAの追加により、正解画像よりカードが約5.5px高い。

## コンソールと判定

- アプリ由来のコンソールエラーは未検出。
- Chrome拡張機能由来の非同期message channelエラーのみ確認し、アプリ不具合とは切り分けた。
- P0/P1/P2の未解決事項なし。
- 最終結果: passed
