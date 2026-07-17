import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../app/app/AppClient.js', import.meta.url), 'utf8');
const selectorSource = await readFile(new URL('../components/features/Selectors.js', import.meta.url), 'utf8');

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

test('対応プラットフォームは押せない表示カードとして案内する', () => {
    assert.match(appSource, /対応プラットフォーム: Instagram/);
    assert.match(appSource, /投稿作成は下の「作成方法を選ぶ」から進めます/);
    assert.doesNotMatch(appSource, /onClick=\{\(\) => setSelectedPlatform\('instagram'\)\}/);
});
