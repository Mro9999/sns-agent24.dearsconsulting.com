import { ClerkProvider } from '@clerk/nextjs'
import { jaJP } from '@clerk/localizations'
import './globals.css'

export const metadata = {
    title: 'SNS Agent24',
    description: 'SNS Agent24 - 最新のトレンドリサーチから投稿作成まで全自動。',
}

export default function RootLayout({ children }) {
    return (
        <ClerkProvider localization={jaJP}>
            <html lang="ja">
                <body>{children}</body>
            </html>
        </ClerkProvider>
    )
}
