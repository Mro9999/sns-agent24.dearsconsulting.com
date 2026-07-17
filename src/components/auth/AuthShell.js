import Link from 'next/link';
import { ArrowLeft, Bot, CheckCircle2 } from 'lucide-react';

export default function AuthShell({ eyebrow, title, description, children }) {
    return (
        <main id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-br from-[#f8f9fa] via-[#fcfafb] to-[#f1f3f5] px-4 py-8 sm:py-12 focus:outline-none">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
                <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
                    <ArrowLeft size={16} aria-hidden="true" />
                    トップへ戻る
                </Link>

                <div className="grid items-start gap-8 lg:grid-cols-[1fr_440px] lg:gap-14">
                    <section className="pt-4 lg:pt-10">
                        <div className="mb-8 flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-rose-400 to-[#D4A373] text-white">
                                <Bot size={20} aria-hidden="true" />
                            </span>
                            <span className="text-xl font-bold tracking-wide text-slate-900">
                                SNS Agent<span className="bg-gradient-to-r from-rose-500 to-[#D4AF37] bg-clip-text text-transparent">24</span>
                            </span>
                        </div>

                        <p className="mb-3 text-sm font-bold tracking-wide text-rose-500">{eyebrow}</p>
                        <p className="max-w-xl text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">{title}</p>
                        <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">{description}</p>

                        <ul className="mt-8 space-y-3 text-sm font-medium text-slate-700">
                            <li className="flex items-center gap-2"><CheckCircle2 size={17} className="text-rose-500" aria-hidden="true" />クレジットカード登録は不要</li>
                            <li className="flex items-center gap-2"><CheckCircle2 size={17} className="text-rose-500" aria-hidden="true" />無料プランは1日3回まで生成可能</li>
                            <li className="flex items-center gap-2"><CheckCircle2 size={17} className="text-rose-500" aria-hidden="true" />入力した内容は次回も引き継げます</li>
                        </ul>
                    </section>

                    <section className="rounded-3xl border border-white bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.10)] backdrop-blur sm:p-7">
                        {children}
                    </section>
                </div>
            </div>
        </main>
    );
}
