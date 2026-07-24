"use client";
import React, { useState } from 'react';
import { Check, Star, Zap, User, Building, Calendar, Mail, MousePointer, Rocket, Sparkles, X, AlertTriangle, TrendingDown, Crown } from 'lucide-react';
import styles from './PricingSection.module.css';
import ProMaxInquiryModal from '@/components/ProMaxInquiryModal';

export default function PricingSection({
    onUpgrade,
    onManage,
    currentPlan = 'free',
    billingPortalAvailable = false,
    checkoutLoading = false
}) {
    const [billingCycle, setBillingCycle] = useState('month'); // 'month' or 'year'
    const [inquiryOpen, setInquiryOpen] = useState(false);

    // 現在のユーザーのティア（free / pro / promax）を判定し、
    // 各プランが「現在のプラン / 下位プラン / 上位プラン」のいずれかを算出する
    // 「現在のプラン」は利用権限ではなく、Stripeで確認したSNS Agent24の契約だけを基準にする。
    const currentTier = ['free', 'pro', 'promax'].includes(currentPlan) ? currentPlan : null;
    const tierRank = { free: 0, pro: 1, promax: 2 };
    const relationTo = (planTier) => {
        if (!currentTier) return 'unknown';
        if (tierRank[planTier] === tierRank[currentTier]) return 'current';
        if (tierRank[planTier] < tierRank[currentTier]) return 'lower';
        return 'upper';
    };

    // プランごとの表示情報を一元化
    // relation === 'current': 現在のプラン（赤バッジ＋赤枠）
    // relation === 'lower': 下位プラン（グレーアウト、ボタン無効）
    // relation === 'upper': アップグレード候補（通常ボタン）
    const buildPlanCard = (planTier, base) => {
        const relation = relationTo(planTier);
        const isCurrentPlan = relation === 'current';
        const isLower = relation === 'lower';
        const isUnknown = relation === 'unknown';

        let buttonText;
        let buttonStyle;
        let disabled = false;

        if (isUnknown) {
            buttonText = '契約状況を確認中';
            buttonStyle = 'secondary';
            disabled = true;
        } else if (isCurrentPlan) {
            buttonText = planTier === 'free'
                ? 'ご利用中'
                : (billingPortalAvailable ? 'ご契約内容の管理' : '契約情報を確認できません');
            buttonStyle = 'current';
            disabled = planTier === 'free' || !billingPortalAvailable;
        } else if (isLower) {
            buttonText = '現在のプランより下位';
            buttonStyle = 'secondary';
            disabled = true;
        } else {
            // 上位プランへのアップグレード
            buttonText = base.upgradeText;
            buttonStyle = 'primary';
        }

        return {
            ...base,
            planTier,
            relation,
            isCurrentPlan,
            disabled,
            buttonText,
            buttonStyle,
            action: isCurrentPlan && planTier !== 'free' ? onManage : base.action,
            // プロモバッジ（人気 No.1 等）はアップグレード候補の時のみ表示する
            badge: !isCurrentPlan && !isLower ? base.badge : null
        };
    };

    const plans = [
        buildPlanCard('free', {
            name: "Free Plan",
            price: "¥0",
            period: "/月",
            features: [
                "1日3回まで生成可能",
                "基本的なトレンドリサーチ",
                "Instagram 対応",
                "広告なし",
                "商用利用不可（個人利用・お試しのみ）"
            ],
            action: null
        }),
        buildPlanCard('pro', {
            name: "Pro Plan",
            price: billingCycle === 'year' ? "¥29,800" : "¥2,980",
            period: billingCycle === 'year' ? "/年" : "/月",
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
            upgradeText: "Proにアップグレード",
            action: () => {
                if (onUpgrade) return onUpgrade(billingCycle, 'pro');
                window.location.assign('/sign-up');
            }
        }),
        buildPlanCard('promax', {
            name: "Pro Max Plan",
            price: billingCycle === 'year' ? "¥298,000" : "¥29,800",
            period: billingCycle === 'year' ? "/年" : "/月",
            subtext: billingCycle === 'year' ? "（月あたり約 ¥24,833）" : "オンラインでお申し込み・自動更新",
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
            upgradeText: currentTier === 'pro' ? "Pro Maxへアップグレード" : "Pro Maxを始める",
            action: () => {
                if (onUpgrade) return onUpgrade(billingCycle, 'promax');
                window.location.assign('/sign-up');
            }
        })
    ];

    return (
        <section className={styles.pricingSection}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Plan</h2>
                    <p className={styles.subtitle}>
                        無料お試しから、Pro / Pro Max まで用途に合わせて選べます。<br />
                        月払い・年払いは下の料金カードに反映されます。
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
                                                <span className="text-gray-800">品質 <span className="font-black text-gray-900">最新AIで生成・編集</span></span>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-gray-700 font-medium mt-4 pt-4 border-t border-rose-200 leading-relaxed">
                                            投稿案の作成時間を減らしながら<br />大切な業務へ集中
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <div className={styles.billingPanel}>
                    <div className={styles.billingText}>
                        <span className={styles.billingEyebrow}>支払い方法</span>
                        <h3 className={styles.billingTitle}>下の料金カードに反映されます</h3>
                        <p className={styles.billingDescription}>
                            Pro / Pro Max の価格表示を、月払いまたは年払いに切り替えられます。
                        </p>
                    </div>
                    <div className={styles.billingOptions} role="tablist" aria-label="支払い方法を選択">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={billingCycle === 'month'}
                            className={`${styles.billingOption} ${billingCycle === 'month' ? styles.billingOptionActive : ''}`}
                            onClick={() => setBillingCycle('month')}
                        >
                            <span className={styles.billingOptionTitle}>月払い</span>
                            <span className={styles.billingOptionNote}>毎月支払う</span>
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={billingCycle === 'year'}
                            className={`${styles.billingOption} ${billingCycle === 'year' ? styles.billingOptionActive : ''}`}
                            onClick={() => setBillingCycle('year')}
                        >
                            <span className={styles.billingOptionTitle}>年払い</span>
                            <span className={styles.billingOptionNote}>2ヶ月分お得</span>
                        </button>
                    </div>
                    <p className={styles.billingStatus}>
                        現在は <strong>{billingCycle === 'year' ? '年払い' : '月払い'}</strong> の料金を表示しています。
                    </p>
                </div>

                <div className={styles.grid}>
                    {plans.map((plan, index) => (
                        <div
                            key={index}
                            className={`${styles.card} ${plan.name === 'Pro Max Plan' && !plan.isCurrentPlan ? styles.proCard : ''} ${plan.isCurrentPlan ? styles.currentPlanCard : ''} ${plan.relation === 'lower' ? styles.lowerPlanCard : ''}`}
                        >
                            {plan.isCurrentPlan && <div className={styles.currentBadge}>現在のプラン</div>}
                            {!plan.isCurrentPlan && plan.badge && <div className={styles.badge}>{plan.badge}</div>}
                            {plan.planTier !== 'free' && (
                                <div className={styles.planBillingChip}>
                                    {billingCycle === 'year' ? '年払いで表示中' : '月払いで表示中'}
                                </div>
                            )}
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
                                disabled={plan.disabled || checkoutLoading}
                                aria-busy={checkoutLoading && !plan.disabled ? 'true' : undefined}
                            >
                                {checkoutLoading && !plan.disabled ? '決済画面を準備中...' : plan.buttonText}
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
                            <span className="font-semibold text-gray-800">「週に1回、メールを開いてOKボタンを押すだけ」</span>で1週間分の投稿が完成します。<br />
                            <span className="mt-2 inline-block font-semibold text-rose-700">曜日・時刻はご希望に合わせて設定できます。以下は設定例です。</span>
                        </p>
                    </div>

                    {/* 「週1回の準備プロセス」と「毎日の自動成果」の2ブロック構成
                        プロセス(1-3)はグループ化し小さめ、結果(4)を大きく強調して
                        「何を経て何が手に入るか」を視線の流れで伝える */}
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 items-stretch">

                        {/* 左ブロック：週1回の準備プロセス (Step 1-3) */}
                        <div className="bg-gray-50/80 border border-gray-200 rounded-3xl p-5 md:p-6 relative">
                            <div className="inline-flex items-center gap-1.5 bg-white text-gray-600 text-[10px] font-bold px-3 py-1 rounded-full border border-gray-200 mb-4 tracking-widest">
                                設定例：週に1回の準備
                            </div>
                            <div className="space-y-3 md:space-y-4">
                                {/* Step 1 */}
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 flex flex-col items-center">
                                        <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-[#D4A373] text-white rounded-full flex items-center justify-center font-black text-sm shadow-md">1</div>
                                        <div className="w-0.5 h-6 bg-gradient-to-b from-rose-300 to-amber-300 mt-1"></div>
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Calendar size={16} className="text-rose-500" />
                                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black tracking-wider text-rose-700">設定例</span>
                                            <h4 className="font-bold text-gray-900 text-sm">毎週日曜 20:00</h4>
                                        </div>
                                        <p className="text-xs text-gray-600 leading-relaxed">
                                            AIが事業プロフィールから<br />
                                            <span className="font-semibold text-gray-800">1週間分（7投稿）を自動生成</span>
                                        </p>
                                    </div>
                                </div>
                                {/* Step 2 */}
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 flex flex-col items-center">
                                        <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-[#D4A373] text-white rounded-full flex items-center justify-center font-black text-sm shadow-md">2</div>
                                        <div className="w-0.5 h-6 bg-gradient-to-b from-amber-300 to-purple-300 mt-1"></div>
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Mail size={16} className="text-amber-500" />
                                            <h4 className="font-bold text-gray-900 text-sm">承認メールが届く</h4>
                                        </div>
                                        <p className="text-xs text-gray-600 leading-relaxed">
                                            確認用リンクつきのメールを受信。<br />
                                            <span className="font-semibold text-gray-800">画像と文面のプレビューを確認</span>
                                        </p>
                                    </div>
                                </div>
                                {/* Step 3 - ユーザーアクションを強調 */}
                                <div className="flex items-start gap-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-3 -mx-1 shadow-sm">
                                    <div className="flex-shrink-0">
                                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-full flex items-center justify-center font-black text-sm shadow-md ring-4 ring-purple-100">3</div>
                                    </div>
                                    <div className="flex-1 pt-0.5">
                                        <div className="flex items-center gap-2 mb-1">
                                            <MousePointer size={16} className="text-purple-600" />
                                            <h4 className="font-bold text-purple-900 text-sm">ワンクリック承認</h4>
                                            <span className="bg-purple-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">あなたの唯一の作業</span>
                                        </div>
                                        <p className="text-xs text-gray-700 leading-relaxed">
                                            内容を確認してOKなら承認。不要なら却下。<br />
                                            <span className="font-bold text-purple-700">所要時間わずか数分</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 中央の矢印（デスクトップのみ） */}
                        <div className="hidden md:flex items-center justify-center">
                            <div className="flex flex-col items-center">
                                <div className="text-[10px] font-bold text-gray-400 tracking-widest mb-1">RESULT</div>
                                <div className="text-3xl text-rose-400">→</div>
                            </div>
                        </div>
                        {/* モバイル用の下向き矢印 */}
                        <div className="md:hidden flex justify-center py-2">
                            <div className="flex flex-col items-center">
                                <div className="text-[10px] font-bold text-gray-400 tracking-widest">RESULT</div>
                                <div className="text-2xl text-rose-400">↓</div>
                            </div>
                        </div>

                        {/* 右ブロック：毎日の自動成果 (Step 4) - 大きく強調 */}
                        <div className="relative">
                            {/* 後光のグロー */}
                            <div className="absolute -inset-2 bg-gradient-to-br from-rose-400 via-pink-400 to-[#D4A373] rounded-3xl opacity-40 blur-xl"></div>

                            <div className="relative bg-gradient-to-br from-rose-500 via-pink-500 to-[#D4A373] rounded-3xl p-[2px] shadow-2xl shadow-rose-500/30 h-full">
                                <div className="bg-gradient-to-br from-white to-rose-50 rounded-3xl p-6 md:p-7 h-full flex flex-col justify-center relative overflow-hidden">
                                    {/* 背景装飾 */}
                                    <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-br from-rose-200/50 to-transparent rounded-full blur-2xl"></div>

                                    <div className="relative z-10">
                                        <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-[#D4A373] text-white text-[10px] font-black px-3 py-1 rounded-full mb-4 tracking-widest shadow-md">
                                            <Rocket size={12} />
                                            毎日の成果
                                        </div>

                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-[#D4A373] rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/30">
                                                <Rocket size={28} className="text-white" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 tracking-wider">
                                                    <span>STEP 4</span>
                                                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black tracking-wider text-rose-700">設定例</span>
                                                </div>
                                                <h4 className="font-black text-gray-900 text-lg md:text-xl leading-tight">毎日12:00<br className="md:hidden" /> Instagramへ自動投稿</h4>
                                            </div>
                                        </div>

                                        <p className="text-sm text-gray-700 leading-relaxed mb-4">
                                            承認された投稿を、予約時刻通りに<br />
                                            <span className="font-black text-rose-600">Instagramへ自動配信</span>
                                        </p>

                                        <div className="flex items-center gap-2 text-xs text-gray-600 bg-white/80 border border-rose-100 rounded-lg p-2.5">
                                            <Sparkles size={14} className="text-rose-500 flex-shrink-0" />
                                            <span><span className="font-bold text-gray-800">あなたは何もしなくてOK</span>。投稿が途切れず、集客が回り続けます。</span>
                                        </div>
                                    </div>
                                </div>
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

                    {/* 自動決済と任意相談の案内 */}
                    <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-5 md:p-6 text-center">
                        <p className="text-sm text-gray-700 leading-relaxed">
                            <span className="font-bold text-gray-900">Pro Max Plan はオンラインでお申し込みできます。</span><br />
                            月払い・年払いとも自動更新です。<br />
                            お客様の事業特性・ブランドガイドライン・ターゲット層に合わせたオーダーメイド設定を<br className="hidden md:inline" />
                            決済完了後に専任担当がご案内します。相談してから決めたい方は、下のフォームをご利用ください。
                        </p>
                        <button
                            type="button"
                            onClick={() => setInquiryOpen(true)}
                            className="mt-5 inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-full text-sm font-bold hover:bg-gray-800 transition-colors"
                        >
                            <Sparkles size={16} /> 相談してから決める
                        </button>
                    </div>
                </div>
            </div>
            <ProMaxInquiryModal isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} />
        </section>
    );
}
