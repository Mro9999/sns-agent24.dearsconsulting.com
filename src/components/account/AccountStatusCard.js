"use client";

import { memo } from 'react';
import { UserButton } from '@clerk/nextjs';
import { Gem } from 'lucide-react';
import useAccountStatus from '@/hooks/useAccountStatus';

const CARD_STYLES = {
    light: {
        section: 'border-slate-200 bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.08)]',
        status: 'text-emerald-700',
        name: 'text-slate-900',
        secondary: 'text-slate-500',
        divider: 'bg-slate-200',
        badge: 'bg-rose-50 text-slate-900 ring-rose-200'
    },
    dark: {
        section: 'border-white/10 bg-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.2)] backdrop-blur-md',
        status: 'text-emerald-300',
        name: 'text-white',
        secondary: 'text-slate-400',
        divider: 'bg-white/10',
        badge: 'bg-purple-500/10 text-white ring-purple-400/30'
    }
};

const USER_BUTTON_APPEARANCE = { elements: { avatarBox: 'w-11 h-11' } };

export const AccountStatusCard = memo(function AccountStatusCard({ status, variant = 'light', className = '' }) {
    const styles = CARD_STYLES[variant] || CARD_STYLES.light;
    if (!status?.isLoaded || !status?.isSignedIn) return null;

    return (
        <section
            aria-label="ログイン情報と現在のプラン"
            aria-live="polite"
            className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 sm:w-auto ${styles.section} ${className}`}
        >
            <div className="min-w-0 flex-1 sm:max-w-52">
                <p className={`flex items-center gap-1.5 text-xs font-bold ${styles.status}`}>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
                    ログイン中
                </p>
                <p className={`truncate text-sm font-bold ${styles.name}`}>{status.accountName}</p>
                {status.accountEmail && status.accountEmail !== status.accountName && (
                    <p className={`truncate text-xs ${styles.secondary}`}>{status.accountEmail}</p>
                )}
            </div>
            <div className={`h-10 w-px shrink-0 ${styles.divider}`} aria-hidden="true"></div>
            <div className="min-w-0 shrink-0">
                <p className={`text-xs font-medium ${styles.secondary}`}>現在のプラン</p>
                <p className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ring-1 ring-inset ${styles.badge}`}>
                    <Gem size={13} className="text-[#D4A373]" aria-hidden="true" />
                    {status.accountPlan.label}
                    <span className="sr-only">。{status.accountPlan.description}</span>
                </p>
            </div>
            <UserButton
                afterSignOutUrl="/"
                appearance={USER_BUTTON_APPEARANCE}
            />
        </section>
    );
});

export default function AccountStatus({ variant = 'light', className = '' }) {
    const status = useAccountStatus();
    return <AccountStatusCard status={status} variant={variant} className={className} />;
}
