import React from 'react';
import { Bot, Sparkles, PenTool, ImageIcon, Search, Zap, CheckCircle2, ArrowRight, Camera as Instagram, ChevronRight, ChevronLeft, Globe } from 'lucide-react';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import AccountPricingSection from '@/components/layout/AccountPricingSection';

export default async function LandingPage() {
    const { userId } = await auth();
    const isSignedIn = Boolean(userId);

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f8f9fa] via-[#fcfafb] to-[#f1f3f5] text-gray-900 font-sans selection:bg-rose-500/20 flex flex-col items-center relative overflow-hidden">

            {/* Header / Nav */}
            <header className="w-full max-w-6xl mx-auto flex justify-between items-center px-6 py-6 border-b border-white/5 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-400 to-[#D4A373] flex items-center justify-center">
                        <Bot size={16} className="text-white" />
                    </div>
                    <span className="font-bold text-lg tracking-wider text-gray-900">SNS Agent<span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-[#D4AF37]">24</span></span>
                </div>
                <nav aria-label="主要メニュー" className="flex gap-4">
                    {!isSignedIn && <>
                        <Link
                            href="/sign-in"
                            className="inline-flex min-h-11 items-center px-5 py-2 rounded-full text-sm font-medium border border-gray-200/50 hover:bg-white/90 border border-slate-200 shadow-sm text-slate-800 transition-colors text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                            ログイン
                        </Link>
                        <Link
                            href="/sign-up"
                            className="min-h-11 items-center px-5 py-2 rounded-full text-sm font-bold bg-white/80 backdrop-blur-2xl backdrop-blur border border-white shadow-lg text-gray-900 hover:bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-colors hidden sm:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                            AIに投稿を作らせてみる
                        </Link>
                    </>}
                    {isSignedIn && <>
                        <Link
                            href="/app"
                            className="inline-flex min-h-11 items-center px-5 py-2 rounded-full text-sm font-bold bg-white/90 border border-slate-200 shadow-sm text-slate-900 hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                            投稿を作る
                        </Link>
                        <Link
                            href="/dashboard"
                            className="min-h-11 items-center px-5 py-2 rounded-full text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors hidden sm:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                            履歴を見る
                        </Link>
                    </>}
                </nav>
            </header>

            <main id="main-content" tabIndex={-1} className="w-full focus:outline-none">

            {/* Hero Section */}
            <section className="w-full max-w-6xl mx-auto px-6 pt-24 pb-32 flex flex-col items-center justify-center text-center relative overflow-hidden flex-1 z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-rose-300/40 via-purple-300/30 to-orange-200/40 blur-[100px] rounded-full pointer-events-none -z-10"></div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-tight drop-shadow-sm text-gray-900">
                    <span className="inline-block">SNS投稿を、<span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-purple-400 to-[#D4A373]">もっと迷わず、</span></span><br />
                    <span className="inline-block">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-purple-400 to-[#D4A373]">
                            もっと続けやすく。
                        </span>
                    </span><br className="hidden md:block" />
                    <span className="inline-block text-3xl md:text-4xl lg:text-5xl mt-4 text-gray-700 font-bold">
                        企画・文章・画像を、ひとつの流れで。
                    </span>
                </h1>

                <p className="text-lg md:text-xl text-slate-800 max-w-2xl mx-auto mb-12 leading-relaxed">
                    <span className="inline-block">最新のトレンドリサーチから、</span><span className="inline-block">ターゲットに届く</span><span className="inline-block">キャプション構築、</span><br className="hidden md:block" />
                    <span className="inline-block">オリジナル画像の生成まで。</span><span className="inline-block">少ない入力で、</span><span className="inline-block">投稿案づくりをまとめて支援します。</span><br className="hidden md:block" />
                    <span className="inline-block">日々のSNS運用を、</span><span className="inline-block">無理なく続けるためのAIエージェントです。</span>
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                    {!isSignedIn && (
                        <Link
                            href="/sign-up"
                            className="px-6 py-4 md:px-8 md:py-5 rounded-full text-sm md:text-base font-bold bg-gradient-to-r from-rose-500 to-purple-600 text-white hover:from-rose-400 hover:to-purple-500 transition-all shadow-[0_4px_20px_rgba(244,63,94,0.3)] hover:shadow-[0_8px_30px_rgba(244,63,94,0.4)] hover:-translate-y-1 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                        >
                            無料で投稿案を1本つくる
                            <ArrowRight size={18} />
                        </Link>
                    )}
                    {isSignedIn && (
                        <Link
                            href="/app"
                            className="px-6 py-4 md:px-8 md:py-5 rounded-full text-sm md:text-base font-bold bg-gradient-to-r from-rose-500 to-purple-600 text-white hover:from-rose-400 hover:to-purple-500 transition-all shadow-[0_4px_20px_rgba(244,63,94,0.3)] hover:shadow-[0_8px_30px_rgba(244,63,94,0.4)] hover:-translate-y-1 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                        >
                            投稿を作る
                            <ArrowRight size={18} />
                        </Link>
                    )}
                </div>

                {/* Micro Features */}
                <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 mt-12 text-sm text-slate-600 font-medium">
                    <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-rose-400" /> クレジットカード登録不要</div>
                    <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-rose-400" /> 最初の入力は約60秒</div>
                    <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-rose-400" /> スマホ完結デザイン</div>
                </div>
            </section>

            {/* Developer Story (Who made it) */}
            <section className="w-full max-w-5xl mx-auto px-6 pb-16 pt-8 text-center">
                <div className="inline-block p-[1px] rounded-3xl bg-gradient-to-r from-rose-300/50 via-purple-300/50 to-orange-300/50 w-full relative overflow-hidden shadow-sm">
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-2xl"></div>
                    <div className="relative z-10 px-6 py-10 md:py-12 rounded-3xl">
                        <p className="text-lg md:text-2xl font-bold mb-4 text-gray-900">
                            30年間の事業・コンサルティング実績から生まれた、<span className="text-rose-500">現場のための結論</span>。
                        </p>
                        <p className="text-sm md:text-base text-slate-800 leading-relaxed max-w-3xl mx-auto">
                            <span className="inline-block">私たち「DEARS CONSULTING」は、</span><span className="inline-block">数多くの中小企業の</span><span className="inline-block">マーケティングを支援する中で、</span><span className="inline-block">SNS運用の「外注費の無駄」と</span><span className="inline-block">「現場の疲弊」というリアルな痛みに直面してきました。</span><br className="hidden md:block" />
                            <span className="inline-block">このツールは、</span><span className="inline-block">自分たちのクライアントを</span><span className="inline-block">本気で勝たせるために自社開発した</span><span className="inline-block">「完全自動の専属エージェント」です。</span>
                        </p>
                    </div>
                </div>
            </section>

            {/* Value Proposition (3 Magic Features) */}
            <section className="w-full bg-transparent border-y border-gray-200 py-24 relative overflow-hidden flex flex-col items-center justify-center">
                <div className="w-full max-w-6xl mx-auto px-6 relative z-10 flex flex-col items-center justify-center">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">投稿案づくりを支える<br />3つの機能</h2>
                        <p className="text-slate-600">SNS運用に必要なすべてのクリエイティブをシームレスに統合</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="bg-white/80 backdrop-blur-2xl backdrop-blur-md border border-white shadow-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 rounded-3xl hover:bg-white/80 hover:-translate-y-1 hover:shadow-lg transition-all group">
                            <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mb-6 border border-rose-200 group-hover:scale-110 transition-transform">
                                <Search className="text-rose-500" size={26} />
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-gray-900">いまの関心を調べて<br />投稿の切り口を提案</h3>
                            <p className="text-slate-800 leading-relaxed text-sm">
                                ターゲット市場の最新トレンドをGoogle検索で調査。事業情報と公開情報をもとに、投稿で扱うテーマや伝え方の候補を提案します。
                            </p>
                        </div>
                        {/* Feature 2 */}
                        <div className="bg-white/80 backdrop-blur-2xl backdrop-blur-md border border-white shadow-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 rounded-3xl hover:bg-white/80 hover:-translate-y-1 hover:shadow-lg transition-all group">
                            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-6 border border-purple-200 group-hover:scale-110 transition-transform">
                                <PenTool className="text-purple-500" size={26} />
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-gray-900">用途に合わせた<br />投稿フォーマット</h3>
                            <p className="text-slate-800 leading-relaxed text-sm">
                                1枚投稿、5枚カルーセル、ショート動画台本まで、用途に合わせた形式で出力。読者に次の行動を案内する文章までまとめて作成します。
                            </p>
                        </div>
                        {/* Feature 3 */}
                        <div className="bg-white/80 backdrop-blur-2xl backdrop-blur-md border border-white shadow-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 rounded-3xl hover:bg-white/80 hover:-translate-y-1 hover:shadow-lg transition-all group">
                            <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mb-6 border border-orange-200 group-hover:scale-110 transition-transform">
                                <ImageIcon className="text-orange-500" size={26} />
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-gray-900">画像がなくても<br />投稿素材まで作成</h3>
                            <p className="text-slate-800 leading-relaxed text-sm">
                                写真を用意できないときは、投稿内容に合わせた背景画像をAIで生成。読みやすさに配慮した文字入り画像として仕上げます。
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Demonstration & Output Sample */}
            <section className="w-full max-w-6xl mx-auto px-6 py-24 relative">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">生成される投稿のサンプル</h2>
                    <p className="text-slate-600">「例えばこんな感じで出力されます」<br />わずか数項目の入力で、このようなデザイン済みの画像と計算された文章が完成します。</p>
                </div>

                <div className="flex flex-col lg:flex-row items-center gap-12 bg-white/80 backdrop-blur-2xl backdrop-blur-md border border-white shadow-lg shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-3xl p-6 md:p-12">

                    {/* Image Mockup (Carousel style) */}
                    <div className="flex-1 w-full max-w-md relative flex justify-center">
                        <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-gray-50">
                            {/* Dummy Image Background */}
                            <div className="absolute inset-0 bg-gradient-to-br from-stone-500/20 to-black/30 opacity-60 mix-blend-overlay"></div>
                            {/* Dummy Image Subject / Overlay */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-[url('https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center">
                                <div className="absolute inset-0 bg-gray-900/10 backdrop-blur-sm"></div>
                                <div className="relative z-10 w-full h-full border border-white shadow-lg/60 bg-white/90 border border-slate-200 shadow-sm text-slate-800 backdrop-blur-md p-6 flex flex-col justify-between items-center text-gray-900 rounded-xl shadow-sm">
                                    <div className="text-sm font-bold tracking-widest bg-white/20 px-4 py-1 rounded-full backdrop-blur-md">MARKETING TIPS</div>
                                    <h3 className="text-2xl sm:text-3xl font-extrabold leading-snug drop-shadow-lg px-2">なぜ、あなたの<br />SNS投稿は<br /><span className="inline-block"><span className="text-pink-400">読まれない</span>のか？</span></h3>
                                    <div className="text-xs sm:text-sm border-t-2 border-pink-500 pt-2 w-1/2">Swipe to learn more →</div>
                                </div>
                            </div>

                            {/* UI Controls */}
                            <div className="absolute top-1/2 left-2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-slate-800 shadow-md"><ChevronLeft size={16} /></div>
                            <div className="absolute top-1/2 right-2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-gray-800 shadow-md"><ChevronRight size={16} /></div>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300/50"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300/50"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300/50"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300/50"></div>
                            </div>
                        </div>
                    </div>

                    {/* Text / Caption Mockup */}
                    <div className="flex-1 w-full flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-rose-500 mb-2">
                            <Instagram size={20} />
                            <span className="font-bold">自動生成キャプション</span>
                        </div>
                        <div className="bg-white/80 backdrop-blur-xl border border-white shadow-lg p-6 rounded-2xl text-sm md:text-base text-gray-700 leading-relaxed font-mono shadow-sm h-[400px] overflow-y-auto">
                            <p className="mb-4 text-gray-900 font-bold">【保存必須】SNSマーケティングの罠を回避する方法</p>
                            <p className="mb-4">一生懸命デザインした画像。でも、インサイトを見たら保存数は「0」…。そんな経験はありませんか？</p>
                            <p className="mb-4">実は、ターゲット層の深層心理で「今すぐ解決したい痛み」にアプローチできていないのが原因かもしれません。</p>
                            <p className="mb-4 text-rose-500 font-bold">【本日のインサイト（気付き）】</p>
                            <ul className="mb-4 pl-4 border-l-2 border-rose-300 space-y-2">
                                <li>・最初の1枚で続きを見たくなる理由をつくる</li>
                                <li>・「有益な情報」ではなく「共感」を求めている</li>
                                <li>・保存を促す明確なCTA（行動喚起）が欠けている</li>
                            </ul>
                            <p className="mb-4">これらの観点を整理し、投稿案づくりを支えるのが『SNS Agent24』。最後は内容を確認して、そのまま活用できます。</p>
                            <p className="mb-4 text-slate-700 font-medium">...<br />#SNS運用 #マーケティング #集客ノウハウ</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Section (Re-used Component) */}
            <div className="w-full mt-12 bg-white/90 border border-slate-200 shadow-sm text-slate-800 backdrop-blur-md border-y border-gray-200/60 pt-16">
                <AccountPricingSection />
            </div>

            {/* Footer CTA */}
            <section className="w-full bg-transparent py-32 flex flex-col items-center justify-center text-center px-6">
                <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-[#D4A373] rounded-full mx-auto flex items-center justify-center mb-8 shadow-[0_10px_30px_rgba(244,63,94,0.3)]">
                        <Zap size={36} className="text-white drop-shadow-md" />
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900"><span className="inline-block">次の投稿づくりを、</span><span className="inline-block">ここから始めましょう。</span></h2>
                    <p className="text-xl text-slate-800 mb-10 w-full max-w-lg text-center">無料アカウントで、企画・文章・画像づくりを1本から試せます。</p>
                    {!isSignedIn && (
                        <Link
                            href="/sign-in"
                            className="inline-flex min-h-11 items-center px-10 py-5 rounded-full text-lg font-bold bg-gray-900 text-white shadow-xl hover:shadow-2xl hover:bg-black hover:-translate-y-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                        >
                            無料でログインして開始する
                        </Link>
                    )}
                    {isSignedIn && (
                        <Link
                            href="/app"
                            className="inline-flex min-h-11 items-center px-10 py-5 rounded-full text-lg font-bold bg-gray-900 text-white shadow-xl hover:shadow-2xl hover:bg-black hover:-translate-y-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                        >
                            投稿を作る
                        </Link>
                    )}
                </div>
            </section>

            </main>

            {/* Footer */}
            <footer className="w-full border-t border-gray-200/60 py-12 px-6 flex flex-col items-center justify-center text-center text-sm text-slate-700 font-medium">
                <Link href="https://dearsconsulting.com" target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 mb-2 px-2 hover:text-rose-500 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg">
                    <Globe size={16} className="text-slate-700 font-medium group-hover:text-rose-400 transition-colors" />
                    <span className="font-bold tracking-widest text-slate-600 group-hover:text-rose-500 transition-colors">DEARS CONSULTING</span>
                </Link>
                <div className="flex gap-4 mb-6">
                    <Link href="https://dearsconsulting.com/sns-agent24/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center px-2 hover:text-rose-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg">About SNS Agent24</Link>
                    <span aria-hidden="true" className="self-center">|</span>
                    <Link href="https://dearsconsulting.com/otoiawase/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center px-2 hover:text-rose-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg">Contact</Link>
                </div>
                <p>&copy; {new Date().getFullYear()} DEARS CONSULTING ALL RIGHTS RESERVED.</p>
            </footer>

        </div>
    );
}
