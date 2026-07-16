import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
    ...nextVitals,
    {
        rules: {
            // 既存のローカルストレージ復元・モーダル同期は意図したEffectのため、段階移行とする。
            'react-hooks/set-state-in-effect': 'off',
        },
    },
    globalIgnores([
        '.next/**',
        'node_modules/**',
        'artifacts/**',
    ]),
]);
