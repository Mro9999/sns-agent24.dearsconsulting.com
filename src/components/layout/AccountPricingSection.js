"use client";

import useAccountStatus from '@/hooks/useAccountStatus';
import { pricingPlanFromAccount } from '@/lib/pricingState.mjs';
import PricingSection from './PricingSection';

export default function AccountPricingSection() {
    const account = useAccountStatus();
    const currentPlan = pricingPlanFromAccount(account);
    const openPlanManagement = () => window.location.assign('/app#pricing');

    return (
        <>
            {currentPlan === 'unknown' && (
                <p role="status" className="mx-auto max-w-2xl px-6 py-4 text-base text-amber-800">
                    契約状況を確認できませんでした。再契約せず、時間をおいてページを更新してください。
                </p>
            )}
            <PricingSection
                currentPlan={currentPlan}
                billingPortalAvailable={account.billingPortalAvailable === true}
                onManage={openPlanManagement}
                onUpgrade={account.isSignedIn ? openPlanManagement : undefined}
            />
        </>
    );
}
