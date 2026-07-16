"use client";
import React, { useState, useEffect } from 'react';
import { useUser, UserButton } from "@clerk/nextjs";
import { ChevronLeft, Database, Clock, Copy, Download, Image as ImageIcon, Video, Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
    const { user, isLoaded, isSignedIn } = useUser();
    const [generations, setGenerations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isLoaded && isSignedIn) {
            fetch('/api/generations')
                .then(res => res.json())
                .then(data => {
                    setGenerations(data);
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error("Error fetching history:", err);
                    setIsLoading(false);
                });
        } else if (isLoaded && !isSignedIn) {
            // Not signed in
            setIsLoading(false);
        }
    }, [isLoaded, isSignedIn]);

    if (!isLoaded || (isLoaded && !isSignedIn)) {
        return (
            <div className="min-h-screen bg-[#111112] flex flex-col items-center justify-center text-white">
                {!isLoaded ? (
                    <div className="animate-spin border-4 border-purple-500 border-t-transparent rounded-full w-12 h-12 mb-4"></div>
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

    // 計算
    const totalGenerations = generations.length;
    // 1投稿あたり約2時間を節約したと仮定（ゲーミフィケーション要素）
    const savedHours = totalGenerations * 2;

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('コピーしました！');
    };

    return (
        <div className="min-h-screen bg-[#111112] text-white font-sans selection:bg-purple-500/30">
            {/* Header */}
            <header className="w-full flex justify-between items-center px-6 py-4 bg-black/30 border-b border-white/5 sticky top-0 z-50 backdrop-blur-md">
                <Link href="/app" className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors">
                    <ChevronLeft size={20} /> <span className="text-sm font-bold">作成ツールに戻る</span>
                </Link>
                <div className="flex items-center gap-4">
                    <UserButton afterSignOutUrl="/" />
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8">
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
                        <h3 className="text-indigo-300 text-sm font-bold mb-1 flex items-center gap-2"><ImageIcon size={16} /> 累計生成コンテンツ数</h3>
                        <div className="flex items-baseline gap-2 relative z-10">
                            <span className="text-5xl font-extrabold text-white">{totalGenerations}</span>
                            <span className="text-indigo-400 font-bold">件</span>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-pink-900/30 to-orange-900/10 border border-pink-500/20 rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-pink-500/20"></div>
                        <h3 className="text-pink-300 text-sm font-bold mb-1 flex items-center gap-2"><Clock size={16} /> AIが節約した業務時間</h3>
                        <div className="flex items-baseline gap-2 relative z-10">
                            <span className="text-5xl font-extrabold text-white">{savedHours}</span>
                            <span className="text-pink-400 font-bold">時間</span>
                        </div>
                        <p className="text-xs text-pink-500/70 mt-2 relative z-10">※1投稿あたり2時間の作成業務として換算</p>
                    </div>
                </div>

                {/* 履歴リスト */}
                <h2 className="text-xl font-bold mb-6 text-gray-200 border-b border-white/10 pb-4">過去の生成履歴</h2>

                {isLoading ? (
                    <div className="flex justify-center items-center py-32">
                        <div className="animate-spin border-4 border-purple-500 border-t-transparent rounded-full w-12 h-12"></div>
                    </div>
                ) : generations.length === 0 ? (
                    <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/5 animate-in zoom-in duration-500">
                        <Database size={48} className="text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-300 mb-2">まだ履歴がありません</h3>
                        <p className="text-gray-500 text-sm mb-6">最初の投稿を生成して、SNS資産を積み上げましょう！</p>
                        <Link href="/app" className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-8 py-4 rounded-full font-bold transition-all shadow-lg hover:shadow-purple-500/25">
                            投稿を作成する <ArrowRight size={18} />
                        </Link>
                    </div>
                ) : (
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
                                        <div className="mb-4 flex gap-2 overflow-x-auto pb-3 snap-x scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                            {gen.image_urls.map((url, idx) => (
                                                <img
                                                    key={idx}
                                                    src={url}
                                                    alt="Generated asset"
                                                    className="w-24 h-24 object-cover rounded-lg border border-white/10 snap-center shrink-0 shadow-md"
                                                />
                                            ))}
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
                                            onClick={() => copyToClipboard(gen.caption)}
                                            className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all border border-white/5"
                                        >
                                            <Copy size={14} /> コピー
                                        </button>
                                    )}
                                    {gen.image_urls && gen.image_urls.length > 0 && (
                                        <a
                                            href={gen.image_urls[0]}
                                            download={`sns-agent24-asset-${gen.id.substring(0,6)}.jpg`}
                                            className="flex-1 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 hover:text-purple-200 text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all border border-purple-500/20"
                                        >
                                            <Download size={14} /> 保存
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
