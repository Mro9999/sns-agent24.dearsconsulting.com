import React from 'react';
import { Bot, Sparkles, PenTool, ImageIcon, Search, Zap, CheckCircle2, ArrowRight, Instagram, ChevronRight, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import PricingSection from '@/components/layout/PricingSection';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#111112] text-white font-sans selection:bg-purple-500/30 flex flex-col items-center">

            {/* Header / Nav */}
            <header className="w-full max-w-6xl mx-auto flex justify-between items-center px-6 py-6 border-b border-white/5 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center">
                        <Bot size={16} className="text-white" />
                    </div>
                    <span className="font-bold text-lg tracking-wider">SNS Agent<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">24</span></span>
                </div>
                <div className="flex gap-4">
                    <Link
                        href="/app"
                        className="px-5 py-2 rounded-full text-sm font-medium border border-white/20 hover:bg-white/5 transition-colors"
                    >
                        ログイン
                    </Link>
                    <Link
                        href="/app"
                        className="px-5 py-2 rounded-full text-sm font-bold bg-white text-black hover:bg-gray-200 transition-colors hidden sm:block"
                    >
                        今すぐ無料で試す
                    </Link>
                </div>
            </header>

            {/* Hero Section */}
            <section className="w-full max-w-6xl mx-auto px-6 pt-24 pb-32 flex flex-col items-center justify-center text-center relative overflow-hidden flex-1 w-full">
                {/* Background Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none"></div>

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm">
                    <Sparkles size={14} className="text-pink-400" />
                    <span className="text-xs font-medium text-gray-300 tracking-wide">最新Geminiモデル搭載の完全自動化エージェント</span>
                </div>

                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight drop-shadow-2xl">
                    AIが、あなたの<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400">
                        専属SNSマーケター
                    </span>
                    に。
                </h1>

                <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                    最新のトレンドリサーチから、ターゲットの深層心理を突くキャプション構築、
                    そしてオリジナル画像との完全自動合成まで。1分待つだけでプロの仕事が完了します。
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                    <Link
                        href="/app"
                        className="px-8 py-4 rounded-full text-base font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all shadow-[0_0_30px_rgba(147,51,234,0.3)] hover:shadow-[0_0_40px_rgba(147,51,234,0.5)] flex items-center justify-center gap-2"
                    >
                        無料で生成を始める
                        <ArrowRight size={18} />
                    </Link>
                </div>

                {/* Micro Features */}
                <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 mt-16 text-sm text-gray-500 font-medium">
                    <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-purple-500/80" /> クレジットカード不要</div>
                    <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-purple-500/80" /> 即日利用可能</div>
                    <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-purple-500/80" /> スマホ完結デザイン</div>
                </div>
            </section>

            {/* Value Proposition (3 Magic Features) */}
            <section className="w-full bg-black/40 border-y border-white/5 py-24 relative overflow-hidden flex flex-col items-center justify-center">
                <div className="w-full max-w-6xl mx-auto px-6 relative z-10 flex flex-col items-center justify-center">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">圧倒的な品質を生み出す<br />3つの魔法</h2>
                        <p className="text-gray-400">SNS運用に必要なすべてのクリエイティブをシームレスに統合</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl hover:bg-white/10 transition-colors group">
                            <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/30 group-hover:scale-110 transition-transform">
                                <Search className="text-purple-400" size={26} />
                            </div>
                            <h3 className="text-xl font-bold mb-3">リアルタイム検索＆<br />インサイト抽出</h3>
                            <p className="text-gray-400 leading-relaxed text-sm">
                                ターゲット市場の最新トレンドをGoogle検索でリアルタイム取得。表面的なAIポエムではなく、実データに基づいた刺さる切り口を提案します。
                            </p>
                        </div>
                        {/* Feature 2 */}
                        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl hover:bg-white/10 transition-colors group">
                            <div className="w-14 h-14 bg-pink-500/20 rounded-2xl flex items-center justify-center mb-6 border border-pink-500/30 group-hover:scale-110 transition-transform">
                                <PenTool className="text-pink-400" size={26} />
                            </div>
                            <h3 className="text-xl font-bold mb-3">プロ品質のコピー＆<br />台本生成</h3>
                            <p className="text-gray-400 leading-relaxed text-sm">
                                1枚構成、スワイプ必須の5枚カルーセル、TikTokやReels等のショート動画台本まで、用途に合わせて最適な文章フォーマットで出力します。
                            </p>
                        </div>
                        {/* Feature 3 */}
                        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl hover:bg-white/10 transition-colors group">
                            <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/30 group-hover:scale-110 transition-transform">
                                <ImageIcon className="text-indigo-400" size={26} />
                            </div>
                            <h3 className="text-xl font-bold mb-3">オリジナル画像の<br />完全自動デザイン合成</h3>
                            <p className="text-gray-400 leading-relaxed text-sm">
                                スマホにある写真をアップロードするだけで、AIが考案したコピーとブランドロゴを最適なバランスで自動配置。面倒なCanva等の操作は不要です。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Demonstration & Output Sample */}
            <section className="w-full max-w-6xl mx-auto px-6 py-24 relative">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">プロフェッショナルな出力結果</h2>
                    <p className="text-gray-400">わずか数項目の入力で、デザイン済みの画像と計算された文章が完成します。</p>
                </div>

                <div className="flex flex-col lg:flex-row items-center gap-12 bg-white/5 border border-white/10 rounded-3xl p-6 md:p-12">

                    {/* Image Mockup (Carousel style) */}
                    <div className="flex-1 w-full max-w-md relative flex justify-center">
                        <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-black">
                            {/* Dummy Image Background */}
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-black opacity-80 mix-blend-overlay"></div>
                            {/* Dummy Image Subject / Overlay */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-[url('https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center">
                                <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"></div>
                                <div className="relative z-10 w-full h-full border-2 border-white/80 p-6 flex flex-col justify-between items-center text-white">
                                    <div className="text-sm font-bold tracking-widest bg-white/20 px-4 py-1 rounded-full backdrop-blur-md">MARKETING TIPS</div>
                                    <h3 className="text-3xl font-extrabold leading-snug drop-shadow-lg">なぜ、あなたの<br />SNS投稿は<br /><span className="text-pink-400">読まれない</span>のか？</h3>
                                    <div className="text-sm border-t-2 border-pink-500 pt-2 w-1/2">Swipe to learn more →</div>
                                </div>
                            </div>

                            {/* UI Controls */}
                            <div className="absolute top-1/2 left-2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white/50"><ChevronLeft size={16} /></div>
                            <div className="absolute top-1/2 right-2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white/90 shadow-lg"><ChevronRight size={16} /></div>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-white/30"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-white/30"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-white/30"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-white/30"></div>
                            </div>
                        </div>
                    </div>

                    {/* Text / Caption Mockup */}
                    <div className="flex-1 w-full flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-pink-400 mb-2">
                            <Instagram size={20} />
                            <span className="font-bold">自動生成キャプション</span>
                        </div>
                        <div className="bg-black/50 border border-white/5 p-6 rounded-2xl text-sm md:text-base text-gray-300 leading-relaxed font-mono shadow-inner h-[400px] overflow-y-auto">
                            <p className="mb-4 text-white font-bold">【保存必須】SNSマーケティングの罠を回避する方法</p>
                            <p className="mb-4">一生懸命デザインした画像。でも、インサイトを見たら保存数は「0」…。そんな経験はありませんか？</p>
                            <p className="mb-4">実は、ターゲット層の深層心理で「今すぐ解決したい痛み」にアプローチできていないのが原因かもしれません。</p>
                            <p className="mb-4 text-pink-400">💡 本日のインサイト：</p>
                            <ul className="mb-4 pl-4 border-l-2 border-pink-500/50 space-y-2">
                                <li>・ユーザーの70%は最初の1枚で離脱する</li>
                                <li>・「有益な情報」ではなく「共感」を求めている</li>
                                <li>・保存を促す明確なCTAが欠けている</li>
                            </ul>
                            <p className="mb-4">これらを自動で分析し、最適な文脈で投稿を作成するのが『SNS Agent24』。もう悩む必要はありません。</p>
                            <p className="mb-4 text-gray-500">...<br />#SNS運用 #マーケティング #集客ノウハウ</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Section (Re-used Component) */}
            <div className="w-full mt-12 bg-black/30 border-y border-white/5 pt-16">
                <PricingSection />
            </div>

            {/* Footer CTA */}
            <section className="w-full bg-[#111112] py-32 flex flex-col items-center justify-center text-center px-6">
                <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(219,39,119,0.4)]">
                        <Zap size={36} className="text-white drop-shadow-md" />
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold mb-6">SNS運用を、次の次元へ。</h2>
                    <p className="text-xl text-gray-400 mb-10 w-full max-w-lg text-center">今すぐ無料アカウントを作成し、AIの手による革新的なクリエイティブを体験してください。</p>
                    <Link
                        href="/app"
                        className="inline-flex px-10 py-5 rounded-full text-lg font-bold bg-white text-black hover:bg-gray-200 transition-all hover:scale-105"
                    >
                        無料でログインして開始する
                    </Link>
                </div>
            </section>

            {/* Simple Footer */}
            <footer className="w-full border-t border-white/5 py-8 text-center text-sm text-gray-600">
                <p>© {new Date().getFullYear()} DEARS CONSULTING ALL RIGHTS RESERVED.</p>
            </footer>

        </div>
    );
}
