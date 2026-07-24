const SUPPORTED_INTERVALS = new Set(['month', 'year']);
const SUPPORTED_TIERS = new Set(['pro', 'promax']);
const ACTIVE_CHANGEABLE_STATUSES = new Set(['active', 'trialing']);
const RESTARTABLE_STATUSES = new Set(['canceled', 'incomplete_expired']);
const ADMIN_BILLING_STATUSES = new Set([
    'active',
    'trialing',
    'past_due',
    'incomplete',
    'unpaid',
    'paused'
]);

const PRICE_ENV_KEYS = {
    pro: {
        month: ['STRIPE_PRICE_ID_MONTHLY', 'STRIPE_PRICE_ID'],
        year: ['STRIPE_PRICE_ID_YEARLY']
    },
    promax: {
        month: ['STRIPE_PRICE_ID_PROMAX_MONTHLY'],
        year: ['STRIPE_PRICE_ID_PROMAX_YEARLY']
    }
};

export function resolveCheckoutSelection(
    { interval = 'month', tier = 'pro' } = {},
    env = {}
) {
    if (!SUPPORTED_INTERVALS.has(interval) || !SUPPORTED_TIERS.has(tier)) {
        return {
            error: 'Unsupported plan selection',
            interval,
            priceId: null,
            tier,
            valid: false
        };
    }

    const priceId = PRICE_ENV_KEYS[tier][interval]
        .map((key) => env[key])
        .find(Boolean) || null;

    return {
        error: priceId ? null : 'Missing Stripe Price ID',
        interval,
        priceId,
        tier,
        valid: Boolean(priceId)
    };
}

export function decideSubscriptionPurchase({
    access,
    itemCount = 1,
    targetPriceId,
    targetTier
} = {}) {
    if (!access?.recognized || !access?.status) {
        return 'checkout';
    }

    if (RESTARTABLE_STATUSES.has(access.status)) {
        return 'checkout';
    }

    if (!ACTIVE_CHANGEABLE_STATUSES.has(access.status)) {
        return 'manage';
    }

    if (access.priceId === targetPriceId || access.plan === targetTier) {
        return 'manage';
    }

    if (itemCount === 1 && access.plan === 'pro' && targetTier === 'promax') {
        return 'upgrade';
    }

    // 有効な既存契約がある状態では、別のCheckoutを作って二重契約にしない。
    return 'manage';
}

export function canAdminUsePaidBilling(access) {
    return Boolean(
        access?.recognized
        && ADMIN_BILLING_STATUSES.has(access.status)
    );
}
