"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSession, useUser } from '@clerk/nextjs';
import { resolveAccountPlan } from '@/lib/accountPlan.mjs';

export default function useAccountStatus() {
    const { user, isLoaded, isSignedIn } = useUser();
    const { session } = useSession();
    const [serverIsPro, setServerIsPro] = useState(null);
    const [serverIsProMax, setServerIsProMax] = useState(null);
    const [serverRole, setServerRole] = useState(null);
    const [isPlanStatusLoading, setIsPlanStatusLoading] = useState(true);
    const [billingAttentionRequired, setBillingAttentionRequired] = useState(false);
    const [billingPortalAvailable, setBillingPortalAvailable] = useState(null);

    useEffect(() => {
        const controller = new AbortController();

        if (!isLoaded) return () => controller.abort();
        if (!isSignedIn) {
            setServerIsPro(false);
            setServerIsProMax(false);
            setServerRole(null);
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
                setServerRole(data.role || 'free');
                setBillingAttentionRequired(Boolean(data.billingAttentionRequired));
                setBillingPortalAvailable(Boolean(data.billingPortalAvailable));
            })
            .catch((error) => {
                if (error.name !== 'AbortError') console.error(error);
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsPlanStatusLoading(false);
            });

        return () => controller.abort();
    }, [isLoaded, isSignedIn, user?.id]);

    const sessionRole = session?.user?.publicMetadata?.role || null;
    const metadataRole = user?.publicMetadata?.role || null;
    const isAdmin = serverRole === 'admin' || sessionRole === 'admin' || metadataRole === 'admin';
    const isProMax = isAdmin || serverIsProMax === true || sessionRole === 'promax' || metadataRole === 'promax';
    const isPro = isProMax || serverIsPro === true || sessionRole === 'pro' || metadataRole === 'pro';
    const role = serverRole || sessionRole || metadataRole || null;
    const accountPlan = useMemo(() => resolveAccountPlan({
        role,
        isPro,
        isProMax,
        isLoading: isSignedIn && isPlanStatusLoading
    }), [role, isPro, isProMax, isSignedIn, isPlanStatusLoading]);
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
        accountName,
        accountEmail,
        isPlanStatusLoading,
        billingAttentionRequired,
        billingPortalAvailable
    ]);
}
