const RESULT_METRIC_CONTEXT = '(売上|EC売上|広告費|CVR|CPA|ROAS|LTV|客単価|顧客満足度|問い合わせ|問合せ|申込|申し込み|成約率|離脱率|継続率|リピート率|利益|粗利|予約数|集客|フォロワー|再購入|購入率|解約率)';
const RESULT_CHANGE_CONTEXT = '(削減|改善|増加|向上|短縮|伸び|上昇|低下|達成|実現|成功|改善)';
const HEALTH_CLAIM_CONTEXT = '(健康|医療|医学|科学|研究|栄養|腸|脳|セロトニン|ホルモン|自律神経|免疫|血糖|睡眠|ストレス|疲労|不調|うつ|コルチゾール)';
const NUMERIC_RATE = '(?:約|およそ)?\\s*(?:[0-9０-９]+(?:[.．][0-9０-９]+)?\\s*(?:%|％|倍)|[0-9０-９]+割|半数|約半数)';

const UNSUPPORTED_METRIC_PATTERNS = [
    new RegExp(`${RESULT_METRIC_CONTEXT}.{0,24}(\\d+(?:\\.\\d+)?\\s*(?:%|％|倍)|[0-9０-９]+割|半数|約半数)`, 'i'),
    new RegExp(`(\\d+(?:\\.\\d+)?\\s*(?:%|％|倍)|[0-9０-９]+割|半数|約半数).{0,24}${RESULT_METRIC_CONTEXT}`, 'i'),
    new RegExp(`(\\d+(?:\\.\\d+)?\\s*(?:%|％|倍)).{0,24}${RESULT_CHANGE_CONTEXT}`, 'i'),
    new RegExp(`(?:ある調査|調査では|データでは|研究では|レポートでは|市場データ).{0,36}\\d+(?:\\.\\d+)?\\s*(?:%|％|倍)`, 'i'),
    new RegExp(`${HEALTH_CLAIM_CONTEXT}.{0,48}${NUMERIC_RATE}`, 'i'),
    new RegExp(`${NUMERIC_RATE}.{0,48}${HEALTH_CLAIM_CONTEXT}`, 'i')
];

const SOURCE_HINT_PATTERN = /(出典|によると|省|庁|機構|協会|白書|調査20\d{2}|20\d{2}年版|令和[0-9０-９]+年)/;

const hasNearbySourceHint = (text = '', matchIndex = 0, matchLength = 0) => {
    const start = Math.max(0, matchIndex - 100);
    const end = Math.min(String(text).length, matchIndex + matchLength + 100);
    return SOURCE_HINT_PATTERN.test(String(text).slice(start, end));
};

export const findUnsupportedMetricMatch = (text = '') => {
    for (const pattern of UNSUPPORTED_METRIC_PATTERNS) {
        const match = String(text).match(pattern);
        if (match && !hasNearbySourceHint(text, match.index || 0, match[0]?.length || 0)) {
            return { pattern, match };
        }
    }
    return null;
};

const removeUnsupportedNumericClaimSentences = (value) => {
    if (typeof value !== 'string') return value;
    return value
        .split(/(?<=[。！？\n])/u)
        .filter(sentence => !findUnsupportedMetricMatch(sentence))
        .join('')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

export const removeUnsupportedNumericClaims = (value) => {
    if (typeof value === 'string') return removeUnsupportedNumericClaimSentences(value);
    if (Array.isArray(value)) return value.map(removeUnsupportedNumericClaims);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, nestedValue]) => [key, removeUnsupportedNumericClaims(nestedValue)])
        );
    }
    return value;
};
