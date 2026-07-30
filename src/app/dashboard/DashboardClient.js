"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Database, Clock, Copy, Download, Image as ImageIcon, Calendar, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import NextImage from 'next/image';
import useAccountStatus from '@/hooks/useAccountStatus';
import { AccountStatusCard } from '@/components/account/AccountStatusCard';

const HISTORY_CACHE_TTL_MS = 30 * 1000;
let historyPageCache = {
    userId: null,
    items: [],
    total: 0,
    hasMore: false,
    loadedAt: 0,
    initialized: false
};

export default function DashboardPage() {
    const accountStatus = useAccountStatus();
    const { user, isLoaded, isSignedIn } = accountStatus;
    const [generations, setGenerations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [totalGenerations, setTotalGenerations] = useState(0);
    const [hasMore, setHasMore] = useState(false);

    const loadGenerations = useCallback(async ({ offset = 0, append = false, background = false } = {}) => {
        if (append) {
            setIsLoadingMore(true);
        } else if (!background) {
            setIsLoading(true);
        }
        setLoadError('');

        try {
            const response = await fetch(`/api/generations?limit=8&offset=${offset}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(payload?.error || '履歴を取得できませんでした。');
            }

            const items = Array.isArray(payload?.items) ? payload.items : [];
            const total = Number.isFinite(payload?.total) ? payload.total : items.length;
            const nextHasMore = payload?.hasMore === true;

            setGenerations((current) => {
                const existingIds = new Set(current.map((item) => item.id));
                const nextItems = append
                    ? [...current, ...items.filter((item) => !existingIds.has(item.id))]
                    : items;

                historyPageCache = {
                    userId: user?.id || null,
                    items: nextItems,
                    total,
                    hasMore: nextHasMore,
                    loadedAt: Date.now(),
                    initialized: true
                };

                return nextItems;
            });
            setTotalGenerations(total);
            setHasMore(nextHasMore);
        } catch (error) {
            console.error('Error fetching history:', error);
            setLoadError('生成履歴を読み込めませんでした。時間をおいて、もう一度お試しください。');
        } finally {
            if (append) {
                setIsLoadingMore(false);
            } else if (!background) {
                setIsLoading(false);
            }
        }
    }, [user?.id]);

    useEffect(() => {
        if (isLoaded && isSignedIn) {
            const isSameUserCache = historyPageCache.initialized && historyPageCache.userId === user?.id;
            if (isSameUserCache) {
                setGenerations(historyPageCache.items);
                setTotalGenerations(historyPageCache.total);
                setHasMore(historyPageCache.hasMore);
                setIsLoading(false);

                if (Date.now() - historyPageCache.loadedAt >= HISTORY_CACHE_TTL_MS) {
                    loadGenerations({ background: true });
                }
                return;
            }

            setGenerations([]);
            setTotalGenerations(0);
            setHasMore(false);
            loadGenerations();
        } else if (isLoaded && !isSignedIn) {
            setIsLoading(false);
        }
    }, [isLoaded, isSignedIn, user?.id, loadGenerations]);

    if (!isLoaded || (isLoaded && !isSignedIn)) {
        return (
            <div className="min-h-screen bg-[#111112] flex flex-col items-center justify-center text-white">
                {!isLoaded ? (
                    <div className="text-center" role="status" aria-live="polite">
                        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" aria-hidden="true"></div>
                        <p className="font-bold text-gray-200">ログイン情報を確認しています</p>
                    </div>
                ) : (
                    <div className="text-center">
                        <Database size={48} className="text-gray-600 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">ログインが必要です</h2>
                        <Link href="/" className="text-purple-400 hover:text-purple-300 underline">トップページに戻る</Link>
                    </div>
                )}
            </div>
        );
    }

    // 1投稿あたり約2時間を節約したと仮定（ゲーミフィケーション要素）
    const savedHours = totalGenerations * 2;

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('コピーしました！');
    };

    return (
        <div className="min-h-screen bg-[#111112] text-white font-sans selection:bg-purple-500/30">
            {/* Header */}
            <header className="sticky top-0 z-50 flex w-full flex-col gap-3 border-b border-white/5 bg-black/30 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <Link href="/app" replace className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black">
                    <ChevronLeft size={20} aria-hidden="true" /> <span className="text-sm font-bold">作成ツールに戻る</span>
                </Link>
                <AccountStatusCard status={accountStatus} variant="dark" />
            </header>

            <main id="main-content" tabIndex={-1} className="max-w-6xl mx-auto px-4 py-8 focus:outline-none">
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h1 className="text-3xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500 flex items-center gap-3">
                        <Database className="text-purple-400" /> SNS資産ダッシュボード
                    </h1>
                    <p className="text-gray-400 text-sm">これまでAIと一緒に作り上げた、あなただけのマーケティング資産ポートフォリオです。</p>
                </div>

                {/* ゲーミフィケーション・サマリー */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
                    <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/10 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-indigo-500/20"></div>
                        <h2 className="text-indigo-300 text-sm font-bold mb-1 flex items-center gap-2"><ImageIcon size={16} aria-hidden="true" /> 累計生成コンテンツ数</h2>
                        <div className="flex items-baseline gap-2 relative z-10">
                            <span className="text-5xl font-extrabold text-white">{totalGenerations}</span>
                            <span className="text-indigo-400 font-bold">件</span>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-pink-900/30 to-orange-900/10 border border-pink-500/20 rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-pink-500/20"></div>
                        <h2 className="text-pink-300 text-sm font-bold mb-1 flex items-center gap-2"><Clock size={16} aria-hidden="true" /> AIが節約した業務時間</h2>
                        <div className="flex items-baseline gap-2 relative z-10">
                            <span className="text-5xl font-extrabold text-white">{savedHours}</span>
                            <span className="text-pink-400 font-bold">時間</span>
                        </div>
                        <p className="text-xs text-pink-500/70 mt-2 relative z-10">※1投稿あたり2時間の作成業務として換算</p>
                    </div>
                </div>

                {/* 履歴リスト */}
                <div className="mb-6 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-xl font-bold text-gray-200">過去の生成履歴</h2>
                    <button
                        type="button"
                        onClick={() => loadGenerations()}
                        disabled={isLoading || isLoadingMore}
                        className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-wait disabled:opacity-60 sm:self-auto"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
                        履歴を更新
                    </button>
                </div>

                {isLoading && generations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-32" role="status" aria-live="polite">
                        <div className="animate-spin border-4 border-purple-500 border-t-transparent rounded-full w-12 h-12" aria-hidden="true"></div>
                        <span className="text-sm font-bold text-gray-300">生成履歴を読み込んでいます</span>
                    </div>
                ) : loadError && generations.length === 0 ? (
                    <div role="alert" className="text-center py-16 bg-red-500/5 rounded-2xl border border-red-400/20 animate-in zoom-in duration-500">
                        <AlertTriangle size={48} className="text-red-300 mx-auto mb-4" aria-hidden="true" />
                        <h3 className="text-lg font-bold text-gray-100 mb-2">履歴を読み込めませんでした</h3>
                        <p className="text-gray-400 text-sm mb-6">{loadError}</p>
                        <button
                            type="button"
                            onClick={() => loadGenerations()}
                            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white px-6 py-3 rounded-full font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-purple-400"
                        >
                            <RefreshCw size={18} aria-hidden="true" /> もう一度読み込む
                        </button>
                    </div>
                ) : generations.length === 0 ? (
                    <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/5 animate-in zoom-in duration-500">
                        <Database size={48} className="text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-300 mb-2">まだ履歴がありません</h3>
                        <p className="text-gray-500 text-sm mb-6">最初の投稿を生成して、SNS資産を積み上げましょう！</p>
                        <Link href="/app" replace className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-8 py-4 rounded-full font-bold transition-all shadow-lg hover:shadow-purple-500/25">
                            投稿を作成する <ArrowRight size={18} />
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                            {generations.map((gen) => (
                                <div key={gen.id} className="bg-[#1a1a24] border border-white/5 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all group flex flex-col h-full shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_8px_30px_rgba(147,51,234,0.15)]">
                                {/* Header / Date */}
                                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                                    <div className="flex items-center gap-2">
                                        {gen.platform === 'instagram' && <div className="text-pink-500 font-bold text-[10px] tracking-wider bg-pink-500/10 px-2 py-1 rounded border border-pink-500/20">INSTAGRAM</div>}
                                    </div>
                                    <div className="flex items-center gap-1 text-gray-500 text-xs font-mono">
                                        <Calendar size={12} />
                                        {new Date(gen.created_at).toLocaleDateString('ja-JP')}
                                    </div>
                                </div>

                                {/* Content / Images */}
                                <div className="p-5 flex-1 flex flex-col">
                                    {/* Images preview (if any) */}
                                    {gen.image_urls && gen.image_urls.length > 0 && (
                                        <div className="relative mb-4 flex gap-2 overflow-hidden">
                                            {gen.image_urls.slice(0, 1).map((url, idx) => (
                                                <NextImage
                                                    key={idx}
                                                    src={url}
                                                    alt={`保存済み投稿画像 ${idx + 1}枚目`}
                                                    width={96}
                                                    height={96}
                                                    unoptimized
                                                    className="w-24 h-24 object-cover rounded-lg border border-white/10 snap-center shrink-0 shadow-md"
                                                />
                                            ))}
                                            {gen.image_count > 1 && (
                                                <span className="absolute bottom-1 left-1 rounded-full bg-black/75 px-2 py-1 text-[10px] font-bold text-white">
                                                    全{gen.image_count}枚のうち代表1枚
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Caption preview */}
                                    {gen.caption && (
                                        <div className="text-sm text-gray-300 line-clamp-4 leading-relaxed whitespace-pre-wrap flex-1 mb-2">
                                            {gen.caption}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="p-4 bg-black/20 border-t border-white/5 flex gap-3 mt-auto">
                                    {gen.caption && (
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(gen.caption)}
                                            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-white/5 bg-white/5 py-2.5 text-xs font-bold text-gray-300 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a24]"
                                        >
                                            <Copy size={14} /> コピー
                                        </button>
                                    )}
                                    {gen.image_urls && gen.image_urls.length > 0 && (
                                        <a
                                            href={gen.image_urls[0]}
                                            download={`sns-agent24-asset-${gen.id.substring(0,6)}.jpg`}
                                            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-purple-500/20 bg-purple-600/20 py-2.5 text-xs font-bold text-purple-300 transition-all hover:bg-purple-600/40 hover:text-purple-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a24]"
                                        >
                                            <Download size={14} /> 保存
                                        </a>
                                    )}
                                </div>
                                </div>
                            ))}
                        </div>

                        {loadError && (
                            <div role="alert" className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                                {loadError}
                            </div>
                        )}

                        {hasMore && (
                            <div className="mt-8 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => loadGenerations({ offset: generations.length, append: true })}
                                    disabled={isLoadingMore}
                                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-7 py-3 text-sm font-bold text-white shadow-lg transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
                                >
                                    <RefreshCw size={16} className={isLoadingMore ? 'animate-spin' : ''} aria-hidden="true" />
                                    {isLoadingMore ? '次の履歴を読み込んでいます' : 'さらに8件表示'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
