export const FREE_DAILY_GENERATION_LIMIT = 3;

const UNLIMITED_GENERATION_ROLES = new Set(['pro', 'promax', 'admin']);

export function hasUnlimitedGenerationAccess(role) {
    return UNLIMITED_GENERATION_ROLES.has(
        typeof role === 'string' ? role.trim().toLowerCase() : ''
    );
}

export function freeGenerationLimitMessage(limit = FREE_DAILY_GENERATION_LIMIT) {
    return `無料プランは1日${limit}回まで生成できます。明日もう一度お試しいただくか、無制限で使えるProプランをご確認ください。`;
}
