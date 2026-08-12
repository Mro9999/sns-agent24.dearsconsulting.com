import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    getPersistableProductContext,
    getScaledImageDimensions,
    isTemporaryImageUrl
} from './clientImageState.mjs';
import { formatVideoScriptForClipboard } from './videoScriptClipboard.mjs';

const appSource = await readFile(new URL('../app/app/AppClient.js', import.meta.url), 'utf8');
const selectorSource = await readFile(new URL('../components/features/Selectors.js', import.meta.url), 'utf8');
const pricingSource = await readFile(new URL('../components/layout/PricingSection.js', import.meta.url), 'utf8');
const proMaxInquirySource = await readFile(new URL('../components/ProMaxInquiryModal.js', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../app/dashboard/DashboardClient.js', import.meta.url), 'utf8');
const dashboardLoadingSource = await readFile(new URL('../app/dashboard/loading.js', import.meta.url), 'utf8');
const appLoadingSource = await readFile(new URL('../app/app/loading.js', import.meta.url), 'utf8');
const appPageSource = await readFile(new URL('../app/app/page.js', import.meta.url), 'utf8');
const generationsRouteSource = await readFile(new URL('../app/api/generations/route.js', import.meta.url), 'utf8');
const canvasSource = await readFile(new URL('./canvasHelper.js', import.meta.url), 'utf8');
const serverOverlaySource = await readFile(new URL('./serverOverlayHelper.js', import.meta.url), 'utf8');
const imageGenerationSource = await readFile(new URL('./apiService.js', import.meta.url), 'utf8');

test('投稿入力の各状態にh1があり、選択項目はh2から始まる', () => {
    assert.match(appSource, /POST SETUP[\s\S]*?<h1[\s\S]*?投稿の条件を入力/);
    assert.match(appSource, /step === 2[\s\S]*?<h1[\s\S]*?生成が完了しました/);
    assert.doesNotMatch(selectorSource, /<h3/);
});

test('スマホの性別選択肢は折り返して横書きを維持する', () => {
    const genderSection = selectorSource.match(/export function GenderSelector[\s\S]*?export function BusinessStyleSelector/)?.[0] || '';

    assert.match(genderSection, /flex flex-wrap justify-center/);
    assert.match(genderSection, /whitespace-nowrap/);
});

test('選択中の投稿目的は暗い背景でも補足文を読める', () => {
    assert.match(selectorSource, /isSelected \? 'text-slate-200' : 'text-slate-700'/);
});

test('料金比較もmainランドマークの内側に含まれる', () => {
    const mainStart = appSource.indexOf('<main');
    const pricing = appSource.indexOf('<PricingSection');
    const mainEnd = appSource.indexOf('</main>', mainStart);

    assert.ok(mainStart >= 0 && pricing > mainStart && mainEnd > pricing);
});

test('Instagramカードから投稿作成方法へ移動できる', () => {
    assert.match(appSource, /href="#create-methods"/);
    assert.match(appSource, /aria-label="Instagramの投稿作成方法へ移動"/);
    assert.match(appSource, /作成方法を見る/);
    assert.match(appSource, /id="create-methods"/);
    assert.match(appSource, /カードを押すと、下の「作成方法を選ぶ」へ移動します/);
    assert.doesNotMatch(appSource, /onClick=\{\(\) => setSelectedPlatform\('instagram'\)\}/);
});

test('Pro Maxの時刻表示は変更可能な設定例だと明示する', () => {
    assert.match(pricingSource, /曜日・時刻はご希望に合わせて設定できます。以下は設定例です。/);
    assert.match(pricingSource, /設定例：週に1回の準備/);
    assert.match(pricingSource, /設定例[\s\S]*毎週日曜 20:00/);
    assert.match(pricingSource, /STEP 4[\s\S]*設定例[\s\S]*毎日12:00/);
});

test('Pro Maxは自動決済を主導線にし、個別相談も任意で残す', () => {
    assert.match(pricingSource, /onUpgrade\(billingCycle, 'promax'\)/);
    assert.match(pricingSource, /Pro Maxを始める/);
    assert.match(pricingSource, /Pro Maxへアップグレード/);
    assert.match(pricingSource, /Pro Max Plan はオンラインでお申し込みできます。/);
    assert.match(pricingSource, /月払い・年払いとも自動更新です。/);
    assert.match(pricingSource, /相談してから決める/);
    assert.doesNotMatch(pricingSource, /Pro Max Plan は個別相談制です。/);
    assert.match(proMaxInquirySource, /オンラインでお申し込みいただけます。/);
    assert.match(proMaxInquirySource, /任意の相談窓口です。/);
    assert.doesNotMatch(proMaxInquirySource, /個別相談からご契約まで/);
});

test('複数写真はiPadのメモリを圧迫しない方式で1枚ずつ処理する', () => {
    const productInputSection = selectorSource.match(/export function ProductInput[\s\S]*?export function FormatSelector/)?.[0] || selectorSource.slice(selectorSource.indexOf('export function ProductInput'));

    assert.match(productInputSection, /for \(const file of validFiles\)/);
    assert.match(productInputSection, /canvas\.toBlob/);
    assert.match(productInputSection, /URL\.createObjectURL/);
    assert.doesNotMatch(productInputSection, /Promise\.all\(validFiles\.map/);
});

test('画像を含む入力状態はlocalStorageへ保存しない', () => {
    const persistable = getPersistableProductContext({
        companyName: 'DEARS',
        baseImages: ['data:image/jpeg;base64,large'],
        baseImage: 'data:image/jpeg;base64,legacy',
        logoUrl: 'data:image/png;base64,logo'
    });

    assert.deepEqual(persistable, { companyName: 'DEARS' });
    assert.match(appSource, /getPersistableProductContext\(productContext\)/);
    assert.match(appSource, /try \{[\s\S]*?localStorage\.setItem\('snsAgent24_formState_v2'/);
});

test('縦長・横長画像とも長辺1200px以内に縮小する', () => {
    assert.deepEqual(getScaledImageDimensions(4032, 3024), { width: 1200, height: 900 });
    assert.deepEqual(getScaledImageDimensions(3024, 4032), { width: 900, height: 1200 });
    assert.deepEqual(getScaledImageDimensions(800, 600), { width: 800, height: 600 });
    assert.equal(isTemporaryImageUrl('blob:https://example.com/id'), true);
});

test('履歴画面への往復は全ページ再読み込みと同じ履歴への逆戻りを避ける', () => {
    assert.match(appSource, /import Link from 'next\/link'/);
    assert.match(appSource, /<Link\s+href="\/dashboard"/);
    assert.doesNotMatch(appSource, /<a\s+href="\/dashboard"/);
    assert.match(dashboardSource, /<Link href="\/app" replace/);
});

test('履歴は8件ずつ取得し、一覧へは代表画像1枚だけを返す', () => {
    assert.match(generationsRouteSource, /DEFAULT_HISTORY_PAGE_SIZE = 8/);
    assert.match(generationsRouteSource, /\.range\(offset, offset \+ limit - 1\)/);
    assert.match(generationsRouteSource, /image_urls: imageUrls\.slice\(0, 1\)/);
    assert.match(generationsRouteSource, /hasMore:/);
    assert.match(dashboardSource, /さらに8件表示/);
});

test('投稿画面と履歴画面は遷移中も白紙にしない', () => {
    assert.match(dashboardLoadingSource, /生成履歴を準備しています/);
    assert.match(dashboardLoadingSource, /role="status"/);
    assert.match(appLoadingSource, /投稿作成画面を準備しています/);
    assert.match(appLoadingSource, /role="status"/);
    assert.match(dashboardSource, /ログイン情報を確認しています/);
});

test('投稿生成Server Actionは品質修復が60秒を超えても処理を継続できる', () => {
    assert.match(appPageSource, /export const maxDuration = 300/);
    assert.match(appSource, /unexpected response was received from the server/);
    assert.match(appSource, /生成処理が時間内に完了しませんでした/);
    assert.match(appSource, /通常1〜2分ほどかかります/);
});

test('公開切替で古いServer Actionになった場合は最新版の再読み込みを案内する', () => {
    assert.match(appSource, /failed to find server action/);
    assert.match(appSource, /サービスが更新されました/);
    assert.match(appSource, /requiresRefresh: true/);
    assert.match(appSource, /最新版を読み込む/);
    assert.match(appSource, /window\.location\.reload\(\)/);
});

test('投稿画像は空き枠のない全面写真とスマホで読める大きな文字を使う', () => {
    assert.match(imageGenerationSource, /ONE continuous, edge-to-edge, full-bleed photographic scene/);
    assert.match(imageGenerationSource, /No white\/gray borders, gutters, blank quadrants/);
    assert.match(canvasSource, /else if \(text\.length > 18\) fontSize = 88/);
    assert.match(canvasSource, /const MIN_FONT_SIZE = 68/);
    assert.match(serverOverlaySource, /const FIXED_FONT_SIZE = 88/);
    assert.match(appSource, /text-base px-3 py-2/);
    assert.match(appSource, /画像内の文字と写真の内容を確認してから保存してください/);
});

test('ショート動画台本は音声・映像・テロップをまとめてコピーできる', () => {
    const copyText = formatVideoScriptForClipboard([
        {
            time: '0-3秒',
            audio: '最初の一言',
            visual: '商品を映す',
            text_overlay: '悩みを解決'
        },
        {
            time: '3-8秒',
            audio: '詳しい説明',
            visual: '使い方を見せる',
            text_overlay: '3つのポイント'
        }
    ]);

    assert.equal(
        copyText,
        [
            'ショート動画台本（TikTok / Reels / Shorts）',
            '【シーン1｜0-3秒】\n音声：最初の一言\n映像：商品を映す\n画面テロップ：悩みを解決',
            '【シーン2｜3-8秒】\n音声：詳しい説明\n映像：使い方を見せる\n画面テロップ：3つのポイント'
        ].join('\n\n')
    );
    assert.match(appSource, /video_script_copied/);
    assert.match(appSource, /台本をすべてコピー/);
    assert.match(appSource, /type="button"[\s\S]*?台本をすべてコピー/);
});
