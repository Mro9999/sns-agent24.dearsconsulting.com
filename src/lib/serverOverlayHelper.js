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

// カルーセル内で各スライド間の見栄えを揃えるため、フォントサイズは固定 56px。
// (旧設計: 文字数に応じて 50/58/68/80px と変動 → スライド毎に文字サイズがバラつき視覚的に違和感)
const FIXED_FONT_SIZE = 56;
const TEXT_AREA_WIDTH = 800; // 1080 - 左右140px ずつのマージン (Instagram 4:5 グリッドクロップ対策)
// 1行の最大文字数 (全角換算)。Satori 実測で 56px 全角は ~58-60px advance のため、
// 余裕を持たせて 12 文字/行 (= 720px ≤ 800px) を上限とする。
// 旧 13.79 (理論値 800/56-0.5) は「売上データが教えてくれない、」(14文字) を overflow させ、
// 句読点だけが次行頭に飛ばされる原因になっていた。
const MAX_CHARS_PER_LINE = 12;

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

    return result;
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
    const text = (overlayText && overlayText.trim()) || `${companyName || ''}\n最新のトレンド情報をチェック`;
    const fontSize = FIXED_FONT_SIZE;
    const lineHeight = Math.round(fontSize * 1.5);
    const effect = getSlideEffect(index);
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
            src: bgImageUrl,
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
                    left: 140, // 左右マージン 140px → 800px幅 (Instagram 4:5 グリッドクロップ対策)
                    width: 800,
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
