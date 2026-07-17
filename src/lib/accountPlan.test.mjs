import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAccountPlan } from './accountPlan.mjs';

test('ログインユーザーのroleを表示用プランへ変換する', () => {
    assert.equal(resolveAccountPlan({ role: 'free' }).label, 'Freeプラン');
    assert.equal(resolveAccountPlan({ role: 'pro' }).label, 'Proプラン');
    assert.equal(resolveAccountPlan({ role: 'promax' }).label, 'Pro Maxプラン');
    assert.equal(resolveAccountPlan({ role: 'admin' }).label, '運営者アカウント');
});

test('roleが未同期でもサーバーの利用権限を表示へ反映する', () => {
    assert.equal(resolveAccountPlan({ isPro: true }).role, 'pro');
    assert.equal(resolveAccountPlan({ isPro: true, isProMax: true }).role, 'promax');
});

test('サーバー確認中はFreeと断定しない', () => {
    const plan = resolveAccountPlan({ isLoading: true });
    assert.equal(plan.role, 'loading');
    assert.equal(plan.label, 'プランを確認中');
});
