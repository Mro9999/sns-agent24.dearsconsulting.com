"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSession, useUser } from '@clerk/nextjs';
import {
    resolveAccessLevel,
    resolveAccountPlan,
    resolveSubscriptionStatus
} from '@/lib/accountPlan.mjs';

export default function useAccountStatus() {
    const { user, isLoaded, isSignedIn } = useUser();
    const { session } = useSession();
    const [serverIsPro, setServerIsPro] = useState(null);
    const [serverIsProMax, setServerIsProMax] = useState(null);
    const [serverAccessRole, setServerAccessRole] = useState(null);
    const [serverSubscriptionPlan, setServerSubscriptionPlan] = useState(null);
    const [serverSubscriptionStatus, setServerSubscriptionStatus] = useState(null);
    const [subscriptionCancelAtPeriodEnd, setSubscriptionCancelAtPeriodEnd] = useState(false);
    const [subscriptionCurrentPeriodEnd, setSubscriptionCurrentPeriodEnd] = useState(null);
    const [subscriptionVerified, setSubscriptionVerified] = useState(null);
    const [isPlanStatusLoading, setIsPlanStatusLoading] = useState(true);
    const [billingAttentionRequired, setBillingAttentionRequired] = useState(false);
    const [billingPortalAvailable, setBillingPortalAvailable] = useState(null);

    useEffect(() => {
        const controller = new AbortController();

        if (!isLoaded) return () => controller.abort();
        if (!isSignedIn) {
            setServerIsPro(false);
            setServerIsProMax(false);
            setServerAccessRole(null);
            setServerSubscriptionPlan('free');
            setServerSubscriptionStatus('none');
            setSubscriptionCancelAtPeriodEnd(false);
            setSubscriptionCurrentPeriodEnd(null);
            setSubscriptionVerified(true);
            setBillingAttentionRequired(false);
            setBillingPortalAvailable(false);
            setIsPlanStatusLoading(false);
            return () => controller.abort();
        }

        setIsPlanStatusLoading(true);
        fetch('/api/user/status', {
            cache: 'no-store',
            signal: controller.signal
        })
            .then((response) => {
                if (!response.ok) throw new Error(`User status request failed (${response.status})`);
                return response.json();
            })
            .then((data) => {
                setServerIsPro(Boolean(data.isPro));
                setServerIsProMax(Boolean(data.isProMax));
                setServerAccessRole(data.accessRole || data.role || 'free');
                setServerSubscriptionPlan(data.subscriptionPlan || 'free');
                setServerSubscriptionStatus(data.subscriptionStatus || 'none');
                setSubscriptionCancelAtPeriodEnd(Boolean(data.subscriptionCancelAtPeriodEnd));
                setSubscriptionCurrentPeriodEnd(data.subscriptionCurrentPeriodEnd || null);
                setSubscriptionVerified(data.subscriptionVerified !== false);
                setBillingAttentionRequired(Boolean(data.billingAttentionRequired));
                setBillingPortalAvailable(Boolean(data.billingPortalAvailable));
            })
            .catch((error) => {
                if (error.name !== 'AbortError') {
                    console.error(error);
                    setServerSubscriptionPlan('unknown');
                    setServerSubscriptionStatus('unknown');
                    setSubscriptionVerified(false);
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsPlanStatusLoading(false);
            });

        return () => controller.abort();
    }, [isLoaded, isSignedIn, user?.id]);

    const sessionRole = session?.user?.publicMetadata?.role || null;
    const metadataRole = user?.publicMetadata?.role || null;
    const isAdmin = serverAccessRole === 'admin' || sessionRole === 'admin' || metadataRole === 'admin';
    const isProMax = isAdmin || serverIsProMax === true || sessionRole === 'promax' || metadataRole === 'promax';
    const isPro = isProMax || serverIsPro === true || sessionRole === 'pro' || metadataRole === 'pro';
    const role = serverAccessRole || sessionRole || metadataRole || null;
    const accountPlan = useMemo(() => resolveAccountPlan({
        subscriptionPlan: serverSubscriptionPlan,
        subscriptionStatus: serverSubscriptionStatus,
        isLoading: isSignedIn && isPlanStatusLoading
    }), [serverSubscriptionPlan, serverSubscriptionStatus, isSignedIn, isPlanStatusLoading]);
    const accessLevel = useMemo(() => resolveAccessLevel({
        accessRole: role
    }), [role]);
    const subscriptionStatus = useMemo(() => resolveSubscriptionStatus({
        subscriptionStatus: serverSubscriptionStatus,
        cancelAtPeriodEnd: subscriptionCancelAtPeriodEnd,
        isLoading: isSignedIn && isPlanStatusLoading
    }), [serverSubscriptionStatus, subscriptionCancelAtPeriodEnd, isSignedIn, isPlanStatusLoading]);
    const accountEmail = user?.primaryEmailAddress?.emailAddress || '';
    const accountName = user?.fullName?.trim() || user?.username || accountEmail || 'ログイン中のユーザー';

    return useMemo(() => ({
        user,
        isLoaded,
        isSignedIn,
        isAdmin,
        isPro,
        isProMax,
        role,
        accountPlan,
        accessLevel,
        subscriptionStatus,
        subscriptionCurrentPeriodEnd,
        subscriptionVerified,
        accountName,
        accountEmail,
        isPlanStatusLoading,
        billingAttentionRequired,
        billingPortalAvailable
    }), [
        user,
        isLoaded,
        isSignedIn,
        isAdmin,
        isPro,
        isProMax,
        role,
        accountPlan,
        accessLevel,
        subscriptionStatus,
        subscriptionCurrentPeriodEnd,
        subscriptionVerified,
        accountName,
        accountEmail,
        isPlanStatusLoading,
        billingAttentionRequired,
        billingPortalAvailable
    ]);
}
