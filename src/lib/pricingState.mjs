export function pricingRelation(currentPlan, planTier) {
    if (currentPlan === null) return 'guest';
    const ranks = { free: 0, pro: 1, promax: 2 };
    if (!Object.hasOwn(ranks, currentPlan)) return 'unknown';
    if (ranks[currentPlan] === ranks[planTier]) return 'current';
    return ranks[planTier] < ranks[currentPlan] ? 'lower' : 'upper';
}

export function pricingPlanFromAccount(account) {
    if (!account.isLoaded) return 'loading';
    if (!account.isSignedIn) return null;
    if (account.isPlanStatusLoading) return 'loading';
    if (account.subscriptionVerified !== true) return 'unknown';
    return account.accountPlan.plan;
}
