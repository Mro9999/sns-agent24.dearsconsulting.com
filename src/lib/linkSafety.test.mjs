import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcRoot = path.join(projectRoot, 'src');
const canonicalAppUrl = 'https://sns-agent24.dearsconsulting.com/';
const retiredHosts = [
    'instagram-auto-sigma.vercel.app',
];

async function listSourceFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return listSourceFiles(fullPath);
        return /\.(?:js|mjs)$/.test(entry.name) && !entry.name.includes('.test.') ? [fullPath] : [];
    }));
    return nested.flat();
}

test('週次メールは本番の正規URLへ直接案内する', async () => {
    const weeklyIdeas = await readFile(path.join(srcRoot, 'app/api/cron/weekly-ideas/route.js'), 'utf8');
    const weeklyBatch = await readFile(path.join(srcRoot, 'lib/weeklyBatchGenerator.js'), 'utf8');

    assert.match(weeklyIdeas, new RegExp(canonicalAppUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(weeklyBatch, /https:\/\/sns-agent24\.dearsconsulting\.com/);
});

test('廃止済みホストと危険なhrefをソースへ戻さない', async () => {
    const files = await listSourceFiles(srcRoot);

    for (const file of files) {
        const source = await readFile(file, 'utf8');
        for (const host of retiredHosts) {
            assert.doesNotMatch(source, new RegExp(host.replaceAll('.', '\\.')), `${file} に廃止済みホストがあります`);
        }
        assert.doesNotMatch(source, /href\s*=\s*(?:["']#["']|["']javascript:)/i, `${file} に危険なhrefがあります`);
    }
});

test('新しいタブで開くリンクはopenerを切り離す', async () => {
    const files = await listSourceFiles(srcRoot);

    for (const file of files) {
        const source = await readFile(file, 'utf8');
        const tags = source.match(/<(?:a|Link)\b[^>]*target=["']_blank["'][^>]*>/g) || [];
        for (const tag of tags) {
            assert.match(tag, /rel=["'][^"']*noopener[^"']*noreferrer[^"']*["']/, `${file} の外部リンクに安全なrelがありません`);
        }
    }
});
