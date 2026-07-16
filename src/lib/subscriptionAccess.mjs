export const ACCESS_ENABLED_SUBSCRIPTION_STATUSES = new Set([
    'active',
    'trialing',
    // 支払い再試行中は即時停止せず、Stripeの回収期間中はアクセスを維持する。
    'past_due'
]);

export function subscriptionPriceIdsFromEnv(env = {}) {
    return {
        pro: [env.STRIPE_PRICE_ID_MONTHLY, env.STRIPE_PRICE_ID_YEARLY, env.STRIPE_PRICE_ID].filter(Boolean),
        promax: [env.STRIPE_PRICE_ID_PROMAX_MONTHLY, env.STRIPE_PRICE_ID_PROMAX_YEARLY].filter(Boolean)
    };
}

export function roleForSubscriptionPrice(priceId, priceIds) {
    if (!priceId) return null;
    if (priceIds.promax.includes(priceId)) return 'promax';
    if (priceIds.pro.includes(priceId)) return 'pro';
    return null;
}

export function subscriptionPeriodEnd(subscription) {
    if (Number.isFinite(subscription?.current_period_end)) {
        return subscription.current_period_end;
    }

    const itemPeriodEnds = subscription?.items?.data
        ?.map((item) => item.current_period_end)
        .filter(Number.isFinite) || [];

    return itemPeriodEnds.length > 0 ? Math.max(...itemPeriodEnds) : null;
}

export function resolveSubscriptionAccess(subscription, priceIds) {
    const priceId = subscription?.items?.data?.[0]?.price?.id || null;
    const paidRole = roleForSubscriptionPrice(priceId, priceIds);
    const recognized = Boolean(paidRole);
    const accessEnabled = recognized && ACCESS_ENABLED_SUBSCRIPTION_STATUSES.has(subscription?.status);

    return {
        accessEnabled,
        periodEnd: subscriptionPeriodEnd(subscription),
        priceId,
        recognized,
        role: accessEnabled ? paidRole : null,
        status: subscription?.status || null
    };
}
