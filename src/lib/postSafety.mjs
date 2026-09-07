// A missed publishing window is not permission to publish old content later.
// Keep expired records unchanged; rescheduling requires a separate review.
export const PUBLISH_WINDOW_MS = 30 * 60 * 1000;

export function publishingWindow(now = Date.now()) {
    return { earliest: new Date(now - PUBLISH_WINDOW_MS).toISOString(), latest: new Date(now).toISOString() };
}

export function isFuturePost(post, now = Date.now()) {
    return typeof post?.scheduled_at === 'string' && Date.parse(post.scheduled_at) > now;
}

export function isDuePost(post, now = Date.now()) {
    const scheduled = Date.parse(post?.scheduled_at);
    return Number.isFinite(scheduled) && scheduled <= now && scheduled >= now - PUBLISH_WINDOW_MS;
}

export function imageStructureIssue(post) {
    const urls = post?.image_urls;
    const expected = Array.isArray(post?.carousel_slides) && post.carousel_slides.length > 0
        ? post.carousel_slides.length : 1;
    if (!Array.isArray(urls) || urls.length < expected || urls.length > 10) {
        return `画像が揃っていません（必要枚数：${expected}枚）。画像だけ再生成してください。`;
    }
    if (urls.some(url => typeof url !== 'string' || !/^https:\/\//.test(url)) || new Set(urls).size !== urls.length) {
        return '画像の保存情報に不備があります。画像だけ再生成してください。';
    }
    return null;
}

export function approvalIssue(post, now = Date.now()) {
    if (!isFuturePost(post, now)) return '予定日時が過ぎているか未設定のため、承認できません。日程の再確認が必要です。';
    if (typeof post?.caption !== 'string' || !post.caption.trim()) return '投稿文がないため、承認できません。';
    return imageStructureIssue(post);
}

export function previewIssue(post, loadedImages = {}, now = Date.now()) {
    const issue = approvalIssue(post, now);
    if (issue) return issue;
    const states = post.image_urls.map(url => loadedImages[url]);
    if (states.includes('error')) return '画像を読み込めません。承認せず、画像だけ再生成してください。';
    if (states.some(state => state !== 'loaded')) return '画像の表示を確認中です。すべて表示されるまで承認できません。';
    return null;
}

export function reviewedPostMatches(post, reviewed) {
    if (!reviewed || typeof reviewed !== 'object') return false;
    return ['platform', 'caption', 'scheduled_at', 'image_urls', 'carousel_slides'].every(key =>
        JSON.stringify(post[key] ?? null) === JSON.stringify(reviewed[key] ?? null));
}

// Compare the exact content that was verified, not just the record id.
export function matchPostSnapshot(query, post) {
    for (const key of ['user_id', 'platform', 'scheduled_at', 'caption', 'image_urls', 'carousel_slides']) {
        const value = post[key];
        query = value == null ? query.is(key, null)
            : query.eq(key, typeof value === 'object' ? JSON.stringify(value) : value);
    }
    return query.eq('id', post.id).eq('status', post.status);
}
