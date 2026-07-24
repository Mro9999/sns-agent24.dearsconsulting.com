"use client";
import React, { Suspense, useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { usePostHog } from 'posthog-js/react';

function SuccessContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const { user } = useUser();
    const posthog = usePostHog();
    const [status, setStatus] = useState('loading'); // loading, complete, error

    useEffect(() => {
        async function fetchAndReload() {
            if (sessionId) {
                // セッションがある場合、Clerkのサーバーから最新の有料プラン権限を再取得する
                if (user) {
                    try {
                        await user.reload();
                        console.log("User session reloaded for paid plan sync");
                    } catch (e) {
                        console.error("Failed to reload user session", e);
                    }
                }
                posthog?.capture('payment_completed', { session_id: sessionId });
                setStatus('complete');
            } else {
                setStatus('error');
            }
        }

        fetchAndReload();
    }, [posthog, sessionId, user]);

    return (
        <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#111112] text-white flex flex-col items-center justify-center p-4 focus:outline-none">
            <div className="bg-black/40 border border-white/10 p-8 md:p-12 rounded-2xl max-w-lg w-full text-center shadow-2xl animate-in zoom-in-95 duration-500" aria-live="polite">
                {status === 'loading' && (
                    <div className="flex flex-col items-center">
                        <div className="animate-spin border-4 border-purple-500 border-t-transparent rounded-full w-16 h-16 mb-6" aria-hidden="true"></div>
                        <h1 className="text-2xl font-bold mb-2">決済状況を確認中...</h1>
                    </div>
                )}

                {status === 'complete' && (
                    <div className="flex flex-col items-center">
                        <CheckCircle size={80} className="text-green-500 mb-6 drop-shadow-[0_0_15px_rgba(34,197,94,0.4)]" aria-hidden="true" />
                        <h1 className="text-3xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-600">
                            アップグレードが<br />完了しました！
                        </h1>
                        <p className="text-gray-300 mb-8 leading-relaxed">
                            有料プランへのご登録ありがとうございます。<br />
                            ご契約内容に応じた機能をご利用いただけます。<br />
                            <span className="mt-3 inline-block text-sm text-gray-400">
                                Pro Maxをご契約の場合は、専任担当から初期設定をご案内します。
                            </span>
                        </p>
                        <Link
                            href="/app"
                            className="w-full h-14 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111112]"
                        >
                            アプリに戻る <ArrowRight size={20} />
                        </Link>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
                            <span className="text-4xl font-bold">!</span>
                        </div>
                        <h1 className="text-2xl font-bold mb-4 text-red-400">決済情報が見つかりません</h1>
                        <p className="text-gray-400 mb-8">
                            恐れ入りますが、もう一度トップページからやり直してください。
                        </p>
                        <Link
                            href="/"
                            className="inline-flex min-h-11 items-center px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111112]"
                        >
                            トップページに戻る
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
}

function SuccessFallback() {
    return (
        <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#111112] text-white flex flex-col items-center justify-center p-4 focus:outline-none">
            <div className="flex flex-col items-center" role="status" aria-live="polite">
                <div className="animate-spin border-4 border-purple-500 border-t-transparent rounded-full w-16 h-16 mb-6" aria-hidden="true" />
                <p className="text-xl font-bold">決済状況を確認中...</p>
            </div>
        </main>
    );
}

export default function SuccessPage() {
    return (
        <Suspense fallback={<SuccessFallback />}>
            <SuccessContent />
        </Suspense>
    );
}
