const PLAN_DETAILS = {
    free: {
        role: 'free',
        label: 'Freeプラン',
        description: '1日3回まで利用できます'
    },
    pro: {
        role: 'pro',
        label: 'Proプラン',
        description: '投稿作成を無制限で利用できます'
    },
    promax: {
        role: 'promax',
        label: 'Pro Maxプラン',
        description: 'すべての機能を利用できます'
    },
    admin: {
        role: 'admin',
        label: '運営者アカウント',
        description: 'すべての機能を利用できます'
    }
};

export function resolveAccountPlan({ role, isPro = false, isProMax = false, isLoading = false } = {}) {
    if (isLoading) {
        return {
            role: 'loading',
            label: 'プランを確認中',
            description: '契約状況を確認しています'
        };
    }

    const normalizedRole = typeof role === 'string' ? role.toLowerCase() : '';
    if (PLAN_DETAILS[normalizedRole]) return PLAN_DETAILS[normalizedRole];
    if (isProMax) return PLAN_DETAILS.promax;
    if (isPro) return PLAN_DETAILS.pro;
    return PLAN_DETAILS.free;
}
