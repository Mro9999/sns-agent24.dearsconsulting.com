// SNS各プラットフォームのキャプション文字数制限とビルダー

// 各SNSの公式仕様（2026-04時点）
export const PLATFORM_CAPTION_LIMITS = {
    instagram: 2200, // Instagram の公式上限
    x: 280,          // X (Twitter) 上限（日本語等は文字weightで変動するが概算）
    facebook: 63206, // Facebookは事実上制限なし
    tiktok: 2200,
    threads: 500
};

const ELLIPSIS = '…';
const SAFETY_MARGIN = 8; // 改行・絵文字バリエーション等のための余裕

/**
 * 指定プラットフォームの上限内に収まる最終キャプションを構築する。
 * - hashtags は末尾に保持される（投稿本文を優先的に切り詰め）
 * - 切り詰めが発生した場合は本文末尾に「…」を付与
 *
 * @param {string} captionBody  投稿本文（hashtag含まない）
 * @param {string[]} [hashtagsArr]  ハッシュタグ配列（# 付き or 無し どちらでも可）
 * @param {string} [platform='instagram']  対象プラットフォーム
 * @returns {string}  上限以内に収まった最終キャプション
 */
export function buildPlatformCaption(captionBody, hashtagsArr, platform = 'instagram') {
    const limit = PLATFORM_CAPTION_LIMITS[platform] || PLATFORM_CAPTION_LIMITS.instagram;

    const tags = (hashtagsArr || [])
        .map(t => (typeof t === 'string' && t.length > 0) ? (t.startsWith('#') ? t : `#${t}`) : null)
        .filter(Boolean);
    const hashtagsStr = tags.join(' ');
    const separator = hashtagsStr ? '\n\n' : '';

    let body = captionBody || '';
    const totalLen = body.length + separator.length + hashtagsStr.length;

    if (totalLen <= limit) {
        return hashtagsStr ? `${body}${separator}${hashtagsStr}` : body;
    }

    // 上限超過: 本文を切り詰める。ハッシュタグは可能な限り残す。
    const reservedForTags = separator.length + hashtagsStr.length;
    const maxBody = limit - reservedForTags - SAFETY_MARGIN - ELLIPSIS.length;

    if (maxBody <= 0) {
        // ハッシュタグだけで上限を超過する稀ケース → ハッシュタグも切る
        const truncated = (body + separator + hashtagsStr).substring(0, limit - SAFETY_MARGIN - ELLIPSIS.length);
        return truncated + ELLIPSIS;
    }

    body = body.substring(0, maxBody) + ELLIPSIS;
    return `${body}${separator}${hashtagsStr}`;
}
