"use client";

import { memo } from 'react';
import { UserButton } from '@clerk/nextjs';
import { Gem, ShieldCheck } from 'lucide-react';
import useAccountStatus from '@/hooks/useAccountStatus';

const CARD_STYLES = {
    light: {
        section: 'border-slate-200 bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.08)]',
        status: 'text-emerald-700',
        name: 'text-slate-900',
        secondary: 'text-slate-500',
        divider: 'bg-slate-200',
        planBadge: 'bg-rose-50 text-slate-900 ring-rose-200',
        accessBadge: 'bg-emerald-50 text-emerald-950 ring-emerald-200',
        statusTone: {
            success: 'text-emerald-700',
            warning: 'text-amber-700',
            danger: 'text-red-700',
            muted: 'text-slate-500'
        }
    },
    dark: {
        section: 'border-white/10 bg-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.2)] backdrop-blur-md',
        status: 'text-emerald-300',
        name: 'text-white',
        secondary: 'text-slate-400',
        divider: 'bg-white/10',
        planBadge: 'bg-purple-500/10 text-white ring-purple-400/30',
        accessBadge: 'bg-emerald-400/10 text-emerald-100 ring-emerald-300/30',
        statusTone: {
            success: 'text-emerald-300',
            warning: 'text-amber-300',
            danger: 'text-red-300',
            muted: 'text-slate-400'
        }
    }
};

const USER_BUTTON_APPEARANCE = { elements: { avatarBox: 'w-11 h-11' } };

function formatPeriodEnd(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    }).format(date);
}

export const AccountStatusCard = memo(function AccountStatusCard({ status, variant = 'light', className = '' }) {
    const styles = CARD_STYLES[variant] || CARD_STYLES.light;
    if (!status?.isLoaded || !status?.isSignedIn) return null;

    const periodEnd = formatPeriodEnd(status.subscriptionCurrentPeriodEnd);
    const isPaidPlan = ['pro', 'promax'].includes(status.accountPlan.plan);
    const periodLabel = periodEnd && isPaidPlan
        ? (status.subscriptionStatus.status === 'canceling'
            ? `${periodEnd}まで利用できます`
            : `次回更新日 ${periodEnd}`)
        : '';
    const verificationLabel = status.subscriptionVerified === false && isPaidPlan
        ? '最終同期情報'
        : '';
    const statusTone = styles.statusTone[status.subscriptionStatus.tone] || styles.statusTone.muted;

    return (
        <section
            aria-label="ログイン情報、契約プラン、利用権限"
            aria-live="polite"
            className={`flex w-full flex-wrap items-center gap-3 rounded-2xl border px-3 py-2 sm:w-auto ${styles.section} ${className}`}
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

            <div className={`hidden h-12 w-px shrink-0 sm:block ${styles.divider}`} aria-hidden="true"></div>

            <dl className="flex min-w-0 flex-1 flex-wrap items-start gap-x-4 gap-y-2 sm:flex-none">
                <div className="min-w-32">
                    <dt className={`text-xs font-medium ${styles.secondary}`}>契約プラン</dt>
                    <dd>
                        <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ring-1 ring-inset ${styles.planBadge}`}>
                            <Gem size={13} className="text-[#D4A373]" aria-hidden="true" />
                            {status.accountPlan.label}
                        </span>
                        <span className="sr-only">。{status.accountPlan.description}</span>
                        <span className={`mt-1 block text-[11px] font-medium ${statusTone}`}>
                            {status.subscriptionStatus.label}
                            {verificationLabel && `・${verificationLabel}`}
                        </span>
                        {periodLabel && (
                            <span className={`block text-[11px] ${styles.secondary}`}>{periodLabel}</span>
                        )}
                    </dd>
                </div>

                <div className="min-w-28">
                    <dt className={`text-xs font-medium ${styles.secondary}`}>利用権限</dt>
                    <dd>
                        <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ring-1 ring-inset ${styles.accessBadge}`}>
                            <ShieldCheck size={13} aria-hidden="true" />
                            {status.accessLevel.label}
                        </span>
                        <span className="sr-only">。{status.accessLevel.description}</span>
                    </dd>
                </div>
            </dl>

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
