import sharp from 'sharp';
import { imageStructureIssue } from '../postSafety.mjs';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 20 * 1024 * 1024;

// Only our public, immutable generated objects are fetched. Never follow an
// arbitrary client URL or a redirect (SSRF, private object and tracking risks).
export function isTrustedPostImage(raw, storageUrl, userId) {
    try {
        const url = new URL(raw);
        const origin = new URL(storageUrl);
        const path = decodeURIComponent(url.pathname);
        const prefix = '/storage/v1/object/public/generated-images/';
        return url.protocol === 'https:' && url.origin === origin.origin
            && !url.username && !url.password && !url.search && !url.hash
            && path.startsWith(prefix) && !path.includes('..')
            && typeof userId === 'string' && userId.length > 0 && path.startsWith(`${prefix}${userId}/`);
    } catch { return false; }
}

export async function verifyPostImages(post, {
    fetcher = fetch,
    storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    timeoutMs = 20000
} = {}) {
    const issue = imageStructureIssue(post);
    if (issue) return { ok: false, error: issue };
    if (!post.image_urls.every(url => isTrustedPostImage(url, storageUrl, post.user_id))) {
        return { ok: false, error: 'この投稿の保存画像を確認できません。画像だけ再生成してください。' };
    }
    const signal = AbortSignal.timeout(timeoutMs);
    for (let index = 0; index < post.image_urls.length; index++) {
        let reader;
        try {
            const response = await fetcher(post.image_urls[index], { redirect: 'error', cache: 'no-store', signal });
            const type = (response.headers.get('content-type') || '').split(';')[0];
            if (!response.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(type)
                || Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) {
                await response.body?.cancel();
                throw new Error('unavailable image');
            }
            reader = response.body.getReader();
            const chunks = [];
            let bytes = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                bytes += value.byteLength;
                if (bytes > MAX_BYTES) throw new Error('image too large');
                chunks.push(value);
            }
            const buffer = Buffer.concat(chunks);
            // metadata alone does not prove that pixel data can be decoded.
            const decoder = sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: 'warning' });
            const meta = await decoder.metadata();
            if (!meta.width || !meta.height || !['jpeg', 'png', 'webp'].includes(meta.format) || (meta.pages || 1) > 1) {
                throw new Error('unsupported image');
            }
            await decoder.resize(1, 1).raw().toBuffer();
        } catch {
            await reader?.cancel().catch(() => {});
            return { ok: false, error: `${index + 1}枚目の画像を読み込めません。投稿は承認せずに残しました。画像だけ再生成してから再度ご確認ください。` };
        }
    }
    return { ok: true };
}
