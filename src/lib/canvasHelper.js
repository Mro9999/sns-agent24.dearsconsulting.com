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

            // 動的フォントサイズ
            let fontSize = text.length > 30 ? 60 : 80;
            ctx.font = `bold ${fontSize}px "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif`;

            const maxWidth = canvas.width - 160;
            const actualText = text.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n').replace(/。/g, '');
            const segmentLines = actualText.split('\n');
            const lines = [];

            const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });

            segmentLines.forEach(segment => {
                if (!segment.trim()) {
                    lines.push('');
                    return;
                }

                let currentLine = '';
                const words = Array.from(segmenter.segment(segment)).map(s => s.segment);

                words.forEach((word) => {
                    const testLine = currentLine + word;
                    const metrics = ctx.measureText(testLine);
                    const testWidth = metrics.width;

                    if (testWidth > maxWidth && currentLine !== '') {
                        lines.push(currentLine.trim());
                        currentLine = word;
                    } else {
                        currentLine = testLine;
                    }
                });
                if (currentLine.trim()) {
                    lines.push(currentLine.trim());
                }
            });

            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.shadowColor = 'rgba(0,0,0,0.95)';
            ctx.shadowBlur = 30;
            ctx.shadowOffsetX = 4;
            ctx.shadowOffsetY = 4;

            const lineHeight = fontSize * 1.5;
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
    "鮮やかな暖色系(オレンジ・レッド・イエロー)の光、活発でエネルギッシュな雰囲気",
    "クールな寒色系(ブルー・ティール)のトーン、知的で洗練された雰囲気",
    "モノクロ・シックな黒白基調、プロフェッショナルかつドラマチック",
    "ソフトなパステル・ベージュ系、上品で落ち着いた雰囲気",
    "深いグリーン×ウッドトーン、自然で安心感のある雰囲気",
    "夜景や夕焼け、ネオンを含むダイナミックで印象的な構図",
    "ミニマルな白背景×グラフィック要素、モダンでスタイリッシュ"
];

// 被写体のバリエーション（「手」ばかりにならないよう視点も散らす）
export const SUBJECT_VARIETY_DIRECTIVES = [
    "人物のポートレート中心（目線・表情を主役に）",
    "俯瞰構図の机上シーン（ノート、PC、コーヒーなど）",
    "都会のビル群や街並みを背景にした遠景構図",
    "インテリア空間やオフィスなどの環境ショット",
    "抽象的なグラフィック・幾何学模様・グラデーション",
    "屋外の自然光（公園、海、空）を活かした爽やかな構図",
    "モノや道具のクローズアップ（本、ペン、名刺など）"
];
