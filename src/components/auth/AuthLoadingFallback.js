"use client";

import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

const COPY = {
    'sign-in': {
        loading: 'ログイン画面を読み込んでいます',
        failed: 'ログイン画面を読み込めませんでした。',
    },
    'sign-up': {
        loading: 'アカウント作成画面を読み込んでいます',
        failed: 'アカウント作成画面を読み込めませんでした。',
    },
};

export default function AuthLoadingFallback({ mode = 'sign-in' }) {
    const [hasTimedOut, setHasTimedOut] = useState(false);
    const copy = COPY[mode] || COPY['sign-in'];

    useEffect(() => {
        const timer = window.setTimeout(() => setHasTimedOut(true), 5000);
        return () => window.clearTimeout(timer);
    }, []);

    if (!hasTimedOut) {
        return (
            <div
                className="flex min-h-64 flex-col items-center justify-center gap-4 text-center text-slate-600"
                role="status"
                aria-live="polite"
            >
                <Loader2 className="animate-spin text-rose-500" size={28} aria-hidden="true" />
                <p className="text-sm font-medium">{copy.loading}…</p>
            </div>
        );
    }

    return (
        <div className="flex min-h-64 flex-col items-center justify-center gap-5 text-center" role="alert">
            <div>
                <p className="font-bold text-slate-900">{copy.failed}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                    再読み込みしても進めない場合は、ブラウザのコンテンツブロックを一時的に解除してお試しください。
                </p>
            </div>

            <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            >
                <RefreshCw size={16} aria-hidden="true" />
                認証画面を再読み込み
            </button>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-medium">
                <Link href="/" className="text-slate-600 underline underline-offset-4 hover:text-slate-900">
                    トップへ戻る
                </Link>
                <Link
                    href="https://dearsconsulting.com/otoiawase/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rose-600 underline underline-offset-4 hover:text-rose-700"
                >
                    お問い合わせ
                </Link>
            </div>
        </div>
    );
}
