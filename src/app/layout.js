import { ClerkProvider } from '@clerk/nextjs'
import { jaJP } from '@clerk/localizations'
import './globals.css'
import { PHProvider } from '../providers/PHProvider'

const localization = {
    ...jaJP,
    // Clerk の日本語リソースで未翻訳のままになっている登録用プレースホルダーを補完する。
    formFieldInputPlaceholder__signUpPassword: 'パスワードを作成',
    signIn: {
        ...jaJP.signIn,
        start: {
            ...jaJP.signIn.start,
            title: 'SNS Agent24にログイン',
            titleCombined: 'SNS Agent24へ進む',
            subtitle: '続きから投稿づくりを始めましょう。',
            subtitleCombined: '続きから投稿づくりを始めましょう。',
        },
    },
}

export const metadata = {
    metadataBase: new URL('https://sns-agent24.dearsconsulting.com'),
    title: {
        default: 'SNS Agent24',
        template: '%s | SNS Agent24',
    },
    description: '事業情報をもとに、SNS投稿の企画・文章・画像をまとめて作成。無料で1本から試せます。',
    openGraph: {
        title: 'SNS Agent24',
        description: 'SNS投稿の企画・文章・画像を、事業に合わせてまとめて作成。',
        url: '/',
        siteName: 'SNS Agent24',
        locale: 'ja_JP',
        type: 'website',
    },
    robots: {
        index: true,
        follow: true,
    },
}

export const maxDuration = 60; // タイムアウトを最大60秒に延長

export default function RootLayout({ children }) {
    return (
        <ClerkProvider
            localization={localization}
            // ClerkのCDNスクリプトだけを同一オリジンで配信し、
            // コンテンツブロッカーによる認証UIの読込失敗を避ける。
            __internal_clerkJSUrl="/clerk-assets/clerk.browser.js"
            __internal_clerkUIUrl="/clerk-assets/ui.browser.js"
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInFallbackRedirectUrl="/app"
            signUpFallbackRedirectUrl="/app"
            signInForceRedirectUrl="/app"
            signUpForceRedirectUrl="/app"
            afterSignOutUrl="/"
        >
            <html lang="ja" data-scroll-behavior="smooth">
                <PHProvider>
                    <body>{children}</body>
                </PHProvider>
            </html>
        </ClerkProvider>
    )
}
