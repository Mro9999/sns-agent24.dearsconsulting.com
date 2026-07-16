/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ['@google/genai', 'stripe'],
    async rewrites() {
        return [
            {
                source: '/clerk-assets/clerk.browser.js',
                destination: 'https://clerk.dearsconsulting.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js',
            },
            {
                source: '/clerk-assets/:asset*',
                destination: 'https://clerk.dearsconsulting.com/npm/@clerk/ui@1.25.4/dist/:asset*',
            },
        ];
    },
    async headers() {
        return [{
            source: '/(.*)',
            headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
            ],
        }];
    },
};

module.exports = nextConfig;
