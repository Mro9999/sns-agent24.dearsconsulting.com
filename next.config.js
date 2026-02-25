/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        ignoreDuringBuilds: true,
    },
    experimental: {
        serverComponentsExternalPackages: ['@google/genai', 'stripe'],
    },
    webpack: (config, { isServer }) => {
        if (!isServer) {
            // クライアント側で不要なNode.jsネイティブモジュールの解決エラーを無視
            config.resolve.fallback = {
                ...config.resolve.fallback,
                debug: false,
                fs: false,
                net: false,
                tls: false,
                child_process: false,
            };
        }
        return config;
    },
};

module.exports = nextConfig;
