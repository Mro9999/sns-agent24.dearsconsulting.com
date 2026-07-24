import test from 'node:test';
import assert from 'node:assert/strict';

import {
    configurationSupportsPrices,
    ensureProMaxBillingPortal,
    inspectProMaxBillingPortal,
    productsForPortal
} from './promaxBillingPortal.mjs';

const env = {
    STRIPE_PRICE_ID_MONTHLY: 'price_pro_month',
    STRIPE_PRICE_ID_YEARLY: 'price_pro_year',
    STRIPE_PRICE_ID_PROMAX_MONTHLY: 'price_promax_month',
    STRIPE_PRICE_ID_PROMAX_YEARLY: 'price_promax_year'
};

const priceRecords = {
    price_pro_month: {
        id: 'price_pro_month',
        active: true,
        currency: 'jpy',
        livemode: true,
        product: 'prod_pro',
        recurring: { interval: 'month' },
        unit_amount: 2980
    },
    price_pro_year: {
        id: 'price_pro_year',
        active: true,
        currency: 'jpy',
        livemode: true,
        product: 'prod_pro',
        recurring: { interval: 'year' },
        unit_amount: 29800
    },
    price_promax_month: {
        id: 'price_promax_month',
        active: true,
        currency: 'jpy',
        livemode: true,
        product: 'prod_promax',
        recurring: { interval: 'month' },
        unit_amount: 29800
    },
    price_promax_year: {
        id: 'price_promax_year',
        active: true,
        currency: 'jpy',
        livemode: true,
        product: 'prod_promax',
        recurring: { interval: 'year' },
        unit_amount: 298000
    }
};

function withoutExpandableProducts(configuration) {
    const subscriptionUpdate = configuration?.features?.subscription_update;
    if (!subscriptionUpdate) return configuration;

    const { products: _products, ...subscriptionUpdateWithoutProducts } = subscriptionUpdate;
    return {
        ...configuration,
        features: {
            ...configuration.features,
            subscription_update: subscriptionUpdateWithoutProducts
        }
    };
}

function fakeStripe({ configurations = [], omitProductsOnMutation = false } = {}) {
    const records = [...configurations];
    const calls = {
        create: 0,
        listParams: null,
        retrieve: 0,
        retrieveParams: [],
        update: 0
    };

    return {
        calls,
        prices: {
            retrieve: async (priceId) => priceRecords[priceId]
        },
        billingPortal: {
            configurations: {
                list: async (params) => {
                    calls.listParams = params;
                    return { data: records };
                },
                retrieve: async (configurationId, params) => {
                    calls.retrieve += 1;
                    calls.retrieveParams.push(params);
                    return records.find(({ id }) => id === configurationId);
                },
                create: async (params) => {
                    calls.create += 1;
                    const created = { id: 'bpc_new', ...params };
                    records.push(created);
                    return omitProductsOnMutation
                        ? withoutExpandableProducts(created)
                        : created;
                },
                update: async (id, params) => {
                    calls.update += 1;
                    const updated = { id, ...params };
                    const index = records.findIndex((configuration) => configuration.id === id);
                    if (index >= 0) records[index] = updated;
                    else records.push(updated);
                    return omitProductsOnMutation
                        ? withoutExpandableProducts(updated)
                        : updated;
                }
            }
        }
    };
}

test('ProとPro Maxの料金を商品ごとにポータル設定へまとめる', () => {
    assert.deepEqual(productsForPortal(Object.values(priceRecords)), [
        {
            product: 'prod_pro',
            prices: ['price_pro_month', 'price_pro_year']
        },
        {
            product: 'prod_promax',
            prices: ['price_promax_month', 'price_promax_year']
        }
    ]);
});

test('料金金額・通貨・請求間隔が画面表示と一致することを確認する', async () => {
    const stripe = fakeStripe();
    const inspection = await inspectProMaxBillingPortal({
        env,
        stripe
    });
    assert.equal(inspection.mode, 'live');
    assert.equal(inspection.prices.length, 4);
    assert.equal(inspection.configurationReady, false);
    assert.deepEqual(stripe.calls.listParams.expand, [
        'data.features.subscription_update.products'
    ]);
});

test('Stripe料金が画面表示と違う場合は専用設定を作らない', async () => {
    const stripe = fakeStripe();
    stripe.prices.retrieve = async (priceId) => (
        priceId === 'price_promax_month'
            ? { ...priceRecords[priceId], unit_amount: 99999 }
            : priceRecords[priceId]
    );

    await assert.rejects(
        ensureProMaxBillingPortal({ env, stripe }),
        /Pro Max 月払いの金額が画面表示と一致しません/
    );
    assert.equal(stripe.calls.create, 0);
});

test('専用設定がなければ一度だけ作成する', async () => {
    const stripe = fakeStripe();
    const configuration = await ensureProMaxBillingPortal({ env, stripe });

    assert.equal(configuration.id, 'bpc_new');
    assert.equal(stripe.calls.create, 1);
    assert.equal(configurationSupportsPrices(configuration, Object.values(env)), true);
});

test('作成応答で商品一覧が省略されても展開取得して検証する', async () => {
    const stripe = fakeStripe({ omitProductsOnMutation: true });
    const configuration = await ensureProMaxBillingPortal({ env, stripe });

    assert.equal(configuration.id, 'bpc_new');
    assert.equal(stripe.calls.create, 1);
    assert.equal(stripe.calls.retrieve, 1);
    assert.deepEqual(stripe.calls.retrieveParams[0], {
        expand: ['features.subscription_update.products']
    });
    assert.equal(configurationSupportsPrices(configuration, Object.values(env)), true);
});

test('必要料金を含む既存設定は変更せず再利用する', async () => {
    const baseStripe = fakeStripe();
    const created = await ensureProMaxBillingPortal({ env, stripe: baseStripe });
    const stripe = fakeStripe({ configurations: [created] });

    const configuration = await ensureProMaxBillingPortal({ env, stripe });
    assert.equal(configuration.id, created.id);
    assert.equal(stripe.calls.create, 0);
    assert.equal(stripe.calls.update, 0);
});
