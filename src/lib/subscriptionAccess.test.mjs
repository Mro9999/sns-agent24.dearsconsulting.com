import test from 'node:test';
import assert from 'node:assert/strict';

import {
    resolveSubscriptionAccess,
    subscriptionPeriodEnd
} from './subscriptionAccess.mjs';

const priceIds = {
    pro: ['price_pro_month', 'price_pro_year'],
    promax: ['price_promax_month', 'price_promax_year']
};

const subscription = (status, priceId, extra = {}) => ({
    id: 'sub_example',
    status,
    current_period_end: 200,
    items: { data: [{ price: { id: priceId } }] },
    ...extra
});

test('有効なPro契約はPro権限になる', () => {
    assert.deepEqual(resolveSubscriptionAccess(subscription('active', 'price_pro_month'), priceIds), {
        accessEnabled: true,
        cancelAtPeriodEnd: false,
        periodEnd: 200,
        plan: 'pro',
        priceId: 'price_pro_month',
        recognized: true,
        role: 'pro',
        status: 'active'
    });
});

test('トライアル中のPro Max契約はPro Max権限になる', () => {
    assert.equal(resolveSubscriptionAccess(subscription('trialing', 'price_promax_year'), priceIds).role, 'promax');
});

test('支払い再試行中は即時停止せず権限を維持する', () => {
    assert.equal(resolveSubscriptionAccess(subscription('past_due', 'price_pro_year'), priceIds).accessEnabled, true);
});

test('解約予約を契約表示用に返す', () => {
    const result = resolveSubscriptionAccess(subscription('active', 'price_pro_year', {
        cancel_at_period_end: true
    }), priceIds);
    assert.equal(result.cancelAtPeriodEnd, true);
    assert.equal(result.plan, 'pro');
});

for (const status of ['incomplete', 'incomplete_expired', 'canceled', 'unpaid', 'paused']) {
    test(`${status}では有料権限を停止する`, () => {
        const result = resolveSubscriptionAccess(subscription(status, 'price_pro_month'), priceIds);
        assert.equal(result.recognized, true);
        assert.equal(result.accessEnabled, false);
        assert.equal(result.plan, 'pro');
        assert.equal(result.role, null);
    });
}

test('別商品の料金IDでは既存権限を変更しないため未認識として扱う', () => {
    const result = resolveSubscriptionAccess(subscription('active', 'price_other_product'), priceIds);
    assert.equal(result.recognized, false);
    assert.equal(result.role, null);
});

test('契約本体に期間終了がない場合は明細の期間終了を使う', () => {
    assert.equal(subscriptionPeriodEnd({
        items: { data: [{ current_period_end: 120 }, { current_period_end: 180 }] }
    }), 180);
});
