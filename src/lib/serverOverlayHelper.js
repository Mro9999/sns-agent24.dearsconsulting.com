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

// 句点除去 + 文字数に応じた動的フォントサイズ
function pickFontSize(text) {
    const len = (text || '').length;
    if (len > 40) return 50;
    if (len > 28) return 58;
    if (len > 18) return 68;
    return 80;
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
    const cleanText = text.replace(/\\n/g, '\n').replace(/。/g, '');
    const fontSize = pickFontSize(cleanText);
    const lineHeight = Math.round(fontSize * 1.5);
    const effect = getSlideEffect(index);

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
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: fontSize,
                    lineHeight: `${lineHeight}px`,
                    fontWeight: 700,
                    textAlign: 'center',
                    textShadow: '4px 4px 30px rgba(0,0,0,0.95)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                }
            },
            cleanText
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
