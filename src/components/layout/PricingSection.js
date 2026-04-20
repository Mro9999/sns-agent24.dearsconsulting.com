"use client";
import React, { useState } from 'react';
import { Check, Star, Zap, User, Building } from 'lucide-react';
import styles from './PricingSection.module.css';

export default function PricingSection({ onUpgrade, isPro, isProMax }) {
    const [billingCycle, setBillingCycle] = useState('month'); // 'month' or 'year'

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
            subtext: billingCycle === 'year' ? "（月あたり約 ¥24,833）" : null,
            badge: "エンタープライズ",
            features: [
                "Pro Planの全機能",
                "1週間分の全自動スケジュール構築",
                "外部システム連携（Webhook等）",
                "専任担当によるオンボーディング",
                "優先度最上位のプレミアムサポート"
            ],
            buttonText: isProMax ? "ご契約内容の管理" : "Pro Maxにアップグレード",
            buttonStyle: isProMax ? "current" : "primary",
            action: () => onUpgrade ? onUpgrade(billingCycle, 'promax') : window.location.href = '/app',
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

                    <div className="mt-8 mb-6 w-full max-w-4xl mx-auto px-2">
                        <h3 className="text-center text-lg md:text-xl font-bold mb-6 text-gray-900 tracking-wide">
                            なぜ <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-[#D4A373] font-extrabold">SNS Agent24</span> が選ばれるのか？
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                            {/* 自作（DIY） */}
                            <div className="bg-white/60 backdrop-blur-xl border-white shadow-sm rounded-2xl p-5 relative flex flex-col items-center">
                                <h4 className="text-gray-700 font-semibold font-bold mb-4 flex items-center justify-center gap-2">
                                    <User size={20} /> 自社で運用する場合
                                </h4>
                                <div className="space-y-3 w-full text-sm">
                                    <div className="flex justify-between items-center bg-white/50 border border-white/80 px-3 py-2.5 rounded-xl border border-white">
                                        <span className="text-gray-700 font-semibold">月額費用</span>
                                        <span className="text-gray-900 font-bold">¥0</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-white/50 border border-white/80 px-3 py-2.5 rounded-xl border border-white">
                                        <span className="text-gray-700 font-semibold">作業時間</span>
                                        <span className="text-rose-600 font-bold">月間30時間〜</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-white/50 border border-white/80 px-3 py-2.5 rounded-xl border border-white">
                                        <span className="text-gray-700 font-semibold">クオリティ</span>
                                        <span className="text-gray-800 font-bold">属人的で不安定</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-5 h-8 flex items-center justify-center text-center leading-relaxed">
                                    日々の通常業務を圧迫し<br />継続が困難になりがち
                                </p>
                            </div>

                            {/* 運用代行 */}
                            <div className="bg-white/60 backdrop-blur-xl border-white shadow-sm rounded-2xl p-5 relative flex flex-col items-center">
                                <h4 className="text-gray-700 font-semibold font-bold mb-4 flex items-center justify-center gap-2">
                                    <Building size={20} /> 一般的な運用代行
                                </h4>
                                <div className="space-y-3 w-full text-sm">
                                    <div className="flex justify-between items-center bg-white/50 border border-white/80 px-3 py-2.5 rounded-xl border border-white">
                                        <span className="text-gray-700 font-semibold">月額費用</span>
                                        <span className="text-rose-600 font-bold">月20〜50万円</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-white/50 border border-white/80 px-3 py-2.5 rounded-xl border border-white">
                                        <span className="text-gray-700 font-semibold">作業時間</span>
                                        <span className="text-gray-900 font-bold">月間 数時間</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-white/50 border border-white/80 px-3 py-2.5 rounded-xl border border-white">
                                        <span className="text-gray-700 font-semibold">クオリティ</span>
                                        <span className="text-gray-800 font-bold">プロ水準</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-5 h-8 flex items-center justify-center text-center leading-relaxed">
                                    丸投げできるが、高額な<br />固定費が利益を圧迫する
                                </p>
                            </div>

                            {/* SNS Agent24 */}
                            <div className="bg-gradient-to-b from-rose-500 to-[#D4A373] p-[1px] rounded-2xl relative">
                                <div className="absolute -top-3 -right-3 w-6 h-6 bg-rose-500 rounded-full animate-ping opacity-75"></div>
                                <div className="absolute -top-3 -right-3 w-6 h-6 bg-rose-500 rounded-full shadow-lg"></div>

                                <div className="bg-white/60 backdrop-blur-xl border border-white/50 h-full rounded-2xl p-5 relative flex flex-col items-center">
                                    <h4 className="text-white text-lg md:text-2xl font-bold mb-4 flex items-center justify-center gap-2 drop-shadow-md">
                                        <Zap size={24} className="text-yellow-300" fill="currentColor" /> SNS Agent24
                                    </h4>
                                    <div className="space-y-3 w-full text-sm">
                                        <div className="flex justify-between items-center bg-white/40 px-3 py-2.5 rounded-xl border border-white/30 backdrop-blur-sm">
                                            <span className="text-gray-900 font-semibold">月額費用</span>
                                            <span className="text-rose-600 text-lg font-extrabold">{billingCycle === 'year' ? '月2,483円' : '月2,980円'}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/40 px-3 py-2.5 rounded-xl border border-white/30 backdrop-blur-sm">
                                            <span className="text-gray-900 font-semibold">作業時間</span>
                                            <span className="text-green-600 font-bold">月間 約1〜2時間</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/40 px-3 py-2.5 rounded-xl border border-white/30 backdrop-blur-sm">
                                            <span className="text-gray-900 font-semibold text-center leading-tight">クオリティ</span>
                                            <span className="text-rose-600 font-bold text-base">最新AIによる最高水準</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-white/90 font-medium mt-5 h-8 flex items-center justify-center text-center leading-relaxed drop-shadow-sm">
                                        プロ同等の品質を維持しながら<br />時間と資金をコア業務へ集中
                                    </p>
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
            </div>
        </section>
    );
}
