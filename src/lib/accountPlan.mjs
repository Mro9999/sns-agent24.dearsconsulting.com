const PLAN_DETAILS = {
    free: {
        plan: 'free',
        label: 'Freeプラン',
        description: 'SNS Agent24の有料契約はありません'
    },
    pro: {
        plan: 'pro',
        label: 'Proプラン',
        description: '投稿作成を無制限で利用できます'
    },
    promax: {
        plan: 'promax',
        label: 'Pro Maxプラン',
        description: 'すべての機能を利用できます'
    },
    unknown: {
        plan: 'unknown',
        label: '契約プランを確認できません',
        description: '時間をおいて再度ご確認ください'
    },
    loading: {
        plan: 'loading',
        label: 'プランを確認中',
        description: 'SNS Agent24の契約状況を確認しています'
    }
};

const ACCESS_DETAILS = {
    admin: {
        role: 'admin',
        label: '運営者',
        description: '契約プランに関係なく、すべての機能を利用できます'
    },
    member: {
        role: 'member',
        label: '通常ユーザー',
        description: '契約プランに応じた機能を利用できます'
    }
};

const SUBSCRIPTION_STATUS_DETAILS = {
    active: {
        status: 'active',
        label: '契約中',
        tone: 'success'
    },
    trialing: {
        status: 'trialing',
        label: '無料トライアル中',
        tone: 'success'
    },
    past_due: {
        status: 'past_due',
        label: 'お支払い方法の確認が必要',
        tone: 'warning'
    },
    canceling: {
        status: 'canceling',
        label: '解約予定',
        tone: 'warning'
    },
    incomplete: {
        status: 'incomplete',
        label: 'お支払い手続き中',
        tone: 'warning'
    },
    incomplete_expired: {
        status: 'incomplete_expired',
        label: '契約手続き未完了',
        tone: 'danger'
    },
    canceled: {
        status: 'canceled',
        label: '解約済み',
        tone: 'muted'
    },
    unpaid: {
        status: 'unpaid',
        label: 'お支払い未完了',
        tone: 'danger'
    },
    paused: {
        status: 'paused',
        label: '一時停止中',
        tone: 'warning'
    },
    none: {
        status: 'none',
        label: '有料契約なし',
        tone: 'muted'
    },
    unknown: {
        status: 'unknown',
        label: '契約状況を確認できません',
        tone: 'warning'
    },
    loading: {
        status: 'loading',
        label: '確認中',
        tone: 'muted'
    }
};

export function resolveAccountPlan({ subscriptionPlan, subscriptionStatus, isLoading = false } = {}) {
    if (isLoading) return PLAN_DETAILS.loading;

    const normalizedStatus = typeof subscriptionStatus === 'string'
        ? subscriptionStatus.toLowerCase()
        : '';
    if (normalizedStatus === 'unknown') return PLAN_DETAILS.unknown;

    const normalizedPlan = typeof subscriptionPlan === 'string'
        ? subscriptionPlan.toLowerCase()
        : '';
    if (PLAN_DETAILS[normalizedPlan]) return PLAN_DETAILS[normalizedPlan];
    return PLAN_DETAILS.free;
}

export function resolveAccessLevel({ accessRole } = {}) {
    return accessRole === 'admin' ? ACCESS_DETAILS.admin : ACCESS_DETAILS.member;
}

export function resolveSubscriptionStatus({
    subscriptionStatus,
    cancelAtPeriodEnd = false,
    isLoading = false
} = {}) {
    if (isLoading) return SUBSCRIPTION_STATUS_DETAILS.loading;
    if (cancelAtPeriodEnd && ['active', 'trialing'].includes(subscriptionStatus)) {
        return SUBSCRIPTION_STATUS_DETAILS.canceling;
    }

    const normalizedStatus = typeof subscriptionStatus === 'string'
        ? subscriptionStatus.toLowerCase()
        : 'none';
    return SUBSCRIPTION_STATUS_DETAILS[normalizedStatus] || SUBSCRIPTION_STATUS_DETAILS.unknown;
}
