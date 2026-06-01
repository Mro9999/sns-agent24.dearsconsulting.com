// サーバーサイドのオーバーレイ画像合成ヘルパー
// - 既存の src/lib/canvasHelper.js (browser Canvas) のサーバー版
// - @vercel/og (Satori) で JSX→PNG 生成、sharp で JPEG 変換
// - クライアント側 canvas が CORS / キャッシュ問題で失敗していた根本問題への対応

import { ImageResponse } from '@vercel/og';
import sharp from 'sharp';
import path from 'path';
import { readFileSync } from 'fs';
import React from 'react';

// フォントは public/fonts/ に配置 (Vercel デプロイメントに含まれる)
let cachedFonts = null;
function loadFonts() {
    if (cachedFonts) return cachedFonts;
    const cwd = process.cwd();
    const jpFont = readFileSync(path.join(cwd, 'public/fonts/NotoSerifJP-Japanese-Bold.woff'));
    const latinFont = readFileSync(path.join(cwd, 'public/fonts/NotoSerifJP-Latin-Bold.woff'));
    cachedFonts = [
        { name: 'NotoSerifJP', data: jpFont, style: 'normal', weight: 700 },
        { name: 'NotoSerifJP-Latin', data: latinFont, style: 'normal', weight: 700 }
    ];
    return cachedFonts;
}

// カルーセル各スライドのビジュアル効果 (canvasHelper.js と同等)
function getSlideEffect(index) {
    switch (index) {
        case 1:
            return { transform: 'scale(1.4) translate(-15%, -15%)', filter: 'none' };
        case 2:
            return { transform: 'scale(1.5) translate(15%, 15%)', filter: 'grayscale(100%) brightness(0.6) contrast(1.2)' };
        case 3:
            return { transform: 'scale(1.3) translate(15%, -15%)', filter: 'sepia(0.8) contrast(1.3) brightness(0.7)' };
        case 4:
            return { transform: 'scale(1.6) translate(-15%, 15%)', filter: 'blur(8px) brightness(0.6)' };
        default:
            return { transform: 'scale(1.0)', filter: 'none' };
    }
}

// スマホ表示で読めることを優先し、画像上の文字は大きめに固定する。
// 文章量は生成プロンプト側で短く制限し、ここでは1メッセージを強く見せる。
const FIXED_FONT_SIZE = 72;
const TEXT_AREA_WIDTH = 840; // 1080 - 左右120px ずつのマージン (Instagram 4:5 グリッドクロップ対策)
// 1行の最大文字数 (全角換算)。
// 文字を大きくした分、1行は短くして2行でも読み切れる見出しにする。
// 句読点単体の overflow は +1 文字許容 (= 12 chars max) とする。
// 11 chars * 72px ≈ 792px ≤ 840px で Satori の auto-wrap も発動しない範囲。
const MAX_CHARS_PER_LINE = 11;

function sanitizeOverlayText(text) {
    return String(text || '')
        .replace(/[□■]/g, '・')
        .replace(/\s+\n/g, '\n')
        .trim();
}

// ASCII 半角=0.5, それ以外 (主に日本語全角)=1.0 として視覚的長さを近似
function visualLength(str) {
    let len = 0;
    for (const ch of str) {
        len += ch.charCodeAt(0) < 256 ? 0.5 : 1.0;
    }
    return len;
}

// 日本語を意識した改行: 句読点「、。！？」の直後を優先して改行する。
// Satori (CSS) は中国語/日本語の word boundary を理解せず any-char break するため、
// 事前に \n を挿入してから whiteSpace: 'pre-wrap' で表示する。
// 日本語を意識した改行: 句読点「、。！？」の直後を優先して改行する。
// 各行を独立した文字列として配列で返す (呼び出し側で個別の <div> として描画)。
// (旧設計: \n 区切り単一文字列を返して whiteSpace: pre-wrap で表示 → Satori が
//  実レンダリング幅で自動再ラップして、設計したとおりに表示されない事象があった)
function wrapJapaneseTextLines(text) {
    if (!text) return [];

    const cleanText = String(text).replace(/\\n/g, '\n').replace(/。/g, '');
    const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
    const result = [];

    cleanText.split('\n').forEach(segment => {
        if (!segment.trim()) {
            result.push('');
            return;
        }

        const words = Array.from(segmenter.segment(segment)).map(s => s.segment);
        let currentLine = '';
        let lastPunctIndexInLine = -1;

        for (const word of words) {
            const testLine = currentLine + word;
            const testLen = visualLength(testLine);

            // 句読点だけのオーバーフローは前行末に強制吸収して孤立を防ぐ。
            const isOnlyPunct = /^[、。！？「」『』]+$/.test(word);

            if (testLen > MAX_CHARS_PER_LINE && currentLine.length > 0 && !isOnlyPunct) {
                if (lastPunctIndexInLine > 0 && lastPunctIndexInLine < currentLine.length) {
                    const head = currentLine.slice(0, lastPunctIndexInLine);
                    const tail = currentLine.slice(lastPunctIndexInLine);
                    result.push(head);
                    currentLine = tail + word;
                } else {
                    result.push(currentLine);
                    currentLine = word;
                }
                lastPunctIndexInLine = /[、。！？]$/.test(currentLine) ? currentLine.length : -1;
            } else {
                currentLine = testLine;
                if (/[、。！？]$/.test(word)) {
                    lastPunctIndexInLine = currentLine.length;
                }
            }
        }
        if (currentLine.trim()) result.push(currentLine);
    });

    // 後処理: 短すぎる行 (≤ 4 文字) は前後の行と結合して孤立を防ぐ。
    // 例: ["あなたのサービスの『物語』", "は、", "お客様に届いていますか？"] →
    //     ["あなたのサービスの『物語』は、", "お客様に届いていますか？"]
    // 結果として 1〜2 文字程度のオーバーフローは visualLength の許容範囲とする
    // (whiteSpace: nowrap 付き個別 div 描画なのでオーバーしてもキレイには出る)
    const merged = [];
    for (let i = 0; i < result.length; i++) {
        const line = result[i];
        const lineLen = visualLength(line);
        if (lineLen <= 4 && merged.length > 0) {
            // 前行に結合
            merged[merged.length - 1] = merged[merged.length - 1] + line;
        } else if (lineLen <= 4 && i + 1 < result.length) {
            // 次行に結合 (先頭にくる場合)
            result[i + 1] = line + result[i + 1];
        } else {
            merged.push(line);
        }
    }
    return merged;
}

async function resolveBackgroundImageSrc(bgImageUrl) {
    if (!bgImageUrl || typeof bgImageUrl !== 'string') {
        throw new Error('background image URL is empty');
    }

    if (!/^https?:\/\//i.test(bgImageUrl)) {
        return bgImageUrl;
    }

    const res = await fetch(bgImageUrl);
    if (!res.ok) {
        throw new Error(`background image fetch failed: ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
        throw new Error(`background image response is not an image: ${contentType}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1024) {
        throw new Error('background image response is too small');
    }

    return `data:${contentType};base64,${buffer.toString('base64')}`;
}

/**
 * 画像URLにオーバーレイテキストを合成し、JPEG Buffer を返す。
 *
 * @param {string} bgImageUrl  背景画像 (Supabase Storage の公開URL等)
 * @param {string} overlayText  画像上に乗せるテキスト
 * @param {number} index  カルーセル内のスライド番号 (0..4) — 視覚効果切替用
 * @param {object} [options]
 * @param {string} [options.companyName]  overlayText が空のときのフォールバック表示用
 * @returns {Promise<Buffer>}  JPEG image buffer (1080x1080)
 */
export async function composeOverlayImage(bgImageUrl, overlayText, index = 0, options = {}) {
    const { companyName } = options;
    const text = sanitizeOverlayText((overlayText && overlayText.trim()) || `${companyName || ''}\n最新のトレンド情報をチェック`);
    const fontSize = FIXED_FONT_SIZE;
    const lineHeight = Math.round(fontSize * 1.35);
    const effect = getSlideEffect(index);
    const backgroundSrc = await resolveBackgroundImageSrc(bgImageUrl);
    // 日本語を意識した改行を事前計算 (句読点優先で各行に分割)
    const lines = wrapJapaneseTextLines(text);

    // Satori 用 JSX (React.createElement で記述; JSX変換コストを避ける)
    const jsx = React.createElement(
        'div',
        {
            style: {
                width: 1080,
                height: 1080,
                display: 'flex',
                position: 'relative',
                backgroundColor: '#000',
                overflow: 'hidden',
                fontFamily: 'NotoSerifJP, NotoSerifJP-Latin, serif'
            }
        },
        // 背景画像 (cover 全面、各スライドの transform/filter 効果)
        React.createElement('img', {
            src: backgroundSrc,
            width: 1080,
            height: 1080,
            style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: 1080,
                height: 1080,
                objectFit: 'cover',
                transform: effect.transform,
                filter: effect.filter
            }
        }),
        // 暗いグラデーション (下半分にテキスト可読性のため)
        React.createElement('div', {
            style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: 1080,
                height: 1080,
                background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.85) 100%)'
            }
        }),
        // テキスト本体 (中央配置、白、影付き)
        // 各行を独立した <div> として描画し flex column で縦に積む
        // → Satori の auto-wrap が走らないので事前計算した改行が確実に効く
        React.createElement(
            'div',
            {
                style: {
                    position: 'absolute',
                    top: 0,
                    left: 120, // 左右マージン 120px → 840px幅 (Instagram 4:5 グリッドクロップ対策)
                    width: TEXT_AREA_WIDTH,
                    height: 1080,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: fontSize,
                    lineHeight: `${lineHeight}px`,
                    fontWeight: 700,
                    textAlign: 'center',
                    textShadow: '4px 4px 30px rgba(0,0,0,0.95)'
                }
            },
            ...lines.map((line, i) => React.createElement(
                'div',
                { key: i, style: { whiteSpace: 'nowrap' } },
                line
            ))
        )
    );

    const og = new ImageResponse(jsx, {
        width: 1080,
        height: 1080,
        fonts: loadFonts()
    });

    const pngBuffer = Buffer.from(await og.arrayBuffer());
    // PNG → JPEG 変換 (Instagram は JPEG 推奨、ファイルサイズも軽量)
    const jpegBuffer = await sharp(pngBuffer).jpeg({ quality: 90 }).toBuffer();
    return jpegBuffer;
}

/**
 * 外部画像生成が失敗したときのフォールバック。
 * 写真素材なしでも、スマホで読めるテキスト中心のブランドカードを生成する。
 *
 * @param {string} overlayText
 * @param {number} index
 * @param {object} [options]
 * @param {string} [options.companyName]
 * @returns {Promise<Buffer>}
 */
export async function composeTextOnlySlide(overlayText, index = 0, options = {}) {
    const { companyName } = options;
    const text = sanitizeOverlayText((overlayText && overlayText.trim()) || `${companyName || 'SNS Agent 24'}\n投稿案`);
    const fontSize = FIXED_FONT_SIZE;
    const lineHeight = Math.round(fontSize * 1.35);
    const lines = wrapJapaneseTextLines(text);

    const accentSets = [
        { bg1: '#070b14', bg2: '#111827', accent: '#7c3aed', glow: 'rgba(124,58,237,0.28)' },
        { bg1: '#071414', bg2: '#102026', accent: '#0d9488', glow: 'rgba(13,148,136,0.25)' },
        { bg1: '#120912', bg2: '#241126', accent: '#db2777', glow: 'rgba(219,39,119,0.22)' }
    ];
    const theme = accentSets[index % accentSets.length];

    const jsx = React.createElement(
        'div',
        {
            style: {
                width: 1080,
                height: 1080,
                display: 'flex',
                position: 'relative',
                background: `linear-gradient(135deg, ${theme.bg1} 0%, ${theme.bg2} 100%)`,
                overflow: 'hidden',
                fontFamily: 'NotoSerifJP, NotoSerifJP-Latin, serif'
            }
        },
        React.createElement('div', {
            style: {
                position: 'absolute',
                top: -180,
                right: -180,
                width: 520,
                height: 520,
                borderRadius: 520,
                background: theme.glow,
                filter: 'blur(30px)'
            }
        }),
        React.createElement('div', {
            style: {
                position: 'absolute',
                left: 96,
                top: 96,
                width: 160,
                height: 8,
                borderRadius: 8,
                background: theme.accent
            }
        }),
        React.createElement('div', {
            style: {
                position: 'absolute',
                right: 96,
                bottom: 96,
                width: 220,
                height: 220,
                borderRadius: 220,
                border: `3px solid ${theme.accent}`,
                opacity: 0.35
            }
        }),
        React.createElement(
            'div',
            {
                style: {
                    position: 'absolute',
                    left: 120,
                    top: 0,
                    width: TEXT_AREA_WIDTH,
                    height: 1080,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize,
                    lineHeight: `${lineHeight}px`,
                    fontWeight: 700,
                    textAlign: 'center',
                    textShadow: '4px 4px 26px rgba(0,0,0,0.9)'
                }
            },
            ...lines.map((line, i) => React.createElement(
                'div',
                { key: i, style: { whiteSpace: 'nowrap' } },
                line
            ))
        )
    );

    const og = new ImageResponse(jsx, {
        width: 1080,
        height: 1080,
        fonts: loadFonts()
    });

    const pngBuffer = Buffer.from(await og.arrayBuffer());
    return await sharp(pngBuffer).jpeg({ quality: 90 }).toBuffer();
}
