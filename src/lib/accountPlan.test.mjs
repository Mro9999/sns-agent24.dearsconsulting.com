import test from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveAccessLevel,
    resolveAccountPlan,
    resolveSubscriptionStatus
} from './accountPlan.mjs';

test('Stripeで確認した契約プランを表示へ変換する', () => {
    assert.equal(resolveAccountPlan({ subscriptionPlan: 'free', subscriptionStatus: 'none' }).label, 'Freeプラン');
    assert.equal(resolveAccountPlan({ subscriptionPlan: 'pro', subscriptionStatus: 'active' }).label, 'Proプラン');
    assert.equal(resolveAccountPlan({ subscriptionPlan: 'promax', subscriptionStatus: 'active' }).label, 'Pro Maxプラン');
});

test('運営者権限を契約プランと分離する', () => {
    const plan = resolveAccountPlan({ subscriptionPlan: 'free', subscriptionStatus: 'none' });
    const access = resolveAccessLevel({ accessRole: 'admin' });

    assert.equal(plan.label, 'Freeプラン');
    assert.equal(access.label, '運営者');
    assert.match(access.description, /すべての機能/);
});

test('通常ユーザーの利用権限を明示する', () => {
    assert.equal(resolveAccessLevel({ accessRole: 'pro' }).label, '通常ユーザー');
});

test('サーバー確認中はFreeと断定しない', () => {
    const plan = resolveAccountPlan({ isLoading: true });
    assert.equal(plan.plan, 'loading');
    assert.equal(plan.label, 'プランを確認中');
});

test('契約照合エラー時はFreeと断定しない', () => {
    const plan = resolveAccountPlan({ subscriptionStatus: 'unknown' });
    assert.equal(plan.plan, 'unknown');
    assert.equal(plan.label, '契約プランを確認できません');
});

test('解約予約と支払い確認状態を分かりやすく表示する', () => {
    assert.equal(resolveSubscriptionStatus({
        subscriptionStatus: 'active',
        cancelAtPeriodEnd: true
    }).label, '解約予定');
    assert.equal(resolveSubscriptionStatus({ subscriptionStatus: 'past_due' }).tone, 'warning');
});
