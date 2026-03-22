"use client";
import React, { useState } from 'react';
import { Check, Star, Zap, User, Building } from 'lucide-react';
import styles from './PricingSection.module.css';

export default function PricingSection({ onUpgrade, isPro }) {
    const [billingCycle, setBillingCycle] = useState('month'); // 'month' or 'year'

    const plans = [
        {
            name: "Free Plan",
            price: "¥0",
            period: "/ month",
            features: [
                "1日3回まで生成可能",
                "基本的なトレンドリサーチ",
                "Instagram / X / Facebook 対応",
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
            buttonText: isPro ? "ご契約内容の管理" : "Proにアップグレード",
            buttonStyle: isPro ? "current" : "primary",
            action: () => onUpgrade(billingCycle),
            isCurrentPlan: isPro
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

                    <div className="mt-8 mb-6 w-full max-w-4xl mx-auto px-2">
                        <h3 className="text-center text-lg md:text-xl font-bold mb-6 text-gray-200 tracking-wide">
                            なぜ <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 font-extrabold">SNS Agent24</span> が選ばれるのか？
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                            {/* 自作（DIY） */}
                            <div className="bg-[#1a1a24]/80 border border-white/10 rounded-2xl p-5 relative flex flex-col items-center">
                                <h4 className="text-gray-400 font-bold mb-4 flex items-center justify-center gap-2">
                                    <User size={20} /> 自社で運用する場合
                                </h4>
                                <div className="space-y-3 w-full text-sm">
                                    <div className="flex justify-between items-center bg-black/40 px-3 py-2.5 rounded-xl border border-white/5">
                                        <span className="text-gray-400">月額費用</span>
                                        <span className="text-yellow-400 font-bold">¥0</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-black/40 px-3 py-2.5 rounded-xl border border-white/5">
                                        <span className="text-gray-400">作業時間</span>
                                        <span className="text-red-400 font-bold">月間30時間〜</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-black/40 px-3 py-2.5 rounded-xl border border-white/5">
                                        <span className="text-gray-400">クオリティ</span>
                                        <span className="text-gray-300 font-bold">属人的で不安定</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-5 h-8 flex items-center justify-center text-center leading-relaxed">
                                    日々の通常業務を圧迫し<br />継続が困難になりがち
                                </p>
                            </div>

                            {/* 運用代行 */}
                            <div className="bg-[#1a1a24]/80 border border-white/10 rounded-2xl p-5 relative flex flex-col items-center">
                                <h4 className="text-gray-400 font-bold mb-4 flex items-center justify-center gap-2">
                                    <Building size={20} /> 一般的な運用代行
                                </h4>
                                <div className="space-y-3 w-full text-sm">
                                    <div className="flex justify-between items-center bg-black/40 px-3 py-2.5 rounded-xl border border-white/5">
                                        <span className="text-gray-400">月額費用</span>
                                        <span className="text-red-400 font-bold">月20〜50万円</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-black/40 px-3 py-2.5 rounded-xl border border-white/5">
                                        <span className="text-gray-400">作業時間</span>
                                        <span className="text-yellow-400 font-bold">月間 数時間</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-black/40 px-3 py-2.5 rounded-xl border border-white/5">
                                        <span className="text-gray-400">クオリティ</span>
                                        <span className="text-blue-300 font-bold">プロ水準</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-5 h-8 flex items-center justify-center text-center leading-relaxed">
                                    丸投げできるが、高額な<br />固定費が利益を圧迫する
                                </p>
                            </div>

                            {/* SNS Agent24 */}
                            <div className="bg-gradient-to-b from-purple-900/60 to-indigo-900/40 border-2 border-purple-500/50 rounded-2xl p-5 relative flex flex-col items-center shadow-[0_0_25px_rgba(147,51,234,0.2)] transform md:-translate-y-2 transition-transform">
                                <div className="absolute top-0 right-0 p-2">
                                    <span className="flex h-3 w-3 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
                                    </span>
                                </div>
                                <h4 className="text-purple-200 font-extrabold mb-4 flex items-center justify-center gap-2 text-lg">
                                    <Zap size={20} className="text-yellow-400" fill="currentColor" /> SNS Agent24
                                </h4>
                                <div className="space-y-3 w-full text-sm">
                                    <div className="flex justify-between items-center bg-black/20 px-3 py-2.5 rounded-xl border border-purple-500/30">
                                        <span className="text-purple-200">月額費用</span>
                                        <span className="text-yellow-400 font-extrabold text-base">月2,980円</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-black/20 px-3 py-2.5 rounded-xl border border-purple-500/30">
                                        <span className="text-purple-200">作業時間</span>
                                        <span className="text-cyan-300 font-extrabold text-base whitespace-nowrap">月間 約1〜2時間</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-black/20 px-3 py-2.5 rounded-xl border border-purple-500/30">
                                        <span className="text-purple-200">クオリティ</span>
                                        <span className="text-pink-400 font-extrabold text-base">最新AIによる最高水準</span>
                                    </div>
                                </div>
                                <p className="text-xs text-purple-200 mt-5 h-8 flex items-center justify-center text-center leading-relaxed font-bold">
                                    プロ同等の品質を維持しながら<br/>時間と資金をコア業務へ集中
                                </p>
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
                        <div key={index} className={`${styles.card} ${plan.name === 'Pro Plan' ? styles.proCard : ''} ${plan.isCurrentPlan ? styles.currentPlanCard : ''}`}>
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
            </div>
        </section>
    );
}
