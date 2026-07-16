import { SignUp } from '@clerk/nextjs';
import AuthShell from '@/components/auth/AuthShell';

export const metadata = {
    title: '無料ではじめる',
    description: 'SNS Agent24の無料アカウントを作成します。',
    robots: { index: false, follow: false },
};

const appearance = {
    variables: {
        colorPrimary: '#e11d48',
        borderRadius: '0.75rem',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    elements: {
        rootBox: 'w-full',
        cardBox: 'w-full shadow-none',
        card: 'w-full shadow-none border-0 p-0 bg-transparent',
        headerTitle: 'text-slate-900',
        headerSubtitle: 'text-slate-600',
        formButtonPrimary: 'bg-slate-950 hover:bg-slate-800 normal-case',
        footer: 'bg-transparent',
    },
};

export default function SignUpPage() {
    return (
        <AuthShell
            eyebrow="FREE START"
            title="まずは1本、あなたの事業の投稿を作ってみましょう。"
            description="登録後、事業内容などの短い質問に答えるだけで始められます。料金はかからず、カード登録もありません。"
        >
            <SignUp
                appearance={appearance}
                routing="path"
                path="/sign-up"
                signInUrl="/sign-in"
                fallbackRedirectUrl="/app"
            />
        </AuthShell>
    );
}
