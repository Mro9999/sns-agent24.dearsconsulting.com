// 文字オーバーレイ・ロゴ合成を行う汎用Canvasヘルパー
// - textToOverlay: 画像中央に配置する文字列
// - bgUrl: 背景画像のURL（http… or data:image…）
// - index: カルーセル内のスライド番号(0〜4)。1以上でパン&ズーム&フィルター効果が切り替わる
// - options.logoUrl: ロゴ画像（右下に合成）
// - options.companyName: textToOverlayが空の場合のフォールバック用
export async function drawCanvasImage(textToOverlay, bgUrl, index = 0, options = {}) {
    const { logoUrl, companyName } = options;

    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');

        const bgImg = new Image();
        if (bgUrl && bgUrl.startsWith('http')) {
            bgImg.crossOrigin = 'anonymous';
        }

        bgImg.onload = async () => {
            // エフェクト用の定数定義 (デフォルトは等倍、中央配置、フィルターなし)
            let zoomScale = 1.0;
            let filter = 'none';
            let panX = 0.5;
            let panY = 0.5;

            // カルーセルのページ(index)に応じた大胆な視覚的バリエーション
            if (index === 1) {
                zoomScale = 1.4;
                panX = 0.2;
                panY = 0.2;
            } else if (index === 2) {
                zoomScale = 1.5;
                panX = 0.8;
                panY = 0.8;
                filter = 'grayscale(100%) brightness(0.6) contrast(1.2)';
            } else if (index === 3) {
                zoomScale = 1.3;
                panX = 0.8;
                panY = 0.2;
                filter = 'sepia(0.8) contrast(1.3) brightness(0.7)';
            } else if (index === 4) {
                zoomScale = 1.6;
                panX = 0.2;
                panY = 0.8;
                filter = 'blur(8px) brightness(0.6)';
            }

            // アスペクト比を維持しつつカバー全面に描画
            const baseScale = Math.max(canvas.width / bgImg.width, canvas.height / bgImg.height);
            const finalScale = baseScale * zoomScale;
            const drawWidth = bgImg.width * finalScale;
            const drawHeight = bgImg.height * finalScale;

            const dx = (canvas.width - drawWidth) * panX;
            const dy = (canvas.height - drawHeight) * panY;

            ctx.save();
            ctx.filter = filter;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bgImg, dx, dy, drawWidth, drawHeight);
            ctx.restore();

            // テキスト可読性向上のためのダークグラデーション
            const grad = ctx.createLinearGradient(0, canvas.height * 0.3, 0, canvas.height);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(0.5, 'rgba(0,0,0,0.4)');
            grad.addColorStop(1, 'rgba(0,0,0,0.85)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 描画するテキスト
            const text = textToOverlay || `${companyName ? companyName + '\\n' : ''}最新のトレンド情報をチェック！`;

            // ⚠️ Instagram のプロフィールグリッドは 4:5 縦長クロップで表示される (2024 リニューアル以降)。
            // 1080x1080 の中央 864x1080 (= 1080*4/5) しか可視化されないため、
            // 左右各 108px がカットされる。ここに textをはみ出させると "テキストが切れる" 見栄えになる。
            // よってテキスト幅は最低でも 864px 以下、安全マージンを取って 800px (= canvas.width - 280) に制約する。
            const maxWidth = canvas.width - 280;
            const actualText = text.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n').replace(/。/g, '');
            const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });

            // 指定したフォントサイズで改行処理したlinesを返す
            // 句読点（「、」など）の直後で改行することを優先し、不自然な途中改行を防ぐ
            const wrapLines = (fontSize) => {
                ctx.font = `bold ${fontSize}px "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif`;
                const segmentLines = actualText.split('\n');
                const result = [];

                segmentLines.forEach(segment => {
                    if (!segment.trim()) {
                        result.push('');
                        return;
                    }

                    let currentLine = '';
                    let lastPunctIndex = -1; // currentLine中の最後に出た句読点位置(その直後で改行すると自然)
                    const words = Array.from(segmenter.segment(segment)).map(s => s.segment);

                    words.forEach((word) => {
                        const testLine = currentLine + word;
                        const testWidth = ctx.measureText(testLine).width;

                        if (testWidth > maxWidth && currentLine !== '') {
                            // 幅を超えた：現在行の途中に句読点があれば、そこで分割(後半を次行に持ち越し)
                            if (lastPunctIndex > 0 && lastPunctIndex < currentLine.length) {
                                const head = currentLine.slice(0, lastPunctIndex);
                                const tail = currentLine.slice(lastPunctIndex);
                                result.push(head.trim());
                                currentLine = tail + word;
                            } else {
                                result.push(currentLine.trim());
                                currentLine = word;
                            }
                            lastPunctIndex = /[、。！？]$/.test(currentLine) ? currentLine.length : -1;
                        } else {
                            currentLine = testLine;
                            // 「、」「。」「！」「？」の直後位置を記録
                            if (/[、。！？]$/.test(word)) {
                                lastPunctIndex = currentLine.length;
                            }
                        }
                    });
                    if (currentLine.trim()) {
                        result.push(currentLine.trim());
                    }
                });

                return result;
            };

            // 改行が不自然かどうかを検出
            // 1) 最後の行が極端に短い（「ない」など孤児）
            // 2) 任意の行が「最長行の40%未満」なら、途中改行がぎこちない可能性が高いと判定
            const hasAwkwardBreak = (lines) => {
                const nonEmpty = lines.filter(l => l.replace(/\s/g, '').length > 0);
                if (nonEmpty.length < 2) return false;

                // 最後の行が短すぎる（5文字以下）
                const last = nonEmpty[nonEmpty.length - 1].replace(/\s/g, '');
                if (last.length <= 5) return true;

                // 他の行と比べて極端に短い行がある（最長行の40%未満）
                const lengths = nonEmpty.map(l => l.length);
                const maxLen = Math.max(...lengths);
                if (maxLen > 6) {
                    const hasShort = lengths.some(l => l < maxLen * 0.4);
                    if (hasShort) return true;
                }
                return false;
            };

            // 動的フォントサイズ: スマホで約320px幅まで縮小されても
            // 画像内コピーが25px前後で読める大きさを優先する。
            let fontSize;
            if (text.length > 40) fontSize = 72;
            else if (text.length > 28) fontSize = 80;
            else if (text.length > 18) fontSize = 88;
            else fontSize = 96;

            const MIN_FONT_SIZE = 68;
            let lines = wrapLines(fontSize);

            // 不自然な改行が検出される間、フォントサイズを下げて再試行
            while (hasAwkwardBreak(lines) && fontSize > MIN_FONT_SIZE) {
                fontSize -= 4;
                lines = wrapLines(fontSize);
            }

            // それでも極端に短い末行があれば、前の行へマージ（多少幅超過してでも可読性優先）
            const nonEmpty = lines.filter(l => l.replace(/\s/g, '').length > 0);
            if (nonEmpty.length >= 2) {
                const last = nonEmpty[nonEmpty.length - 1].replace(/\s/g, '');
                if (last.length <= 4) {
                    const lastLine = lines.pop();
                    const prevLine = lines.pop();
                    lines.push((prevLine + lastLine).trim());
                }
            }

            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.shadowColor = 'rgba(0,0,0,0.95)';
            ctx.shadowBlur = 30;
            ctx.shadowOffsetX = 4;
            ctx.shadowOffsetY = 4;

            const lineHeight = fontSize * 1.32;
            const totalTextHeight = (lines.length - 1) * lineHeight;
            const startY = (canvas.height / 2) - (totalTextHeight / 2);

            lines.forEach((line, idx) => {
                if (line) {
                    ctx.fillText(line, canvas.width / 2, startY + (idx * lineHeight));
                }
            });

            ctx.restore();

            // ロゴ画像があれば右下に合成
            if (logoUrl) {
                try {
                    const logoImg = new Image();
                    if (logoUrl.startsWith('http')) {
                        logoImg.crossOrigin = 'anonymous';
                    }
                    await new Promise((res, rej) => { logoImg.onload = res; logoImg.onerror = rej; logoImg.src = logoUrl; });

                    const maxLogoSize = 250;
                    const size = Math.min(maxLogoSize, logoImg.width, logoImg.height);
                    const padding = 40;
                    const x = canvas.width - padding - size;
                    const y = canvas.height - padding - size;
                    const centerX = x + size / 2;
                    const centerY = y + size / 2;

                    ctx.save();
                    ctx.shadowColor = 'rgba(0,0,0,0)';
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;

                    ctx.drawImage(logoImg, x, y, size, size);

                    ctx.beginPath();
                    ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2, true);
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                    ctx.stroke();
                    ctx.restore();
                } catch (e) {
                    console.log("ロゴの合成に失敗しました", e);
                }
            }

            resolve(canvas.toDataURL('image/jpeg', 0.95));
        };

        bgImg.onerror = () => {
            console.error('Base Image load error');
            resolve(null);
        };

        bgImg.src = bgUrl;
    });
}

// バッチ生成時の画像多様性のためのビジュアル指示集
// post indexに応じて異なるビジュアル方向性を強制することで、
// 同じブランド内でも複数投稿を跨いだ画像のテイストが単調にならないようにする
export const VISUAL_VARIETY_DIRECTIVES = [
    "自然光の入る室内、落ち着いた色調、現実の店舗や相談スペースの空気感",
    "木材・布・紙・陶器など普通の素材感が伝わる、静かな接写",
    "日中の店頭・受付・客室・棚まわりなど、実在しそうな顧客接点",
    "人の顔を強調しすぎない横顔・後ろ姿・手元、自然な距離感",
    "余白のあるシンプルな構図、過度な演出や抽象表現を避ける",
    "小さな不完全さが残るリアルな現場写真、ストックフォト風の完璧さを避ける",
    "暗すぎない自然な影、CG・ネオン・発光表現・未来的な演出を避ける"
];

// 被写体のバリエーション（「手」ばかりにならないよう視点も散らす）
export const SUBJECT_VARIETY_DIRECTIVES = [
    "商品棚や陳列の見直しをしている手元（文字・ラベルは写さない）",
    "受付や相談テーブルで無地の資料・素材サンプルを並べる場面",
    "旅館・店舗・工房などの空間の一角を、少し引いた構図で見せる",
    "梱包台・検品台・作業台で商品に触れる自然な動作",
    "お客さんが触れる入口・棚・客室・包装などの細部",
    "スタッフの後ろ姿や横顔を含む、静かな接客準備の場面",
    "無地の小物や素材を使った、文字のない現実的な比較場面"
];
