import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../app/app/AppClient.js', import.meta.url), 'utf8');
const selectorSource = await readFile(new URL('../components/features/Selectors.js', import.meta.url), 'utf8');
const pricingSource = await readFile(new URL('../components/layout/PricingSection.js', import.meta.url), 'utf8');
const proMaxInquirySource = await readFile(new URL('../components/ProMaxInquiryModal.js', import.meta.url), 'utf8');

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
