"use client";
import React, { useState } from 'react';
import { Check, Star, Zap } from 'lucide-react';
import styles from './PricingSection.module.css';

export default function PricingSection({ onUpgrade, isPro }) {
    const [billingCycle, setBillingCycle] = useState('month'); // 'month' or 'year'

    const plans = [
        {
            name: "Free Plan",
            price: "¥0",
            period: "/ month",
            features: [
                "1日1回まで生成可能",
                "基本的なトレンドリサーチ",
                "Instagram / X / Facebook 対応",
                "広告なし"
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

                    <div className="mt-8 mb-4 inline-block bg-purple-900/40 border border-purple-500/30 rounded-2xl px-6 py-4 text-center text-sm md:text-base text-purple-100 font-bold max-w-2xl mx-auto shadow-lg relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 pointer-events-none"></div>
                        <span className="relative z-10">
                            通常の運用代行：月20〜50万円 <span className="mx-2 text-pink-400">→</span> SNS Agent24 Pro：月2,980円<br />
                            <span className="text-pink-300">品質は妥協せず、コストだけを99%削減。</span>
                        </span>
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
