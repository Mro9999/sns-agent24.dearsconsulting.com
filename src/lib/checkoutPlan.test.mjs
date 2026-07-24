import test from 'node:test';
import assert from 'node:assert/strict';

import {
    canAdminUsePaidBilling,
    decideSubscriptionPurchase,
    resolveCheckoutSelection
} from './checkoutPlan.mjs';

const env = {
    STRIPE_PRICE_ID_MONTHLY: 'price_pro_month',
    STRIPE_PRICE_ID_YEARLY: 'price_pro_year',
    STRIPE_PRICE_ID_PROMAX_MONTHLY: 'price_promax_month',
    STRIPE_PRICE_ID_PROMAX_YEARLY: 'price_promax_year'
};

const access = (plan, status, priceId) => ({
    plan,
    priceId,
    recognized: true,
    status
});

test('ProとPro Maxの月払い・年払いをサーバー側の料金IDへ対応付ける', () => {
    assert.equal(resolveCheckoutSelection({ tier: 'pro', interval: 'month' }, env).priceId, 'price_pro_month');
    assert.equal(resolveCheckoutSelection({ tier: 'pro', interval: 'year' }, env).priceId, 'price_pro_year');
    assert.equal(resolveCheckoutSelection({ tier: 'promax', interval: 'month' }, env).priceId, 'price_promax_month');
    assert.equal(resolveCheckoutSelection({ tier: 'promax', interval: 'year' }, env).priceId, 'price_promax_year');
});

test('未対応プランと料金ID未設定は決済を開始しない', () => {
    assert.equal(resolveCheckoutSelection({ tier: 'enterprise', interval: 'month' }, env).valid, false);
    assert.equal(resolveCheckoutSelection({ tier: 'promax', interval: 'month' }, {}).valid, false);
});

test('有料契約がなければ新規Checkoutを作成する', () => {
    assert.equal(decideSubscriptionPurchase({
        access: null,
        targetPriceId: 'price_promax_month',
        targetTier: 'promax'
    }), 'checkout');
});

test('既存ProからPro Maxは契約変更画面へ進める', () => {
    assert.equal(decideSubscriptionPurchase({
        access: access('pro', 'active', 'price_pro_month'),
        targetPriceId: 'price_promax_month',
        targetTier: 'promax'
    }), 'upgrade');
});

test('同じプランや支払い確認が必要な契約は管理画面へ進める', () => {
    assert.equal(decideSubscriptionPurchase({
        access: access('promax', 'active', 'price_promax_month'),
        targetPriceId: 'price_promax_year',
        targetTier: 'promax'
    }), 'manage');
    assert.equal(decideSubscriptionPurchase({
        access: access('pro', 'past_due', 'price_pro_month'),
        targetPriceId: 'price_promax_month',
        targetTier: 'promax'
    }), 'manage');
    assert.equal(decideSubscriptionPurchase({
        access: access('pro', 'incomplete', 'price_pro_month'),
        targetPriceId: 'price_promax_month',
        targetTier: 'promax'
    }), 'manage');
});

test('解約済みまたは期限切れの契約は新しいCheckoutへ進める', () => {
    assert.equal(decideSubscriptionPurchase({
        access: access('pro', 'canceled', 'price_pro_month'),
        targetPriceId: 'price_promax_month',
        targetTier: 'promax'
    }), 'checkout');
    assert.equal(decideSubscriptionPurchase({
        access: access('pro', 'incomplete_expired', 'price_pro_month'),
        targetPriceId: 'price_promax_month',
        targetTier: 'promax'
    }), 'checkout');
});

test('複数明細の既存契約は自動変更せず管理画面へ進める', () => {
    assert.equal(decideSubscriptionPurchase({
        access: access('pro', 'active', 'price_pro_month'),
        itemCount: 2,
        targetPriceId: 'price_promax_month',
        targetTier: 'promax'
    }), 'manage');
});

test('運営者でも有効な有料契約があれば契約管理を利用できる', () => {
    assert.equal(canAdminUsePaidBilling(access('pro', 'active', 'price_pro_month')), true);
    assert.equal(canAdminUsePaidBilling(access('pro', 'past_due', 'price_pro_month')), true);
});

test('有料契約のない運営者や解約済み契約は決済を開始しない', () => {
    assert.equal(canAdminUsePaidBilling(null), false);
    assert.equal(canAdminUsePaidBilling(access('pro', 'canceled', 'price_pro_month')), false);
    assert.equal(canAdminUsePaidBilling({
        plan: 'pro',
        priceId: 'price_pro_month',
        recognized: false,
        status: 'active'
    }), false);
});
