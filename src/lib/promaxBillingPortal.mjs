export const PROMAX_PORTAL_CONFIG_MARKER = {
    app: 'sns-agent24',
    purpose: 'promax-upgrade'
};

export const PROMAX_PRICE_SPECS = [
    { envKey: 'STRIPE_PRICE_ID_MONTHLY', interval: 'month', label: 'Pro 月払い', unitAmount: 2980 },
    { envKey: 'STRIPE_PRICE_ID_YEARLY', interval: 'year', label: 'Pro 年払い', unitAmount: 29800 },
    { envKey: 'STRIPE_PRICE_ID_PROMAX_MONTHLY', interval: 'month', label: 'Pro Max 月払い', unitAmount: 29800 },
    { envKey: 'STRIPE_PRICE_ID_PROMAX_YEARLY', interval: 'year', label: 'Pro Max 年払い', unitAmount: 298000 }
];

const PORTAL_PRODUCTS_EXPANSION = 'features.subscription_update.products';

function requiredEnv(env, name) {
    const value = env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
}

export function productsForPortal(prices) {
    const products = new Map();

    prices.forEach((price) => {
        const productId = typeof price.product === 'string' ? price.product : price.product?.id;
        if (!productId) throw new Error(`Product is missing for Stripe price ${price.id}`);

        const priceIds = products.get(productId) || [];
        priceIds.push(price.id);
        products.set(productId, priceIds);
    });

    return [...products.entries()].map(([product, priceIds]) => ({
        product,
        prices: [...new Set(priceIds)]
    }));
}

export function proMaxPortalFeatures(products) {
    return {
        customer_update: {
            enabled: true,
            allowed_updates: ['address', 'email', 'name', 'phone', 'tax_id']
        },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: {
            enabled: true,
            mode: 'at_period_end',
            cancellation_reason: {
                enabled: true,
                options: [
                    'customer_service',
                    'low_quality',
                    'missing_features',
                    'other',
                    'switched_service',
                    'too_complex',
                    'too_expensive',
                    'unused'
                ]
            }
        },
        subscription_update: {
            enabled: true,
            default_allowed_updates: ['price'],
            products,
            proration_behavior: 'always_invoice'
        }
    };
}

export function configurationSupportsPrices(configuration, priceIds) {
    const subscriptionUpdate = configuration?.features?.subscription_update;
    const configuredPriceIds = new Set(
        subscriptionUpdate?.products?.flatMap((product) => product.prices || []) || []
    );

    return Boolean(
        subscriptionUpdate?.enabled
        && subscriptionUpdate?.proration_behavior === 'always_invoice'
        && priceIds.every((priceId) => configuredPriceIds.has(priceId))
    );
}

export async function inspectProMaxBillingPortal({ env = {}, stripe }) {
    const prices = await Promise.all(
        PROMAX_PRICE_SPECS.map(async (spec) => {
            const price = await stripe.prices.retrieve(requiredEnv(env, spec.envKey));
            const actualInterval = price.recurring?.interval || null;

            if (!price.active) throw new Error(`${spec.label}のStripe料金が無効です`);
            if (price.currency !== 'jpy') throw new Error(`${spec.label}の通貨がJPYではありません`);
            if (price.unit_amount !== spec.unitAmount) {
                throw new Error(`${spec.label}の金額が画面表示と一致しません`);
            }
            if (actualInterval !== spec.interval) {
                throw new Error(`${spec.label}の請求間隔が画面表示と一致しません`);
            }

            return { price, spec };
        })
    );

    const liveModes = new Set(prices.map(({ price }) => price.livemode));
    if (liveModes.size !== 1) throw new Error('Stripe料金のlive/testモードが混在しています');

    let configuration = null;
    const configuredId = env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID;

    if (configuredId) {
        configuration = await stripe.billingPortal.configurations.retrieve(configuredId, {
            expand: [PORTAL_PRODUCTS_EXPANSION]
        });
    } else {
        const configurations = await stripe.billingPortal.configurations.list({
            active: true,
            expand: [`data.${PORTAL_PRODUCTS_EXPANSION}`],
            limit: 100
        });
        configuration = configurations.data.find((candidate) => (
            candidate.metadata?.app === PROMAX_PORTAL_CONFIG_MARKER.app
            && candidate.metadata?.purpose === PROMAX_PORTAL_CONFIG_MARKER.purpose
        )) || null;
    }

    const priceIds = prices.map(({ price }) => price.id);

    return {
        configuration,
        configurationReady: configurationSupportsPrices(configuration, priceIds),
        mode: prices[0].price.livemode ? 'live' : 'test',
        priceIds,
        prices,
        products: productsForPortal(prices.map(({ price }) => price))
    };
}

export async function ensureProMaxBillingPortal({
    appUrl = 'https://sns-agent24.dearsconsulting.com',
    env = {},
    stripe
}) {
    const inspection = await inspectProMaxBillingPortal({ env, stripe });
    if (inspection.configurationReady) return inspection.configuration;

    const params = {
        business_profile: {
            headline: 'SNS Agent24のご契約内容を安全に確認・変更できます。'
        },
        default_return_url: `${appUrl}/app`,
        features: proMaxPortalFeatures(inspection.products),
        metadata: PROMAX_PORTAL_CONFIG_MARKER
    };

    let configuration;
    if (inspection.configuration) {
        const metadata = inspection.configuration.metadata || {};
        const isDedicatedConfiguration = (
            metadata.app === PROMAX_PORTAL_CONFIG_MARKER.app
            && metadata.purpose === PROMAX_PORTAL_CONFIG_MARKER.purpose
        );
        if (!isDedicatedConfiguration) {
            throw new Error('Configured billing portal is not dedicated to SNS Agent24');
        }
        configuration = await stripe.billingPortal.configurations.update(
            inspection.configuration.id,
            params
        );
    } else {
        configuration = await stripe.billingPortal.configurations.create(params);
    }

    // Stripe treats subscription_update.products as expandable and omits it from
    // create/update responses unless explicitly requested. Retrieve the saved
    // configuration with that field expanded before deciding it is incomplete.
    const expandedConfiguration = await stripe.billingPortal.configurations.retrieve(
        configuration.id,
        { expand: [PORTAL_PRODUCTS_EXPANSION] }
    );

    if (!configurationSupportsPrices(expandedConfiguration, inspection.priceIds)) {
        throw new Error('SNS Agent24 billing portal configuration is incomplete');
    }

    return expandedConfiguration;
}
