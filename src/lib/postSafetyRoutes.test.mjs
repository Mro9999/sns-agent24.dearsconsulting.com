import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as safety from './postSafety.mjs';

// Run the real handlers against a deterministic in-memory query adapter.
// No real database, AI generation, scheduler or social account is contacted.
function memoryDb(initial, { beforeUpdate, updateError = false } = {}) {
    const rows = structuredClone(initial);
    const writes = [];
    const queries = [];
    return {
        rows, writes, queries,
        from(table) {
            assert.equal(table, 'scheduled_posts');
            const filters = [];
            let updates, limit = Infinity, sort;
            const equal = (actual, value) => typeof actual === 'object' && actual !== null ? JSON.stringify(actual) === value : actual === value;
            const q = {
                select() { return q; },
                eq(key, value) { filters.push(row => equal(row[key], value)); return q; },
                is(key, value) { assert.equal(value, null); filters.push(row => row[key] == null); return q; },
                gt(key, value) { filters.push(row => row[key] != null && Date.parse(row[key]) > Date.parse(value)); return q; },
                gte(key, value) { filters.push(row => row[key] != null && Date.parse(row[key]) >= Date.parse(value)); return q; },
                lte(key, value) { filters.push(row => row[key] != null && Date.parse(row[key]) <= Date.parse(value)); return q; },
                order(key) { sort = key; return q; },
                limit(value) { limit = value; return q; },
                update(value) { updates = value; return q; },
                maybeSingle() { return run(true); },
                then(resolve, reject) { return run(false).then(resolve, reject); }
            };
            async function run(single) {
                queries.push({ mutation: Boolean(updates) });
                if (updates && beforeUpdate) beforeUpdate(rows);
                if (updates && updateError) return { data: null, error: new Error('test update failed') };
                let found = rows.filter(row => filters.every(filter => filter(row)));
                if (sort) found.sort((a, b) => Date.parse(a[sort]) - Date.parse(b[sort]));
                found = found.slice(0, limit);
                if (updates) for (const row of found) { writes.push(row.id); Object.assign(row, updates); }
                return { data: structuredClone(single ? found[0] || null : found), error: null };
            }
            return q;
        }
    };
}

async function handler(route, rows, options = {}) {
    const db = memoryDb(rows, options);
    const verified = [];
    const next = class NextResponse extends Response { static json = Response.json; };
    const dependencies = {
        'next/server': { NextResponse: next },
        '@clerk/nextjs/server': { auth: async () => ({ userId: options.userId === undefined ? 'user_1' : options.userId }) },
        '@/lib/supabaseAdmin': { supabaseAdmin: db },
        '@/lib/postSafety.mjs': safety,
        '@/lib/server/cronAuth': { authorizeCronRequest: () => options.denyCron ? new Response('Unauthorized', { status: 401 }) : null },
        '@/lib/server/postImageSafety.mjs': { verifyPostImages: async post => {
            verified.push(post.id);
            return options.invalidImages ? { ok: false, error: '画像を読み込めません' } : { ok: true };
        } }
    };
    const source = await readFile(new URL(`../app/api/${route}/route.js`, import.meta.url), 'utf8');
    const context = vm.createContext({ Response, Date, URL, console, process: { env: { ADMIN_QUEUE_SECRET: 'test-secret' } } });
    const routeModule = new vm.SourceTextModule(source, { context });
    await routeModule.link(specifier => {
        const exports = dependencies[specifier];
        assert.ok(exports, `Unexpected dependency ${specifier}`);
        return new vm.SyntheticModule(Object.keys(exports), function () {
            for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
        }, { context });
    });
    await routeModule.evaluate();
    return { route: routeModule.namespace, db, verified };
}

const testNow = Date.now();
const future = () => new Date(testNow + 60 * 60 * 1000).toISOString();
const past = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();
const makePost = (overrides = {}) => ({
    id: 'post-1', user_id: 'user_1', platform: 'instagram', caption: '本日のご案内',
    scheduled_at: future(), status: 'pending_approval', carousel_slides: null,
    image_urls: ['https://test.supabase.co/storage/v1/object/public/generated-images/user_1/photo.jpg'], ...overrides
});
const request = (body) => new Request('https://example.test/api/batch-approve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reviewedPost: makePost(), ...body }) });
const queueRequest = (secret = 'test-secret') => new Request('https://example.test/api/admin/queue?platform=instagram', { headers: { authorization: `Bearer ${secret}` } });

test('承認APIは未ログイン・別ユーザーを拒否し、書き込まない', async () => {
    for (const [userId, code] of [[null, 401], ['other-user', 403]]) {
        const h = await handler('batch-approve', [makePost()], { userId });
        assert.equal((await h.route.POST(request({ action: 'approve', id: 'post-1' }))).status, code);
        assert.equal(h.db.writes.length, 0);
        assert.equal(h.verified.length, 0);
    }
});

test('一覧は将来の投稿と期限切れを分離し、古い記録を変更しない', async () => {
    const h = await handler('batch-approve', [makePost(), makePost({ id: 'old', scheduled_at: past() }), makePost({ id: 'unset', scheduled_at: null })]);
    const json = await (await h.route.GET()).json();
    assert.deepEqual(json.posts.map(p => p.id), ['post-1']);
    assert.deepEqual(json.expiredPosts.map(p => p.id).sort(), ['old', 'unset']);
    assert.equal(h.db.writes.length, 0);
});

test('過去日時・欠損枚数・破損画像・クライアント画像差し替えを承認しない', async () => {
    for (const [overrides, options, payload, code] of [
        [{ scheduled_at: past() }, {}, {}, 422],
        [{ image_urls: [] }, {}, {}, 422],
        [{ carousel_slides: [{}, {}, {}] }, {}, {}, 422],
        [{}, { invalidImages: true }, {}, 422],
        [{}, {}, { image_urls: ['https://evil.example/replacement.jpg'] }, 409],
        [{}, {}, { reviewedPost: null }, 409],
        [{}, {}, { reviewedPost: makePost({ caption: '前の投稿文' }) }, 409]
    ]) {
        const h = await handler('batch-approve', [makePost(overrides)], options);
        const response = await h.route.POST(request({ action: 'approve', id: 'post-1', ...payload }));
        assert.equal(response.status, code);
        assert.equal(h.db.writes.length, 0);
        assert.equal(h.db.rows[0].status, 'pending_approval');
    }
});

test('正常な保存画像を検証後にだけ承認し、二度目の操作を拒否', async () => {
    const h = await handler('batch-approve', [makePost()]);
    assert.equal((await h.route.POST(request({ action: 'approve', id: 'post-1' }))).status, 200);
    assert.equal(h.db.rows[0].status, 'queued');
    assert.deepEqual(h.verified, ['post-1']);
    assert.equal((await h.route.POST(request({ action: 'approve', id: 'post-1' }))).status, 400);
    assert.equal(h.db.writes.length, 1);
});

test('確認中に文章・画像・日時・状態が変わったら承認しない', async () => {
    for (const change of [{ caption: '変更後' }, { image_urls: ['https://changed.test/image.jpg'] }, { scheduled_at: past() }, { status: 'skipped' }, { carousel_slides: [{}, {}] }]) {
        const h = await handler('batch-approve', [makePost()], { beforeUpdate: rows => Object.assign(rows[0], change) });
        assert.equal((await h.route.POST(request({ action: 'approve', id: 'post-1' }))).status, 409);
        assert.equal(h.db.writes.length, 0);
    }
});

test('却下は未処理の本人投稿だけ。公開済み日時を捏造しない', async () => {
    const h = await handler('batch-approve', [makePost()]);
    assert.equal((await h.route.POST(request({ action: 'reject', id: 'post-1' }))).status, 200);
    assert.equal(h.db.rows[0].status, 'skipped');
    assert.equal(h.db.rows[0].published_at, undefined);
    const race = await handler('batch-approve', [makePost()], { beforeUpdate: rows => { rows[0].status = 'queued'; } });
    assert.equal((await race.route.POST(request({ action: 'reject', id: 'post-1' }))).status, 409);
});

test('配信取得は古いキューを残したまま除外する', async () => {
    const h = await handler('admin/queue', [makePost({ status: 'queued', scheduled_at: past() })]);
    assert.equal((await h.route.GET(queueRequest())).status, 404);
    assert.equal(h.db.writes.length, 0);
    assert.equal(h.db.rows[0].status, 'queued');
    assert.equal(h.verified.length, 0);
});

test('配信取得は認証と保存画像を検証して一度だけclaimする', async () => {
    const due = makePost({ status: 'queued', scheduled_at: new Date(Date.now() - 60000).toISOString() });
    const h = await handler('admin/queue', [due]);
    assert.equal((await h.route.GET(queueRequest('wrong'))).status, 401);
    assert.equal(h.db.queries.length, 0);
    assert.equal((await h.route.GET(queueRequest())).status, 200);
    assert.deepEqual(h.verified, ['post-1']);
    assert.equal(h.db.rows[0].status, 'publishing');
    assert.equal((await h.route.GET(queueRequest())).status, 404);
    const broken = await handler('admin/queue', [due], { invalidImages: true });
    assert.equal((await broken.route.GET(queueRequest())).status, 422);
    assert.equal(broken.db.writes.length, 0);
});

test('自動承認も期限切れ・画像不備を除外し、未完了を成功と数えない', async () => {
    const soon = new Date(Date.now() + 5 * 60000).toISOString();
    const rows = [makePost({ id: 'old', scheduled_at: past() }), makePost({ id: 'soon', scheduled_at: soon }), makePost({ id: 'broken', scheduled_at: soon, image_urls: [] })];
    const h = await handler('cron/auto-approve', rows);
    const result = await (await h.route.GET(new Request('https://example.test/cron'))).json();
    assert.equal(result.auto_approved, 1);
    assert.equal(result.success, false);
    assert.deepEqual(result.ids, ['soon']);
    assert.equal(h.db.rows.find(r => r.id === 'old').status, 'pending_approval');
    assert.equal(h.db.rows.find(r => r.id === 'broken').status, 'pending_approval');
    const deny = await handler('cron/auto-approve', rows, { denyCron: true });
    assert.equal((await deny.route.GET()).status, 401);
    assert.equal(deny.db.queries.length, 0);
});
