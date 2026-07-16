import { clerkMiddleware } from '@clerk/nextjs/server';

// ProxyはClerkのセッション情報を各Routeへ渡すことだけを担当する。
// 認証・認可は各ページとRoute Handler内でリソースの直前に再検証する。
export default clerkMiddleware({
    signInUrl: '/sign-in',
    signUpUrl: '/sign-up',
});

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
        '/__clerk/(.*)',
    ],
};
