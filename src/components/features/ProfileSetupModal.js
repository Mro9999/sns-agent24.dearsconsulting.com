"use client";
import React, { useState } from 'react';
import { Target, Briefcase, Zap, CheckCircle2 } from 'lucide-react';

export default function ProfileSetupModal({ isOpen, onClose, user }) {
    const [industry, setIndustry] = useState('');
    const [targetAudience, setTargetAudience] = useState('');
    const [usp, setUsp] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!industry || !targetAudience || !usp) {
            alert("すべての項目を入力してください。");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ industry, targetAudience, usp })
            });

            if (!res.ok) {
                throw new Error("プロフィールの保存に失敗しました。");
            }
            
            // Clerkのユーザーオブジェクトを再読み込みして最新のpublicMetadataを反映
            if (user?.reload) {
                await user.reload();
            }
            
            onClose();
        } catch (error) {
            console.error(error);
            alert("エラーが発生しました。");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
            <div className="bg-[#1a1a24] border border-purple-500/30 rounded-3xl w-full max-w-lg p-6 md:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
                
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold mb-2">あなたのビジネスを<br />教えてください</h2>
                    <p className="text-sm text-gray-400">
                        この情報を元に、AIがあなた「専用」の<br />プロンプトとコピーライティングを構築します。
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-300 mb-2">
                            <Briefcase size={16} className="text-purple-400" />
                            業界 / 業種
                        </label>
                        <input
                            type="text"
                            placeholder="例：東京都内の美容室、オンラインフィットネス 等"
                            value={industry}
                            onChange={(e) => setIndustry(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                            required
                        />
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-300 mb-2">
                            <Target size={16} className="text-pink-400" />
                            メインの顧客層（ターゲット）
                        </label>
                        <input
                            type="text"
                            placeholder="例：30代働く女性、近隣のファミリー層 等"
                            value={targetAudience}
                            onChange={(e) => setTargetAudience(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                            required
                        />
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-300 mb-2">
                            <Zap size={16} className="text-yellow-400" />
                            自社の強み / 競合との差別化ポイント
                        </label>
                        <textarea
                            placeholder="例：全席個室でリラックスできる、創業30年の実績 等"
                            value={usp}
                            onChange={(e) => setUsp(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors h-24 resize-none"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg disabled:opacity-50 mt-4"
                    >
                        {loading ? (
                            <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></span>
                        ) : (
                            <>
                                <CheckCircle2 size={20} />
                                保存してAIを最適化する
                            </>
                        )}
                    </button>
                    <p className="text-xs text-center text-gray-500 mt-3">※この設定は後からでも変更可能です。（ダッシュボード等で）</p>
                </form>
            </div>
        </div>
    );
}
