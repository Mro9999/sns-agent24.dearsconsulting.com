import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// 認証不要なルート（公開ページ、ログイン画面、Webhookなど）を定義
const isPublicRoute = createRouteMatcher([
    '/',
    '/api/webhooks(.*)',
    '/api/admin/queue',
    '/api/cron(.*)'
]);

export default clerkMiddleware((auth, req) => {
    // 公開ルート以外は認証を要求
    if (!isPublicRoute(req)) {
        auth().protect();
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
};
