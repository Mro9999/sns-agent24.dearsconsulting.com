import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { approvalIssue, imageStructureIssue, isDuePost, isFuturePost, previewIssue, publishingWindow } from './postSafety.mjs';
import { isTrustedPostImage, verifyPostImages } from './server/postImageSafety.mjs';
import { pricingPlanFromAccount, pricingRelation } from './pricingState.mjs';

const now = Date.parse('2026-09-07T03:00:00Z');
const storageUrl = 'https://test.supabase.co';
const url = `${storageUrl}/storage/v1/object/public/generated-images/user_1/photo.jpg`;
const post = { user_id: 'user_1', caption: '本日のご案内', scheduled_at: '2026-09-07T04:00:00Z', image_urls: [url] };

test('未来日時のみ承認でき、過去・不正・未設定の日程は対象外', () => {
    assert.equal(approvalIssue(post, now), null);
    for (const scheduled_at of [null, '', 'invalid', '2026-06-07T03:00:00Z', new Date(now).toISOString()]) {
        assert.equal(isFuturePost({ scheduled_at }, now), false);
        assert.match(approvalIssue({ ...post, scheduled_at }, now), /予定日時/);
    }
    assert.match(approvalIssue({ ...post, caption: '' }, now), /投稿文/);
});

test('配信は予定から30分以内だけ。境界・未来・旧投稿を区別する', () => {
    assert.deepEqual(publishingWindow(now), { earliest: '2026-09-07T02:30:00.000Z', latest: '2026-09-07T03:00:00.000Z' });
    for (const delta of [0, -1, -30 * 60 * 1000]) assert.equal(isDuePost({ scheduled_at: new Date(now + delta).toISOString() }, now), true);
    for (const delta of [1, -30 * 60 * 1000 - 1, -90 * 24 * 60 * 60 * 1000]) assert.equal(isDuePost({ scheduled_at: new Date(now + delta).toISOString() }, now), false);
    assert.equal(isDuePost({ scheduled_at: null }, now), false);
});

test('0枚・カルーセル不足・重複・不正URLを承認しない', () => {
    assert.match(imageStructureIssue({ image_urls: [] }), /揃っていません/);
    assert.match(imageStructureIssue({ ...post, carousel_slides: [{}, {}, {}] }), /3枚/);
    assert.match(imageStructureIssue({ image_urls: [url, url] }), /不備/);
    assert.match(imageStructureIssue({ image_urls: ['data:image/png;base64,a'] }), /不備/);
});

test('全画像がブラウザに表示されるまで承認不可、読み込み失敗を区別', () => {
    assert.match(previewIssue(post, {}, now), /確認中/);
    assert.match(previewIssue(post, { [url]: 'error' }, now), /読み込めません/);
    assert.equal(previewIssue(post, { [url]: 'loaded' }, now), null);
});

test('自分の保存画像のみ取得し、外部・他ユーザー・リダイレクト入口を許可しない', async () => {
    assert.equal(isTrustedPostImage(url, storageUrl, 'user_1'), true);
    for (const raw of [
        'http://127.0.0.1/private', url.replace('test.supabase.co', 'evil.example'),
        url.replace('/user_1/', '/user_2/'), `${url}?url=http://127.0.0.1`,
        `${storageUrl}/storage/v1/object/public/generated-images/user_1/%2e%2e/secret`,
        url.replace('https://', 'https://user:pass@')
    ]) assert.equal(isTrustedPostImage(raw, storageUrl, 'user_1'), false, raw);
    let calls = 0;
    const result = await verifyPostImages({ ...post, image_urls: ['https://evil.example/image.jpg'] }, { storageUrl, fetcher: () => { calls++; } });
    assert.equal(result.ok, false);
    assert.equal(calls, 0);
});

test('保存画像の実バイトをデコードして検証する', async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const result = await verifyPostImages(post, { storageUrl, fetcher: async (input, options) => {
        assert.equal(input, url);
        assert.equal(options.redirect, 'error');
        assert.equal(options.cache, 'no-store');
        return new Response(png, { headers: { 'content-type': 'image/png' } });
    } });
    assert.equal(result.ok, true);
    for (const response of [
        () => new Response('missing', { status: 404 }),
        () => new Response('not an image', { headers: { 'content-type': 'image/jpeg' } }),
        () => new Response('<html/>', { headers: { 'content-type': 'text/html' } }),
        () => new Response(png, { headers: { 'content-type': 'image/png', 'content-length': String(11 * 1024 * 1024) } }),
        () => { throw new Error('network error'); }
    ]) assert.equal((await verifyPostImages(post, { storageUrl, fetcher: async () => response() })).ok, false);
});

test('1枚だけ壊れたカルーセルも全体を承認しない', async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#ffffff' } }).png().toBuffer();
    let calls = 0;
    const result = await verifyPostImages({ ...post, carousel_slides: [{}, {}, {}], image_urls: [url, url.replace('photo', 'two'), url.replace('photo', 'three')] }, {
        storageUrl, fetcher: async () => ++calls === 2 ? new Response('missing', { status: 404 }) : new Response(png, { headers: { 'content-type': 'image/png' } })
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /2枚目/);
    assert.equal(calls, 2);
});

test('未ログイン・読込中・照合失敗をFree契約と表示しない', () => {
    assert.equal(pricingPlanFromAccount({ isLoaded: false }), 'loading');
    assert.equal(pricingPlanFromAccount({ isLoaded: true, isSignedIn: false }), null);
    assert.equal(pricingRelation(null, 'free'), 'guest');
    assert.equal(pricingRelation('loading', 'free'), 'unknown');
    assert.equal(pricingRelation('unknown', 'free'), 'unknown');
    const account = { isLoaded: true, isSignedIn: true, isPlanStatusLoading: false, subscriptionVerified: true, accountPlan: { plan: 'pro' } };
    assert.equal(pricingPlanFromAccount(account), 'pro');
    assert.equal(pricingRelation('pro', 'pro'), 'current');
    assert.equal(pricingRelation('pro', 'free'), 'lower');
    assert.equal(pricingPlanFromAccount({ ...account, subscriptionVerified: false }), 'unknown');
});
