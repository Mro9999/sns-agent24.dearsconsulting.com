import { readFile } from 'node:fs/promises';
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
