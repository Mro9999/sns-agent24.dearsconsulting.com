import { SignIn } from '@clerk/nextjs';
import AuthShell from '@/components/auth/AuthShell';

export const metadata = {
    title: 'ログイン',
    description: 'SNS Agent24へログインして、投稿作成を続けます。',
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

export default function SignInPage() {
    return (
        <AuthShell
            eyebrow="WELCOME BACK"
            title="続きから、投稿づくりを始めましょう。"
            description="Googleまたはメールアドレスでログインできます。無料プランのままでも、投稿企画・文章・画像生成を試せます。"
        >
            <SignIn
                appearance={appearance}
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
                fallbackRedirectUrl="/app"
            />
        </AuthShell>
    );
}
