"use client";
import React, { useState } from 'react';
import { Check, Star, Zap, User, Building, Calendar, Mail, MousePointer, Rocket, Sparkles, X, AlertTriangle, TrendingDown, Crown } from 'lucide-react';
import styles from './PricingSection.module.css';
import ProMaxInquiryModal from '@/components/ProMaxInquiryModal';

export default function PricingSection({ onUpgrade, isPro, isProMax }) {
    const [billingCycle, setBillingCycle] = useState('month'); // 'month' or 'year'
    const [inquiryOpen, setInquiryOpen] = useState(false);

    const plans = [
        {
            name: "Free Plan",
            price: "¥0",
            period: "/ month",
            features: [
                "1日3回まで生成可能",
                "基本的なトレンドリサーチ",
                "Instagram 対応",
                "広告なし",
                "商用利用不可（個人利用・お試しのみ）"
            ],
            buttonText: isPro ? "フリープラン" : "現在のプラン",
            buttonStyle: isPro ? "secondary" : "current",
            disabled: true,
            isCurrentPlan: !isPro
        },
        {
            name: "Pro Plan",
            price: billingCycle === 'year' ? "¥29,800" : "¥2,980",
            period: billingCycle === 'year' ? "/ year" : "/ month",
            subtext: billingCycle === 'year' ? "（月あたり約 ¥2,483）" : null,
            badge: billingCycle === 'year' ? "2ヶ月分お得！" : "人気 No.1",
            features: [
                "無制限に生成可能",
                "「富裕層向け」など高度なリサーチ",
                "多言語対応（英語・中国語・韓国語）",
                "優先サポート",
                "新機能への早期アクセス",
                "商用利用完全OK"
            ],
            buttonText: (isPro && !isProMax) ? "ご契約内容の管理" : isProMax ? "現在のプラン" : "Proにアップグレード",
            buttonStyle: (isPro && !isProMax) ? "current" : isProMax ? "secondary" : "primary",
            action: () => onUpgrade ? onUpgrade(billingCycle, 'pro') : window.location.href = '/app',
            isCurrentPlan: isPro && !isProMax
        },
        {
            name: "Pro Max Plan",
            price: billingCycle === 'year' ? "¥298,000" : "¥29,800",
            period: billingCycle === 'year' ? "/ year" : "/ month",
            subtext: billingCycle === 'year' ? "（月あたり約 ¥24,833）" : "※個別相談制（カスタム設定が必要なため）",
            badge: "エンタープライズ",
            features: [
                "Pro Planの全機能",
                "週次AI全自動スケジュール構築",
                "事業特性に合わせたオーダーメイド初期設定",
                "生成結果を承認メールで確認",
                "ワンクリック承認で1週間の投稿が確定",
                "毎日決まった時刻にInstagram自動投稿",
                "承認忘れ時も自動で投稿継続",
                "専任担当によるオンボーディング",
                "優先度最上位のプレミアムサポート"
            ],
            buttonText: isProMax ? "ご契約内容の管理" : "個別相談を申し込む",
            buttonStyle: isProMax ? "current" : "primary",
            action: () => {
                if (isProMax && onUpgrade) {
                    onUpgrade(billingCycle, 'promax');
                } else {
                    setInquiryOpen(true);
                }
            },
            isCurrentPlan: isProMax
        }
    ];

    return (
        <section className={styles.pricingSection}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Plan</h2>
                    <p className={styles.subtitle}>
                        ビジネスの規模に合わせて選べる2つのプラン。<br />
                        いつでも解約可能です。
                    </p>

                    <div className="mt-8 mb-6 w-full max-w-5xl mx-auto px-2">
                        <h3 className="text-center text-lg md:text-xl font-bold mb-8 text-gray-900 tracking-wide">
                            なぜ <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-[#D4A373] font-extrabold">SNS Agent24</span> が選ばれるのか？
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 items-stretch">

                            {/* ① 自社運用（課題アリ: グレーで沈めて「×」感を出す） */}
                            <div className="relative bg-gray-100/70 border border-gray-200 rounded-2xl p-5 flex flex-col opacity-90">
                                <div className="absolute -top-3 left-5 bg-gray-400 text-white text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wider">
                                    課題あり
                                </div>
                                <h4 className="text-gray-600 font-bold mb-4 flex items-center gap-2 pt-2">
                                    <User size={18} className="text-gray-500" /> 自社で運用する場合
                                </h4>
                                <div className="space-y-2 w-full text-sm flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                            <Check size={12} className="text-gray-500" />
                                        </span>
                                        <span className="text-gray-600">月額費用 <span className="font-bold text-gray-700">¥0</span></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                                            <X size={12} className="text-rose-500" />
                                        </span>
                                        <span className="text-gray-600">作業時間 <span className="font-bold text-rose-600">月30時間〜</span></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                                            <X size={12} className="text-rose-500" />
                                        </span>
                                        <span className="text-gray-600">品質 <span className="font-bold text-gray-700">属人的で不安定</span></span>
                                    </div>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-4 pt-4 border-t border-gray-200 leading-relaxed">
                                    通常業務を圧迫し、継続が困難になりがち
                                </p>
                            </div>

                            {/* ② 運用代行（高コスト: ニュートラル白で「△」） */}
                            <div className="relative bg-white border border-gray-200 rounded-2xl p-5 flex flex-col shadow-sm">
                                <div className="absolute -top-3 left-5 bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wider">
                                    高コスト
                                </div>
                                <h4 className="text-gray-700 font-bold mb-4 flex items-center gap-2 pt-2">
                                    <Building size={18} className="text-gray-600" /> 一般的な運用代行
                                </h4>
                                <div className="space-y-2 w-full text-sm flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                                            <X size={12} className="text-rose-500" />
                                        </span>
                                        <span className="text-gray-700">月額費用 <span className="font-bold text-rose-600">月20〜50万円</span></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                            <Check size={12} className="text-green-600" />
                                        </span>
                                        <span className="text-gray-700">作業時間 <span className="font-bold text-gray-800">月 数時間</span></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                            <Check size={12} className="text-green-600" />
                                        </span>
                                        <span className="text-gray-700">品質 <span className="font-bold text-gray-800">プロ水準</span></span>
                                    </div>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-4 pt-4 border-t border-gray-100 leading-relaxed">
                                    丸投げできるが、高額な固定費が利益を圧迫
                                </p>
                            </div>

                            {/* ③ SNS Agent24（最適解: 強いグラデーション＋拡大＋推奨バッジ） */}
                            <div className="relative md:-my-4 md:scale-[1.04]">
                                {/* 光彩 */}
                                <div className="absolute -inset-2 bg-gradient-to-br from-rose-400 via-pink-400 to-[#D4A373] rounded-3xl opacity-40 blur-xl"></div>
                                {/* カード本体 */}
                                <div className="relative bg-gradient-to-br from-rose-500 via-rose-400 to-[#D4A373] rounded-2xl p-[2px] shadow-2xl shadow-rose-500/30">
                                    <div className="bg-gradient-to-br from-white to-rose-50 rounded-2xl p-5 flex flex-col h-full">
                                        {/* BESTバッジ */}
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-rose-500 to-[#D4A373] text-white text-[10px] font-black px-3 py-1 rounded-full tracking-[0.2em] shadow-md flex items-center gap-1">
                                            <Crown size={12} className="text-yellow-300" fill="currentColor" />
                                            BEST CHOICE
                                        </div>
                                        <h4 className="text-lg md:text-xl font-black mb-4 flex items-center gap-2 pt-2 text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-[#D4A373]">
                                            <Zap size={22} className="text-rose-500" fill="currentColor" />
                                            SNS Agent24
                                        </h4>
                                        <div className="space-y-2 w-full text-sm flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                                                    <Check size={12} className="text-white" strokeWidth={3} />
                                                </span>
                                                <span className="text-gray-800">月額費用 <span className="font-black text-rose-600 text-base">{billingCycle === 'year' ? '月2,483円' : '月2,980円'}</span></span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                                                    <Check size={12} className="text-white" strokeWidth={3} />
                                                </span>
                                                <span className="text-gray-800">作業時間 <span className="font-black text-green-600">月1〜2時間</span></span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                                                    <Check size={12} className="text-white" strokeWidth={3} />
                                                </span>
                                                <span className="text-gray-800">品質 <span className="font-black text-gray-900">最新AI最高水準</span></span>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-gray-700 font-medium mt-4 pt-4 border-t border-rose-200 leading-relaxed">
                                            プロ同等の品質を維持しながら<br />時間と資金をコア業務へ集中
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Billing Cycle Toggle */}
                    <div className={styles.toggleContainer}>
                        <span className={`${styles.toggleLabel} ${billingCycle === 'month' ? styles.active : ''}`}>月払い</span>
                        <div
                            className={`${styles.toggleSwitch} ${billingCycle === 'year' ? styles.yearActive : ''}`}
                            onClick={() => setBillingCycle(billingCycle === 'month' ? 'year' : 'month')}
                        >
                            <div className={styles.toggleThumb} />
                        </div>
                        <span className={`${styles.toggleLabel} ${billingCycle === 'year' ? styles.active : ''}`}>年払い</span>
                        <span className={styles.discountBadge}>2ヶ月分無料</span>
                    </div>
                </div>

                <div className={styles.grid}>
                    {plans.map((plan, index) => (
                        <div key={index} className={`${styles.card} ${plan.name === 'Pro Max Plan' ? styles.proCard : ''} ${plan.isCurrentPlan ? styles.currentPlanCard : ''}`}>
                            {plan.isCurrentPlan && <div className={styles.currentBadge}>現在のプラン</div>}
                            {!plan.isCurrentPlan && plan.badge && <div className={styles.badge}>{plan.badge}</div>}
                            <h3 className={styles.planName}>{plan.name}</h3>
                            <div className={styles.priceContainer}>
                                <span className={styles.price}>{plan.price}</span>
                                <span className={styles.period}>{plan.period}</span>
                            </div>
                            {plan.subtext && <div className={styles.subtext}>{plan.subtext}</div>}

                            <ul className={styles.features}>
                                {plan.features.map((feature, i) => (
                                    <li key={i} className={styles.featureItem}>
                                        <Check size={18} className={styles.checkIcon} />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <button
                                type="button"
                                className={`${styles.button} ${styles[plan.buttonStyle]}`}
                                onClick={plan.action}
                                disabled={plan.disabled}
                            >
                                {plan.buttonText}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Pro Max Planのシグネチャ機能である「AI全自動スケジュール構築」の流れを視覚的に説明
                    サービス初見のユーザーにも「ここまで手が届くのか」を瞬時に伝えるセクション */}
                <div className="mt-20 w-full max-w-5xl mx-auto px-2">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-[#D4A373] text-white text-xs font-bold px-4 py-1.5 rounded-full mb-4">
                            <Sparkles size={14} /> Pro Max 専用機能
                        </div>
                        <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                            AI全自動スケジュール構築の流れ
                        </h3>
                        <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                            SNSの運用はAIに任せて、あなたはコア業務へ。<br className="hidden md:inline" />
                            <span className="font-semibold text-gray-800">「週に1回、メールを開いてOKボタンを押すだけ」</span>で1週間分の投稿が完成します。
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5 relative">
                        {/* Step 1 */}
                        <div className="bg-white/70 backdrop-blur-xl border border-white shadow-sm rounded-2xl p-5 relative flex flex-col items-center text-center">
                            <div className="absolute -top-3 -left-3 bg-gradient-to-br from-rose-500 to-[#D4A373] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md">1</div>
                            <div className="w-12 h-12 bg-gradient-to-br from-rose-100 to-rose-200 rounded-full flex items-center justify-center mb-3">
                                <Calendar size={22} className="text-rose-600" />
                            </div>
                            <h4 className="font-bold text-gray-900 mb-2 text-sm md:text-base">毎週日曜 20:00</h4>
                            <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                                AIがあなたの事業プロフィールから<br />
                                <span className="font-semibold text-gray-800">1週間分（7投稿）を自動生成</span>
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className="bg-white/70 backdrop-blur-xl border border-white shadow-sm rounded-2xl p-5 relative flex flex-col items-center text-center">
                            <div className="absolute -top-3 -left-3 bg-gradient-to-br from-rose-500 to-[#D4A373] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md">2</div>
                            <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center mb-3">
                                <Mail size={22} className="text-amber-600" />
                            </div>
                            <h4 className="font-bold text-gray-900 mb-2 text-sm md:text-base">承認メール到着</h4>
                            <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                                確認用リンクつきのメールが届く。<br />
                                <span className="font-semibold text-gray-800">画像と文面のプレビューを確認</span>
                            </p>
                        </div>

                        {/* Step 3 */}
                        <div className="bg-white/70 backdrop-blur-xl border border-white shadow-sm rounded-2xl p-5 relative flex flex-col items-center text-center">
                            <div className="absolute -top-3 -left-3 bg-gradient-to-br from-rose-500 to-[#D4A373] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md">3</div>
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center mb-3">
                                <MousePointer size={22} className="text-purple-600" />
                            </div>
                            <h4 className="font-bold text-gray-900 mb-2 text-sm md:text-base">ワンクリック承認</h4>
                            <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                                気に入った投稿を承認。不要なものは却下。<br />
                                <span className="font-semibold text-gray-800">所要時間はわずか数分</span>
                            </p>
                        </div>

                        {/* Step 4 */}
                        <div className="bg-gradient-to-b from-rose-500 to-[#D4A373] p-[1px] rounded-2xl relative">
                            <div className="bg-white/90 backdrop-blur-xl border border-white/50 h-full rounded-2xl p-5 relative flex flex-col items-center text-center">
                                <div className="absolute -top-3 -left-3 bg-gradient-to-br from-rose-500 to-[#D4A373] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md">4</div>
                                <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-[#D4A373] rounded-full flex items-center justify-center mb-3 shadow-md">
                                    <Rocket size={22} className="text-white" />
                                </div>
                                <h4 className="font-bold text-gray-900 mb-2 text-sm md:text-base">毎日12:00 自動投稿</h4>
                                <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                                    承認された投稿を<br />
                                    <span className="font-semibold text-gray-800">予約時刻通りにInstagramへ自動配信</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 補足ポイント */}
                    <div className="mt-8 bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-100 rounded-2xl p-5 md:p-6">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                                <Zap size={16} className="text-rose-500" fill="currentColor" />
                            </div>
                            <div className="text-sm text-gray-700 leading-relaxed">
                                <p className="font-bold text-gray-900 mb-2">完全放置でもOK。承認忘れフォロー機能つき</p>
                                <p>
                                    万が一、承認期限（予約時刻）までに確認ができなかった場合も、<span className="font-semibold">投稿は自動的に承認扱いとなって配信されます</span>。
                                    忙しい週でも、SNSの更新が途切れる心配はありません。却下したい投稿だけ期限内にチェックしておけば十分です。
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 個別相談制の案内 */}
                    <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-5 md:p-6 text-center">
                        <p className="text-sm text-gray-700 leading-relaxed">
                            <span className="font-bold text-gray-900">Pro Max Plan は個別相談制です。</span><br />
                            お客様の事業特性・ブランドガイドライン・ターゲット層に合わせたオーダーメイド設定を<br className="hidden md:inline" />
                            専任担当が行った上で、ご契約・ご利用開始となります。
                        </p>
                        <button
                            type="button"
                            onClick={() => setInquiryOpen(true)}
                            className="mt-5 inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-full text-sm font-bold hover:bg-gray-800 transition-colors"
                        >
                            <Sparkles size={16} /> 個別相談を申し込む
                        </button>
                    </div>
                </div>
            </div>
            <ProMaxInquiryModal isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} />
        </section>
    );
}
