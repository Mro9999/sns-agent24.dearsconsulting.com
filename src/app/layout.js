import { ClerkProvider } from '@clerk/nextjs'
import { jaJP } from '@clerk/localizations'
import './globals.css'
import { PHProvider } from '../providers/PHProvider'

const localization = {
    ...jaJP,
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
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
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
