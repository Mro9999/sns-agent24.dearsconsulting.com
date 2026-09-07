import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';

const tracePath = path.join(
    process.cwd(),
    '.next/server/app/api/generate-post-image/route.js.nft.json'
);

let trace;
try {
    trace = JSON.parse(await readFile(tracePath, 'utf8'));
} catch (error) {
    throw new Error(`画像生成Routeのトレースを読めません。先に npm run build を実行してください: ${error.message}`);
}

const normalizedFiles = (trace.files || []).map((file) => file.replaceAll('\\', '/'));
const requiredSuffixes = [
    'node_modules/next/dist/compiled/@vercel/og/index.node.js',
    'node_modules/next/dist/compiled/@vercel/og/resvg.wasm',
    'node_modules/next/dist/compiled/@vercel/og/yoga.wasm',
    'public/fonts/NotoSerifJP-Japanese-Bold.woff',
    'public/fonts/NotoSerifJP-Latin-Bold.woff'
];

const missing = requiredSuffixes.filter(
    (suffix) => !normalizedFiles.some((file) => file.endsWith(suffix))
);

if (missing.length > 0) {
    throw new Error(`Vercel Functionに必要な画像合成ファイルが不足しています: ${missing.join(', ')}`);
}

console.log(`画像生成Routeの実行ファイルを確認しました (${requiredSuffixes.length}件)`);

// Build success alone does not prove that a native module will start inside a
// Vercel Function. Check the actual trace, including libvips shared libraries.
const platform = process.platform === 'linux' && !process.report.getReport().header.glibcVersionRuntime
    ? `linuxmusl-${process.arch}` : `${process.platform}-${process.arch}`;
const bindingDir = `node_modules/@img/sharp-${platform}/lib`;
const vipsDir = `node_modules/@img/sharp-libvips-${platform}/lib`;
const bindings = (await readdir(bindingDir)).filter(file => file.endsWith('.node'));
const libraries = (await readdir(vipsDir)).filter(file => /\.(?:so(?:\.\d+)*|dylib|dll)$/.test(file));
if (!bindings.length || !libraries.length) {
    throw new Error(`sharp/libvips の実行ファイルが見つかりません (${platform})`);
}
const nativeSuffixes = [
    ...bindings.map(file => `${bindingDir}/${file}`),
    ...libraries.map(file => `${vipsDir}/${file}`),
];
for (const route of ['batch-approve', 'admin/queue', 'cron/auto-approve', 'generate-post-image']) {
    const file = path.join(process.cwd(), `.next/server/app/api/${route}/route.js.nft.json`);
    const routeTrace = JSON.parse(await readFile(file, 'utf8'));
    const traced = (routeTrace.files || []).map(entry => entry.replaceAll('\\', '/'));
    for (const suffix of nativeSuffixes) {
        const entry = traced.find(item => item.endsWith(suffix));
        if (!entry) throw new Error(`/api/${route} に必要なファイルが同梱されていません: ${suffix}`);
        await access(path.resolve(path.dirname(file), entry));
    }
    console.log(`/api/${route}: sharp と libvips の同梱を確認 (${platform})`);
}
