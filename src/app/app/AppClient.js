"use client";
import React, { useState, useEffect, useRef } from 'react';
import NextImage from 'next/image';
import { Gem, Lock, Camera as Instagram, Sparkles, Download, Copy, RefreshCw, ChevronLeft, Globe, Building, Target, Lightbulb, PenTool, ImageIcon, BrainCircuit, Search, Brain, Palette, Rocket, Zap, History, Smartphone, ArrowRight, ArrowDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { UserButton, useUser, useClerk, useSession } from "@clerk/nextjs";
import PricingSection from '@/components/layout/PricingSection';
import { CategorySelector, PurposeSelector, TargetSelector, GenderSelector, BusinessStyleSelector, ToneSelector, LanguageSelector, OverlayLanguageSelector, FormatSelector, ProductInput } from '@/components/features/Selectors';
import { researchTrends, generatePost, generateImage, scrapeWebsite } from '@/lib/apiService';
import { drawCanvasImage } from '@/lib/canvasHelper';
import ProMaxInquiryModal from '@/components/ProMaxInquiryModal';
import ProfileSetupModal from '@/components/features/ProfileSetupModal';
import { usePostHog } from 'posthog-js/react';

const WEEKLY_BATCH_STARTED_KEY = 'sns-agent24-weekly-generation-started-at';
const WEEKLY_BATCH_PENDING_PAYLOAD_KEY = 'sns-agent24-weekly-generation-payload';

export default function Home() {
    const { user, isLoaded, isSignedIn } = useUser();
    const { session } = useSession();
    const { openSignIn, openSignUp } = useClerk();
    const posthog = usePostHog();

    const [serverIsPro, setServerIsPro] = useState(null);
    const [serverIsProMax, setServerIsProMax] = useState(null);
    const [billingAttentionRequired, setBillingAttentionRequired] = useState(false);
    const [billingPortalAvailable, setBillingPortalAvailable] = useState(null);
    const [portalError, setPortalError] = useState('');
    useEffect(() => {
        if (isSignedIn) {
            fetch('/api/user/status')
                .then(res => res.json())
                .then(data => {
                    console.log("Strict Backend Check:", data);
                    setServerIsPro(Boolean(data.isPro));
                    setServerIsProMax(Boolean(data.isProMax));
                    setBillingAttentionRequired(Boolean(data.billingAttentionRequired));
                    setBillingPortalAvailable(Boolean(data.billingPortalAvailable));
                })
                .catch(console.error);
        }
    }, [isSignedIn]);

    // JWTトークン内のメタデータ（ユーザー自身またはカスタムクレーム）を確実に取得
    const sessionRole = session?.user?.publicMetadata?.role || null;
    const isProMax = serverIsProMax === true || sessionRole === 'promax' || user?.publicMetadata?.role === 'promax' || sessionRole === 'admin' || user?.publicMetadata?.role === 'admin';
    const isPro = isProMax || serverIsPro === true || sessionRole === 'pro' || user?.publicMetadata?.role === 'pro';

    const [step, setStep] = useState(0); // 0: Platform, 1: Process, 2: Result
    const [selectedPlatform, setSelectedPlatform] = useState('instagram');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedPurpose, setSelectedPurpose] = useState(null); // 新設: 投稿の目的
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [selectedGender, setSelectedGender] = useState(null);
    const [selectedBusinessStyle, setSelectedBusinessStyle] = useState(null);
    const [selectedTone, setSelectedTone] = useState(null);
    const [selectedLanguage, setSelectedLanguage] = useState('ja'); // キャプション用の言語（多言語可）
    const [selectedOverlayLanguage, setSelectedOverlayLanguage] = useState('ja'); // 画像オーバーレイ用の言語（常に単一）
    const [selectedFormat, setSelectedFormat] = useState('carousel'); // デフォルトはカルーセル(5枚)
    const [productContext, setProductContext] = useState({});
    const loadingPhaseRef = useRef(0);
    const selectedCategoryRef = useRef(null);
    const selectedTargetRef = useRef(null);

    // UIリッチ化用のステート
    const [loadingProgress, setLoadingProgress] = useState(0); // 0〜99の疑似進捗
    const [terminalLogs, setTerminalLogs] = useState([]); // サイバー風の解析ダミーログ
    const [batchStatus, setBatchStatus] = useState(''); // バッチ生成中の進捗表示用
    const [batchCompleted, setBatchCompleted] = useState(null); // バッチ完了後の永続的な確認カード用 ({ count: number } or null)
    const [generationRecoveryNotice, setGenerationRecoveryNotice] = useState('');
    const [generationError, setGenerationError] = useState(null);

    // パーソナライズされた動的ログの生成関数
    const getDynamicLogs = (category, targetLabel) => {
        const cName = category?.label || '指定業種';
        const tName = targetLabel || 'ターゲット層';
        return [
            "システム初期化シーケンスを開始...",
            "データノードに接続中...",
            `${cName}におけるグローバルトレンド指標を取得中...`,
            `${tName}のペルソナベクトルをマッピング...`,
            "最新の検索インサイトと感情パターンを解析中...",
            "エンゲージメント率の高いハッシュタグを抽出...",
            "ユーザーの深層心理（インサイト）に基づいた価値提案を合成...",
            "ブランドのトンマナに合わせた言語バリエーションを生成...",
            "来店・コンバージョンに直結するCTAを最適化...",
            "視覚的アテンションを高めるビジュアルフィルターを適用...",
            "キャンバスノードへのレンダリングを開始...",
            "最終プロンプト構造を最適化中..."
        ];
    };

    const [isStateLoaded, setIsStateLoaded] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    // プロフィール設定モーダルの表示判定
    useEffect(() => {
        if (isLoaded && isSignedIn && user) {
            const hasProfile = user.publicMetadata?.profileSetupCompleted;
            if (!hasProfile) {
                setIsProfileModalOpen(true);
            }
        }
    }, [isLoaded, isSignedIn, user]);

    useEffect(() => {
        const saved = localStorage.getItem('snsAgent24_formState_v2');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.selectedPlatform) setSelectedPlatform(parsed.selectedPlatform);
                if (parsed.selectedCategory) setSelectedCategory(parsed.selectedCategory);
                if (parsed.selectedPurpose) setSelectedPurpose(parsed.selectedPurpose);
                if (parsed.selectedTarget) setSelectedTarget(parsed.selectedTarget);
                if (parsed.selectedGender) setSelectedGender(parsed.selectedGender);
                if (parsed.selectedBusinessStyle) setSelectedBusinessStyle(parsed.selectedBusinessStyle);
                if (parsed.selectedTone) setSelectedTone(parsed.selectedTone);
                if (parsed.selectedLanguage) setSelectedLanguage(parsed.selectedLanguage);
                if (parsed.selectedOverlayLanguage) setSelectedOverlayLanguage(parsed.selectedOverlayLanguage);
                if (parsed.selectedFormat) setSelectedFormat(parsed.selectedFormat);
                if (parsed.productContext) setProductContext(parsed.productContext);
            } catch (e) {
                console.error("Failed to parse form state", e);
            }
        }
        setIsStateLoaded(true);
    }, []);

    useEffect(() => {
        if (isStateLoaded) {
            localStorage.setItem('snsAgent24_formState_v2', JSON.stringify({
                selectedPlatform,
                selectedCategory,
                selectedPurpose,
                selectedTarget,
                selectedGender,
                selectedBusinessStyle,
                selectedTone,
                selectedLanguage,
                selectedOverlayLanguage,
                selectedFormat,
                productContext
            }));
        }
    }, [selectedPlatform, selectedCategory, selectedPurpose, selectedTarget, selectedGender, selectedBusinessStyle, selectedTone, selectedLanguage, selectedOverlayLanguage, selectedFormat, productContext, isStateLoaded]);

    const [loading, setLoading] = useState(false);
    const [loadingPhase, setLoadingPhase] = useState(0);
    const [result, setResult] = useState(null);
    const [checkoutError, setCheckoutError] = useState(null);

    useEffect(() => {
        loadingPhaseRef.current = loadingPhase;
        selectedCategoryRef.current = selectedCategory;
        selectedTargetRef.current = selectedTarget;
    }, [loadingPhase, selectedCategory, selectedTarget]);
    // Pro Max Plan 個別相談モーダル表示制御
    const [proMaxInquiryOpen, setProMaxInquiryOpen] = useState(false);
    const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

    // アカウント作成から7日以内か判定し、無料生成枠の上限を返す
    const getDailyFreeLimit = () => {
        if (!user || !user.createdAt) return 1;
        const createdDate = new Date(user.createdAt);
        const now = new Date();
        const diffTime = Math.abs(now - createdDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        // 最初の7日間はハビットトライアル（習慣化期間）として回数を大幅緩和、それ以降は1日3回
        return diffDays <= 7 ? 999 : 3;
    };

    // 回数制限のチェック関数 (localStorageベース)
    const checkLimitAndRecord = () => {
        if (isPro) return true; // Proプランは無制限

        const maxLimit = getDailyFreeLimit();
        const today = new Date().toLocaleDateString('ja-JP');
        const usageDataStr = localStorage.getItem('snsAgent24_usage');
        let usageData = usageDataStr ? JSON.parse(usageDataStr) : { date: today, count: 0 };

        // 日付が変わっていればリセット
        if (usageData.date !== today) {
            usageData = { date: today, count: 0 };
        }

        if (usageData.count >= maxLimit) {
            return false; // 制限オーバー
        }

        // カウントアップして保存
        usageData.count += 1;
        localStorage.setItem('snsAgent24_usage', JSON.stringify(usageData));
        return true;
    };

    const refundDailyFreeUsage = () => {
        if (isPro || typeof window === 'undefined') return;
        try {
            const today = new Date().toLocaleDateString('ja-JP');
            const usageDataStr = localStorage.getItem('snsAgent24_usage');
            const usageData = usageDataStr ? JSON.parse(usageDataStr) : null;
            if (!usageData || usageData.date !== today) return;
            usageData.count = Math.max(0, Number(usageData.count || 0) - 1);
            localStorage.setItem('snsAgent24_usage', JSON.stringify(usageData));
        } catch (err) {
            console.warn('Failed to refund daily usage:', err);
        }
    };

    // エラーログを管理者へ通知する共通関数
    const reportErrorToAdmin = async (error, context) => {
        try {
            await fetch('/api/log-error', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    errorName: error?.name || 'Error',
                    errorMessage: error?.message || String(error),
                    errorStack: error?.stack || '',
                    errorContext: context,
                    user: user ? (user.primaryEmailAddress?.emailAddress || user.id) : '未ログイン',
                    timestamp: new Date().toISOString()
                })
            });
        } catch (e) {
            console.error("Failed to report error to admin API:", e);
        }
    };

    // --- ロード画面用のSF風演出エフェクト ---
    useEffect(() => {
        let progressInterval;
        let logInterval;

        if (loading) {
            // ローディング開始時にプログレスを確実にゼロセット
            setLoadingProgress(0);

            // プログレスバー（HUD）カウントアップ（フェーズに応じた進行目安）
            // 全体を100%とし、各フェーズ(0〜4)ごとに約20%ずつを割り当てる
            progressInterval = setInterval(() => {
                setLoadingProgress(prev => {
                    // 現在のloadingPhase (0〜4... 5は完了相当とする)
                    if (prev >= 99) return 99; // 99%で完全待機（100%になるのは完了時のみ）

                    // 現在のloadingPhaseに基づく「目標進行度」
                    const phaseMax = Math.min((loadingPhaseRef.current + 1) * 20, 98);

                    if (prev < phaseMax) {
                        // 目標に達していなければ通常ペース（1〜3%アップ）で進める
                        return prev + Math.floor(Math.random() * 3) + 1;
                    } else {
                        // 目標に達してもピタリと止めず、10%の低確率で1%ずつじわじわ上昇させ続ける
                        if (Math.random() < 0.1) {
                            return prev + 1;
                        }
                        return prev;
                    }
                });
            }, 600);

            // ターミナル風に次々とダミーログを追加していく
            setTerminalLogs(["> システム初期化モジュールを起動..."]);

            logInterval = setInterval(() => {
                setTerminalLogs(prev => {
                    const currentTarget = selectedTargetRef.current;
                    const targetLabel = currentTarget === 'teens' ? '10代' : currentTarget === 'young_adults' ? '20-30代' : currentTarget === 'parents' ? 'パパママ' : currentTarget === 'high_end' ? '富裕層' : 'ビジネス層';
                    const dynamicLogs = getDynamicLogs(selectedCategoryRef.current, targetLabel);
                    const randomLog = dynamicLogs[Math.floor(Math.random() * dynamicLogs.length)];
                    const newLog = `> ${randomLog} [${new Date().toISOString().split('T')[1].slice(0, -1)}]`;
                    const updated = [...prev, newLog];
                    // 最新の8件程度だけ保持して表示領域におさめる
                    if (updated.length > 8) updated.shift();
                    return updated;
                });
            }, 1200);
        } else {
            // ロード完了時は100%にして終了
            setLoadingProgress(100);
            if (progressInterval) clearInterval(progressInterval);
            if (logInterval) clearInterval(logInterval);
        }

        return () => {
            if (progressInterval) clearInterval(progressInterval);
            if (logInterval) clearInterval(logInterval);
        };
    }, [loading]); // loadingPhaseはRef経由で参照するため除外し、勝手にリセット・再起動されるのを防ぐ
    // ----------------------------------------

    const handleCheckout = async (interval = 'month', tier = 'pro') => {
        try {
            if (!isSignedIn) {
                openSignUp();
                return;
            }
            posthog?.capture('upgrade_button_clicked', { tier, interval });
            setCheckoutError(null);
            setIsCheckoutLoading(true);

            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ interval, tier })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`(${res.status}) ${text}`);
            }

            const data = await res.json();
            if (data.url) {
                posthog?.capture('checkout_redirect', { tier, interval });
                window.location.href = data.url;
            } else {
                throw new Error("決済URLが取得できませんでした");
            }
        } catch (e) {
            console.error(e);
            posthog?.capture('checkout_error', { tier, interval, error: e.message });
            setCheckoutError(e.message);
            if (e.message !== "ログインが必要です。") {
                reportErrorToAdmin(e, "handleCheckout - Stripeチェックアウト遷移時");
            }
        } finally {
            setIsCheckoutLoading(false);
        }
    };

    const handlePortal = async () => {
        try {
            setPortalError('');
            posthog?.capture('portal_opened');
            const res = await fetch('/api/portal', { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || '管理画面を開けませんでした');
            }
            if (!data.url) {
                throw new Error('管理画面のURLを取得できませんでした');
            }
            window.location.href = data.url;
        } catch (e) {
            setPortalError('プラン管理画面を開けませんでした。時間をおいてもう一度お試しください。');
            if (e.message !== "ログインが必要です。") {
                reportErrorToAdmin(e, "handlePortal - カスタマーポータル遷移時");
            }
        }
    };

    const handleStart = () => {
        if (!isSignedIn) {
            openSignUp();
            return;
        }
        if (!selectedPlatform) {
            alert("プラットフォームを選択してください");
            return;
        }
        setStep(1);
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
    };

    const handleGenerate = async () => {
        setGenerationError(null);
        if (!selectedCategory || !selectedPurpose || !selectedTarget || !selectedGender || !selectedBusinessStyle || !selectedTone || !selectedFormat) {
            setGenerationError({
                title: '未選択の項目があります',
                message: 'すべての項目を選択してから、もう一度「生成する」を押してください。'
            });
            window.setTimeout(() => document.getElementById('generation-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
            return;
        }
        setGenerationRecoveryNotice('');

        posthog?.capture('generation_started', {
            format: selectedFormat,
            category: selectedCategory?.label,
            purpose: selectedPurpose,
            platform: selectedPlatform
        });

        // 無料プランの回数制限チェック
        const maxLimit = getDailyFreeLimit();
        if (!checkLimitAndRecord()) {
            posthog?.capture('free_limit_hit', { daily_limit: maxLimit, platform: selectedPlatform });
            setGenerationError({
                title: '本日の無料生成枠を使い切りました',
                message: `無料プランは1日${maxLimit}回まで生成できます。明日もう一度お試しいただくか、無制限で使えるProプランをご確認ください。`,
                showUpgrade: true
            });
            window.setTimeout(() => document.getElementById('generation-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
            return;
        }

        setLoading(true);
        setLoadingProgress(0); // 確実に0からプログレスアニメーションをスタートさせる
        setLoadingPhase(0); // 0: "世界中のトレンドを分析しています..."

        // ユーザーが生成中画面(ローディング)に気づけるようにDOM更新後に一番上へスクロールする
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);

        // 失敗時に「どのステップで」エラーが出たかを管理者通知に含めるため
        // 直近のステップ名を track する。"TypeError: Load failed" のように
        // ブラウザ側でスタックが空になるケースでも切り分けが可能になる。
        let currentStep = 'init';

        try {
            // APIに巨大な画像データ(Base64)が含まれたまま送るとVercelの制限(Server Action)でエラーになる原因を防ぐため、裏側へ送信するデータからは画像を除外する
            const cleanProductContext = { ...productContext };
            delete cleanProductContext.logoUrl;
            delete cleanProductContext.baseImage; // 後方互換性のため
            delete cleanProductContext.baseImages; // 複数画像配列を除外

            let siteContent = null;
            if (cleanProductContext?.websiteUrl) {
                currentStep = 'scrapeWebsite';
                siteContent = await scrapeWebsite(cleanProductContext.websiteUrl);
            }

            const targetLabel = selectedTarget === 'teens' ? '10代' : selectedTarget === 'young_adults' ? '20-30代' : selectedTarget === 'parents' ? 'パパママ' : selectedTarget === 'high_end' ? '富裕層・ハイエンド' : 'ビジネス層';

            // 以前追加したProfile設定機能は、現在の詳細フォームUIと競合して深刻なバグ（コンテキスト汚染）を招くため、
            // APIに渡す「userProfile」は過去のメタデータを使わず、今回画面で選択された情報を元に再構築する（これが真実のコンテキストである）。
            const userProfile = {
                industry: selectedCategory?.label || '',
                targetAudience: targetLabel || '',
                usp: cleanProductContext?.sellingPoint || ''
            };

            // 1. リサーチ
            currentStep = 'researchTrends';
            const research = await researchTrends(selectedCategory, targetLabel, selectedGender, selectedBusinessStyle, selectedPlatform, cleanProductContext?.location, siteContent, userProfile);
            setLoadingPhase(1); // 1: "ターゲットの深層心理に基づいてキャプションを構築中..."
            await new Promise(resolve => setTimeout(resolve, 300)); // ReactのUI再レンダリングを確実に行わせるための待機（ローディングアニメの真実味を出す）

            // 2. キャプション生成 (言語指定・フォーマット指定・ユーザープロフィールを追加)
            currentStep = 'generatePost';
            const post = await generatePost(research, selectedPlatform, selectedCategory, targetLabel, selectedGender, selectedBusinessStyle, selectedTone, selectedLanguage, cleanProductContext, siteContent, selectedFormat, userProfile, selectedPurpose, selectedOverlayLanguage);
            if (post?.quality_blocked) {
                refundDailyFreeUsage();
                throw new Error('生成内容が安全基準を満たさなかったため表示を停止しました。無料生成回数は戻しています。もう一度お試しください。');
            }
            setLoadingPhase(2); // 2: "デザインを作成中..."
            await new Promise(resolve => setTimeout(resolve, 300)); // ReactのUI再レンダリングを確実に行わせるための待機

            // 3. ベースとなる背景画像の取得・生成
            let imageUrls = [];
            // 単一画像互換性を持たせつつ、基本は配列として扱う
            let baseImagesArray = productContext.baseImages || [];
            if (baseImagesArray.length === 0 && productContext.baseImage) {
                baseImagesArray = [productContext.baseImage];
            }

            if (baseImagesArray.length === 0) {
                // ユーザーアップロード画像がない場合、AIで背景用画像を生成する
                setLoadingPhase(3); // 3: "画像を生成・合成中..."
                await new Promise(resolve => setTimeout(resolve, 300)); // UI更新の待機

                const imgContext = post.image_idea || research.insight_summary;
                // カルーセルの場合は3枚生成して視覚的バリエーションを確保（5枚だとAPI負荷が大きいため3枚をローテーション）
                const imgCount = selectedFormat === 'carousel' ? 3 : 1;
                currentStep = 'generateImage';
                const generated = await generateImage(selectedCategory, targetLabel, selectedGender, imgContext, cleanProductContext, selectedPlatform, null, imgCount);

                if (generated && generated.length > 0) {
                    baseImagesArray = generated;
                } else {
                    throw new Error("AI画像生成に失敗しました（結果が空です）。");
                }
            } else {
                setLoadingPhase(3); // 3: "画像を生成・合成中..."
                await new Promise(resolve => setTimeout(resolve, 300)); // UI更新の待機
            }
            currentStep = 'drawCanvasImage';

            // 4. 共通ヘルパー drawCanvasImage(lib/canvasHelper.js) を使って文字を合成
            // ロゴは意図的に渡さない（運用方針でInstagram投稿にはロゴを入れないため）
            const canvasOptions = {
                companyName: productContext.companyName
            };

            // 5. 決定したベース画像に対して、必要な枚数分(カルーセルなら5枚)の文言を合成していく
            if (baseImagesArray.length > 0) {
                if (selectedFormat === 'carousel' && post.carousel_slides && Array.isArray(post.carousel_slides)) {
                    // カルーセルの場合は複数枚(5枚)の画像を生成し、アップロードされた画像をローテーション（順番）で割り当てる
                    for (let i = 0; i < post.carousel_slides.length; i++) {
                        const slide = post.carousel_slides[i];
                        const currentBgUrl = baseImagesArray[i % baseImagesArray.length];
                        const imgData = await drawCanvasImage(slide.overlay_copy, currentBgUrl, i, canvasOptions);
                        if (imgData) imageUrls.push(imgData);
                    }
                } else if (selectedFormat !== 'video_script') {
                    // 通常の1枚画像生成（カルーセル以外）は配列の1枚目を使用
                    const currentBgUrl = baseImagesArray[0];
                    const imgData = await drawCanvasImage(post.overlay_copy, currentBgUrl, 0, canvasOptions);
                    if (imgData) imageUrls.push(imgData);
                }
            }

            currentStep = 'saveHistory';
            // 履歴の自動保存 (非同期で裏側で実行し、UIをブロックしない)
            fetch('/api/generations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: selectedPlatform,
                    // ビデオスクリプトの場合はスクリプト本文、それ以外は通常キャプションを保存
                    caption: selectedFormat === 'video_script'
                        ? (post.video_script || []).map(s => `[${s.time}] ${s.audio}\n${s.text_overlay}`).join('\n\n')
                        : (post.caption || post.overlay_copy || ''),
                    imageUrls: imageUrls
                })
            }).catch(err => console.error("Error saving history:", err));

            setResult({ research, post, imageUrls, isSynthesized: true });
            posthog?.capture('generation_completed', {
                format: selectedFormat,
                platform: selectedPlatform
            });
            setStep(2);
            setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 100);
        } catch (e) {
            console.error(e);
            const isLoadFailed = /load failed|failed to fetch|network/i.test(e?.message || '');
            if (isLoadFailed) {
                refundDailyFreeUsage();
                posthog?.capture('generation_response_lost', {
                    format: selectedFormat,
                    platform: selectedPlatform,
                    failed_step: currentStep
                });
                setGenerationRecoveryNotice('通信が一時的に切れました。iPhoneで他のアプリへ移動した時に起きやすい症状です。入力内容は残っているので、戻ってからもう一度「生成する」を押してください。');
                reportErrorToAdmin(e, `handleGenerate - mobile/background network interrupted at step: ${currentStep}`);
                return;
            }
            setGenerationError({
                title: '生成を完了できませんでした',
                message: e?.message || '時間をおいて、もう一度お試しください。'
            });
            window.setTimeout(() => document.getElementById('generation-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
            // 失敗ステップ名を context に含めて管理者に通知 → スタックが空でも切り分け可能
            reportErrorToAdmin(e, `handleGenerate - failed at step: ${currentStep}`);
        } finally {
            setLoading(false);
        }
    };

    const handleBatchGenerate = async (platformType) => {
        if (!selectedCategory || !selectedPurpose || !selectedTarget || !selectedGender || !selectedBusinessStyle || !selectedTone) {
            alert("すべての項目を選択してからバッチ生成をお試しください。");
            return;
        }

        const count = 7;
        const displayPlatform = 'Instagram';
        const confirmMsg = `${displayPlatform}向けに${count}件の投稿生成を開始します。\n生成はサーバー側で進みます。通常は数分後に確認画面へ表示されます。実行しますか？`;
        if (!confirm(confirmMsg)) return;

        setLoading(true);
        setLoadingProgress(1);
        setBatchStatus(`バッチ生成を開始します... (0/${count})`);
        setBatchCompleted(null); // 前回の完了カードをクリアして「進行中」状態へ

        posthog?.capture('batch_generation_started', { platform: platformType, count });

        const pickId = (v) => {
            if (v == null) return null;
            if (typeof v === 'string') return v;
            if (typeof v === 'object') return v.id || v.label || null;
            return null;
        };
        const targetLabel = selectedTarget === 'teens' ? '10代' : selectedTarget === 'young_adults' ? '20-30代' : selectedTarget === 'parents' ? 'パパママ' : selectedTarget === 'high_end' ? '富裕層・ハイエンド' : 'ビジネス層';

        const getPendingApprovalCount = async () => {
            try {
                const res = await fetch('/api/batch-approve', { cache: 'no-store' });
                if (!res.ok) return 0;
                const json = await res.json().catch(() => ({}));
                return Array.isArray(json.posts) ? json.posts.length : 0;
            } catch (err) {
                console.warn('[batch-generate] pending poll failed:', err?.message || err);
                return 0;
            }
        };

        const pollUntilPendingPostsAppear = async () => {
            for (let attempt = 0; attempt < 30; attempt++) {
                await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 5000 : 10000));
                const pendingCount = await getPendingApprovalCount();
                if (pendingCount > 0) {
                    setBatchCompleted(prev => prev ? {
                        ...prev,
                        ready: true,
                        pendingCount,
                        started: false
                    } : prev);
                    if (typeof window !== 'undefined') {
                        window.localStorage.removeItem(WEEKLY_BATCH_STARTED_KEY);
                    }
                    return;
                }
            }

            setBatchCompleted(prev => prev ? {
                ...prev,
                timedOut: true
            } : prev);
        };

        const cleanProductContext = { ...productContext };
        delete cleanProductContext.logoUrl;
        delete cleanProductContext.baseImage;
        delete cleanProductContext.baseImages;

        const userProfile = {
            industry: pickId(selectedCategory) || '',
            targetAudience: targetLabel || '',
            usp: cleanProductContext?.sellingPoint || ''
        };

        const requestPayload = {
            client_request_id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            platform: platformType,
            category_id: pickId(selectedCategory),
            purpose_id: pickId(selectedPurpose),
            target_id: pickId(selectedTarget),
            gender: selectedGender,
            business_style: selectedBusinessStyle,
            tone: selectedTone,
            language: selectedLanguage,
            overlay_language: selectedOverlayLanguage,
            format: 'carousel',
            product_context: cleanProductContext,
            user_profile: userProfile
        };

        try {
            setBatchStatus(`サーバー側で1週間分の生成を開始しています...`);
            if (typeof window !== 'undefined') {
                // iPhone Safari は他アプリへ移動するとレスポンス受信前に fetch が
                // "Load failed" になることがある。先に開始マーカーを残し、
                // 承認画面側で自動確認できるようにする。
                window.localStorage.setItem(WEEKLY_BATCH_STARTED_KEY, String(Date.now()));
                window.localStorage.setItem(WEEKLY_BATCH_PENDING_PAYLOAD_KEY, JSON.stringify(requestPayload));
            }

            const qRes = await fetch('/api/batch-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload)
            });

            if (!qRes.ok) {
                const errBody = await qRes.json().catch(() => null);
                if (typeof window !== 'undefined') {
                    window.localStorage.removeItem(WEEKLY_BATCH_STARTED_KEY);
                    window.localStorage.removeItem(WEEKLY_BATCH_PENDING_PAYLOAD_KEY);
                }
                throw new Error(errBody?.error || `生成APIでエラーが発生しました (${qRes.status})`);
            }

            const data = await qRes.json();
            const generatedCount = data.count || data.expected_count || count;
            posthog?.capture('batch_generation_accepted', { platform: platformType, count: generatedCount });

            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(WEEKLY_BATCH_PENDING_PAYLOAD_KEY);
                if (data.started === true) {
                    window.localStorage.setItem(WEEKLY_BATCH_STARTED_KEY, String(Date.now()));
                } else {
                    window.localStorage.removeItem(WEEKLY_BATCH_STARTED_KEY);
                }
            }

            setBatchStatus(data.already_pending
                ? `確認待ちの投稿が既にあります。確認画面で確認できます。`
                : `生成を開始しました。投稿案ができたらこの画面から承認へ進めます。`);

            // 進行中のステータス表示は3秒で消すが、完了カードはユーザーが次のアクションを
            // 取れるよう永続表示する (次回バッチ起動時 or ページ離脱でクリア)
            setTimeout(() => {
                setLoading(false);
                setLoadingProgress(0);
                setBatchStatus(null);
                setBatchCompleted({
                    count: generatedCount,
                    started: data.started === true,
                    ready: data.started !== true,
                    pendingCount: data.already_pending ? generatedCount : 0
                });
            }, 3000);

            if (data.started === true) {
                pollUntilPendingPostsAppear();
            }

        } catch (error) {
            console.error("Batch error:", error);
            const isLoadFailed = /load failed|failed to fetch|network/i.test(error.message || '');

            if (isLoadFailed) {
                posthog?.capture('batch_generation_response_lost', { platform: platformType, count });
                setBatchStatus('通信が一時的に切れましたが、生成リクエストはサーバーに届いている可能性があります。確認画面で自動確認します。');
                setTimeout(() => {
                    setLoading(false);
                    setLoadingProgress(0);
                    setBatchStatus(null);
                    setBatchCompleted({
                        count,
                        started: true,
                        ready: false,
                        pendingCount: 0,
                        responseLost: true
                    });
                }, 1500);
                pollUntilPendingPostsAppear();
                return;
            }

            setBatchStatus(`エラーが発生しました: ${error.message}`);
            alert(`バッチ処理中にエラーが発生しました。\n\n【エラー内容】\n${error.message}\n\nコンソールも合わせてご確認ください。`);
            setLoading(false);
            setLoadingProgress(0);
            setBatchStatus(null);
        }

    };

    // Hydration Mismatch防止: クライアントサイドでのマウント完了を検知する
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted || !isSignedIn || typeof window === 'undefined') return;

        let retrying = false;
        const retryPendingBatchRequest = async () => {
            if (retrying) return;
            const payloadRaw = window.localStorage.getItem(WEEKLY_BATCH_PENDING_PAYLOAD_KEY);
            const startedRaw = window.localStorage.getItem(WEEKLY_BATCH_STARTED_KEY);
            const startedAt = startedRaw ? Number(startedRaw) : 0;
            const isRecent = Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < 15 * 60 * 1000;
            if (!payloadRaw || !isRecent) return;

            retrying = true;
            try {
                const res = await fetch('/api/batch-generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payloadRaw
                });
                if (!res.ok) return;

                const data = await res.json().catch(() => ({}));
                window.localStorage.removeItem(WEEKLY_BATCH_PENDING_PAYLOAD_KEY);
                window.localStorage.setItem(WEEKLY_BATCH_STARTED_KEY, String(Date.now()));
                posthog?.capture('batch_generation_retry_accepted', {
                    started: data.started === true,
                    duplicate: data.duplicate === true
                });

                setBatchStatus(null);
                setBatchCompleted({
                    count: data.count || data.expected_count || 7,
                    started: data.started !== false,
                    ready: data.started === false && data.already_pending === true,
                    pendingCount: data.already_pending ? (data.count || 7) : 0,
                    responseLost: true
                });
            } catch (err) {
                console.warn('[batch-generate] retry after background failed:', err?.message || err);
            } finally {
                retrying = false;
            }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') retryPendingBatchRequest();
        };

        window.addEventListener('pageshow', retryPendingBatchRequest);
        document.addEventListener('visibilitychange', onVisibilityChange);
        retryPendingBatchRequest();

        return () => {
            window.removeEventListener('pageshow', retryPendingBatchRequest);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [mounted, isSignedIn, posthog]);

    useEffect(() => {
        if (mounted) {
            posthog?.capture('app_opened');
            setTimeout(() => {
                const resultsSection = document.getElementById('results-section');
                if (resultsSection) {
                    resultsSection.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
        }
    }, [mounted, posthog]);

    // Pricingセクションの表示を追跡（離脱ファネル分析用）
    useEffect(() => {
        if (!mounted || !posthog) return;
        const pricingEl = document.getElementById('pricing');
        if (!pricingEl) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    posthog.capture('pricing_viewed', { source: isPro ? 'pro_user' : 'free_user' });
                    observer.disconnect();
                }
            },
            { threshold: 0.3 }
        );
        observer.observe(pricingEl);
        return () => observer.disconnect();
    }, [mounted, posthog, isPro]);

    return (
        <div className="min-h-screen bg-slate-50 text-gray-900 font-sans selection:bg-purple-500/30 flex flex-col pt-4">
            {/* Header */}
            <header className="w-full flex justify-end items-center px-6 py-2">
                <div className="flex items-center gap-4">
                    {mounted && !isPro ? (
                        <button
                            type="button"
                            onClick={() => {
                                if (step !== 0) {
                                    setStep(0);
                                    window.setTimeout(() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }), 100);
                                    return;
                                }
                                document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="min-h-11 bg-gradient-to-r from-rose-500 to-[#D4A373] hover:from-purple-400 hover:to-indigo-500 text-gray-900 font-bold py-2 px-4 rounded-full flex items-center gap-2 text-sm transition-all shadow-[0_4px_20px_rgba(0,0,0,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                        >
                            <Gem size={16} className="text-[#D4A373]" />
                            Proにアップグレード
                        </button>
                    ) : mounted && isPro ? (
                        <div className="flex items-center gap-3">
                            <a
                                href="/approve"
                                className="bg-gradient-to-r from-purple-100 to-pink-100 hover:opacity-80 border border-purple-200 text-gray-900 py-2 px-4 rounded-full flex items-center gap-2 text-sm transition-all"
                            >
                                <Sparkles size={16} className="text-purple-500" />
                                今週の投稿を確認
                            </a>
                            <a
                                href="/dashboard"
                                className="bg-white/60 backdrop-blur-xl hover:bg-white/20 border border-rose-200 text-gray-900 py-2 px-4 rounded-full flex items-center gap-2 text-sm transition-all"
                            >
                                <History size={16} className="text-slate-500" />
                                過去の履歴
                            </a>
                            <button
                                onClick={handlePortal}
                                disabled={billingPortalAvailable === false}
                                className="bg-white/60 backdrop-blur-xl hover:bg-white/20 border border-rose-200 text-gray-900 py-2 px-4 rounded-full flex items-center gap-2 text-sm transition-all disabled:cursor-default disabled:opacity-80"
                            >
                                <Gem size={16} className="text-[#D4A373]" />
                                {billingPortalAvailable === false ? '運営者アカウント' : 'Proプラン管理'}
                            </button>
                        </div>
                    ) : (
                        <div className="w-32 h-8 rounded-full bg-white/80 animate-pulse"></div> // マウント前のプレースホルダー
                    )}

                    {mounted && isLoaded && isSignedIn ? (
                        <UserButton
                            afterSignOutUrl="/"
                            appearance={{ elements: { avatarBox: "w-11 h-11" } }}
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse border-2 border-transparent"></div>
                    )}
                </div>
            </header>

            {mounted && billingAttentionRequired && isPro && (
                <section
                    role="alert"
                    aria-labelledby="billing-attention-title"
                    className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-4xl flex-col gap-4 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={22} aria-hidden="true" />
                        <div>
                            <p id="billing-attention-title" className="font-bold">お支払い方法をご確認ください</p>
                            <p className="mt-1 text-sm leading-relaxed">
                                現在は引き続き利用できます。継続して使えるよう、カード情報をご確認ください。
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handlePortal}
                        className="min-h-11 shrink-0 rounded-full bg-amber-900 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
                    >
                        支払い方法を確認
                    </button>
                </section>
            )}

            {mounted && portalError && (
                <p
                    role="alert"
                    className="mx-auto mt-3 w-[calc(100%-2rem)] max-w-4xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                    {portalError}
                </p>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center mt-12 px-4 w-full">

                {step === 0 && (
                    <>
                        {/* Logo & Hero */}
                        <div className="flex flex-col items-center mb-16 mt-4 w-full max-w-4xl text-center">
                        {/* Circle Logo - Animated Glass */}
                            <div className="w-24 h-24 bg-white/80 backdrop-blur-xl rounded-full flex flex-col items-center justify-center mb-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200 relative group">
                                <div className="absolute inset-0 rounded-full border border-rose-200/50 shadow-[0_4px_15px_rgba(244,63,94,0.1)] group-hover:border-rose-400 transition-all duration-700 animate-[spin_10s_linear_infinite]"></div>
                                <span className="text-slate-800 text-[15px] tracking-[0.2em] font-light leading-tight relative z-10">DEARS</span>
                                <span className="text-slate-600 text-[9px] tracking-[0.1em] font-light mt-1 relative z-10">CONSULTING</span>
                            </div>

                            {/* Main Title & Hero Copy */}
                            <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000 fill-mode-both">
                                <h1 className="text-5xl md:text-7xl font-extrabold mb-4 tracking-tight drop-shadow-sm text-slate-900">
                                    SNS Agent<span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-[#D4A373]">24</span>
                                </h1>
                                <h2 className="text-2xl md:text-3xl font-bold mb-6 text-slate-700 tracking-wide">
                                    AIが、<span className="text-slate-800">あなた専属</span>のSNSマーケターに。
                                </h2>
                                <p className="text-slate-600 font-medium text-sm md:text-base max-w-2xl mx-auto leading-relaxed mb-10">
                                    高精度なトレンドリサーチから、ターゲットの深層心理を突くキャプション構築、
                                    そしてプロ品質のビジュアル合成まで。すべてを全自動で完結。
                                </p>
                            </div>

                            {/* Feature Badges - ポップで明るい3色グラデピル */}
                            <div className="flex flex-wrap justify-center gap-3 md:gap-4 w-full mb-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both">
                                {/* ① 最新トレンド解析 - シアン系 */}
                                <div className="group relative">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full blur opacity-40 group-hover:opacity-80 transition duration-500"></div>
                                    <div className="relative flex items-center gap-2.5 bg-white border border-cyan-100 pl-1.5 pr-5 py-1.5 rounded-full shadow-[0_4px_20px_rgba(6,182,212,0.15)]">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-md shadow-cyan-500/30">
                                            <Search size={15} className="text-white" strokeWidth={2.5} />
                                        </div>
                                        <span className="text-gray-800 text-xs md:text-sm font-bold tracking-wide">最新トレンドリアルタイム解析</span>
                                    </div>
                                </div>

                                {/* ② ターゲット深層心理 - パープル系 */}
                                <div className="group relative">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full blur opacity-40 group-hover:opacity-80 transition duration-500"></div>
                                    <div className="relative flex items-center gap-2.5 bg-white border border-purple-100 pl-1.5 pr-5 py-1.5 rounded-full shadow-[0_4px_20px_rgba(168,85,247,0.15)]">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-purple-500/30">
                                            <Brain size={15} className="text-white" strokeWidth={2.5} />
                                        </div>
                                        <span className="text-gray-800 text-xs md:text-sm font-bold tracking-wide">ターゲット深層心理プロファイリング</span>
                                    </div>
                                </div>

                                {/* ③ オリジナルバナー自動合成 - ローズ系 */}
                                <div className="group relative">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500 to-[#D4A373] rounded-full blur opacity-40 group-hover:opacity-80 transition duration-500"></div>
                                    <div className="relative flex items-center gap-2.5 bg-white border border-rose-100 pl-1.5 pr-5 py-1.5 rounded-full shadow-[0_4px_20px_rgba(244,63,94,0.15)]">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-[#D4A373] flex items-center justify-center shadow-md shadow-rose-500/30">
                                            <Palette size={15} className="text-white" strokeWidth={2.5} />
                                        </div>
                                        <span className="text-gray-800 text-xs md:text-sm font-bold tracking-wide">オリジナルSNSバナー完全自動合成</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Platforms selection */}
                        <div className="w-full max-w-2xl px-4 flex flex-col items-center min-h-[400px]">
                            {!mounted || !isLoaded ? (
                                <div className="flex flex-col items-center justify-center h-48">
                                    <div className="animate-spin border-4 border-purple-500 border-t-transparent rounded-full w-12 h-12 mb-4"></div>
                                    <p className="text-slate-800 font-medium text-sm">ユーザー情報を確認中...</p>
                                </div>
                            ) : !isSignedIn ? (
                                <div className="bg-white/60 backdrop-blur-xl backdrop-blur-xl border border-white shadow-lg border border-white shadow-lg shadow-[0_4px_15px_rgba(0,0,0,0.03)] rounded-2xl p-6 mb-10 w-full max-w-lg text-center shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500"></div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-2">
                                        <Zap size={20} className="text-yellow-400" />
                                        まずは無料でスタート
                                    </h3>
                                    <p className="text-slate-800 font-medium text-[13px] md:text-sm mb-6 leading-relaxed">
                                        最初から最後まで全自動でキャプションや画像を生成できる<br className="hidden md:block" />
                                        プロ向けAIエージェントを、登録から7日間は【完全無料・回数無制限】で体験できます。<br className="hidden md:block" />
                                        <span className="text-xs text-slate-600 mt-1 inline-block">（※8日目以降もずっと1日3回まで無料でご利用いただけます）</span>
                                    </p>

                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full px-4">
                                        <button
                                            onClick={() => openSignUp()}
                                            className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-gray-900 font-bold py-3.5 px-8 rounded-full transition-all shadow-[0_0_20px_rgba(219,39,119,0.4)] hover:shadow-[0_0_30px_rgba(219,39,119,0.6)] transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                                        >
                                            <Rocket size={18} />
                                            新規アカウント登録 (無料)
                                        </button>

                                        <button
                                            onClick={() => openSignIn()}
                                            className="w-full sm:w-auto bg-transparent border border-rose-200 text-gray-900 font-bold py-3.5 px-8 rounded-full hover:bg-white/60 backdrop-blur-xl transition-all"
                                        >
                                            ログイン
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-600 mt-4">
                                        ※登録でクレジットカード等は不要です
                                    </p>
                                </div>
                            ) : null}

                            <h2 className={`text-xl md:text-2xl font-bold mb-8 text-center drop-shadow-sm ${!mounted || !isLoaded ? 'opacity-0' : isSignedIn ? 'text-gray-900' : 'text-slate-600'}`}>
                                投稿するプラットフォーム
                            </h2>

                            <div className={`flex justify-center mb-16 w-full px-4 md:px-12 transition-all duration-500 ${!mounted || !isLoaded ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                                {/* Instagram - 公式ブランドカラーのグラデーション (黄→オレンジ→ピンク→紫→青) */}
                                <button
                                    onClick={() => setSelectedPlatform('instagram')}
                                    disabled={!mounted || !isLoaded || !isSignedIn}
                                    className="flex flex-col items-center justify-center py-8 px-12 rounded-[2rem] border-0 transition-all duration-300 group text-white shadow-[0_10px_35px_rgba(214,41,118,0.4)] hover:shadow-[0_15px_45px_rgba(150,47,191,0.5)] hover:-translate-y-0.5"
                                    style={{
                                        backgroundImage: 'linear-gradient(135deg, #FEDA75 0%, #FA7E1E 20%, #D62976 45%, #962FBF 75%, #4F5BD5 100%)'
                                    }}
                                >
                                    <Instagram size={36} className="mb-4 text-white drop-shadow-md" strokeWidth={1.5} />
                                    <span className="font-bold tracking-wide text-white text-sm drop-shadow-md">Instagram</span>
                                </button>
                            </div>

                            {/* モバイル専用機能についての事前警告（PCアクセス時の不満を防ぐ） */}
                            <div className={`w-full max-w-lg mb-8 p-4 bg-white/40 backdrop-blur-xl border border-white rounded-xl text-center shadow-sm transition-all duration-500 ${!mounted || !isLoaded ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                                <h4 className="text-slate-500 font-bold text-sm mb-1 flex items-center justify-center gap-2">
                                    <Smartphone className="w-5 h-5" /> iOS端末からのご利用を推奨
                                </h4>
                                <p className="text-slate-400 text-xs leading-relaxed font-medium">
                                    生成した画像の一括保存（カメラロールへのシェア機能等）は、<br className="hidden sm:block" />
                                    <strong className="text-slate-500">iOS端末専用</strong>の機能となっております。<br />
                                    <span className="text-[10px] text-slate-400">（※Android環境での動作は未確認のため推奨しておりません）</span><br />
                                    PC等で生成された場合、ダウンロード機能に制限がありますのでご注意ください。
                                </p>
                            </div>

                            <div className={`w-full max-w-4xl mb-2 transition-all duration-500 ${!mounted || !isLoaded ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                                <div className="text-center mb-4">
                                    <p className="text-xs font-bold tracking-[0.18em] text-slate-400">PLAN ACTION</p>
                                    <h3 className="text-lg md:text-xl font-bold text-slate-900 mt-1">作成方法を選ぶ</h3>
                                    <p className="text-xs text-slate-500 mt-2">
                                        <strong className="text-slate-700">Pro</strong> は1投稿ずつ作成。<strong className="text-rose-600">Pro Max</strong> はProの単発作成に加えて、1週間分の一括生成もできます。
                                    </p>
                                </div>
                                <div className={`grid gap-4 ${isProMax ? 'md:grid-cols-2' : 'max-w-md mx-auto'}`}>
                                    <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-sm px-6 py-5 text-left">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <PenTool size={16} className="text-slate-500" />
                                                <span className="text-xs font-bold tracking-widest text-slate-500">PRO</span>
                                            </div>
                                            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">基本機能</span>
                                        </div>
                                        <h4 className="text-base md:text-lg font-bold text-gray-900 mb-1">1投稿ずつ作成</h4>
                                        <p className="text-xs text-gray-500 leading-relaxed mb-4">
                                            投稿目的・ターゲット・文体を選び、1件ずつ投稿文と画像を作成します。細かく調整しながら作りたい時はこちらです。
                                        </p>
                                        <div className="space-y-2 mb-4">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                                <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                                                1件ずつ内容を見ながら作成
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                                <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                                                細かく調整したい投稿に向いています
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleStart}
                                            disabled={!mounted || !isLoaded || !isSignedIn}
                                            className={`w-full px-4 py-3 rounded-full text-sm font-bold transition-all duration-300 inline-flex items-center justify-center gap-2 ${!mounted || !isLoaded ? "opacity-0 scale-95" : isSignedIn ? "opacity-100 shadow-[0_10px_25px_rgba(15,23,42,0.18)] hover:shadow-[0_14px_34px_rgba(15,23,42,0.24)] hover:-translate-y-0.5 cursor-pointer bg-slate-900 text-white" : "opacity-40 cursor-not-allowed grayscale bg-slate-300 text-slate-500"}`}
                                        >
                                            <Instagram size={14} />
                                            {!mounted || !isLoaded ? '...' : isSignedIn ? '1投稿を作成する' : 'ログインしてください'}
                                            {isSignedIn && <ArrowRight size={14} />}
                                        </button>
                                    </div>

                                    {isProMax && !batchStatus && !batchCompleted && (
                                        <div className="bg-white/90 backdrop-blur-xl border-2 border-pink-200 rounded-2xl shadow-sm px-6 py-5 text-left relative overflow-hidden">
                                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 to-pink-600"></div>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <Sparkles size={16} className="text-rose-500" />
                                                    <span className="text-xs font-bold tracking-widest text-rose-500">PRO MAX</span>
                                                </div>
                                                <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-full">Pro機能 + 一括生成</span>
                                            </div>
                                            <h4 className="text-base md:text-lg font-bold text-gray-900 mb-1">単発作成も、一括生成も</h4>
                                            <p className="text-xs text-gray-500 leading-relaxed mb-4">
                                                Proの1投稿ずつ作成はそのまま使えます。さらに7件の投稿案をサーバー側でまとめて作成できます。
                                            </p>
                                            <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-3">
                                                <div className="flex items-center gap-2 text-xs font-bold text-rose-700 mb-2">
                                                    <CheckCircle2 size={15} className="text-rose-500 flex-shrink-0" />
                                                    Proの単発作成も利用できます
                                                </div>
                                                <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
                                                    <Sparkles size={15} className="text-rose-500 flex-shrink-0" />
                                                    さらに1週間分（7投稿）を一括生成できます
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleBatchGenerate('instagram')}
                                                disabled={loading}
                                                className="w-full px-4 py-3 rounded-full text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2"
                                            >
                                                <Instagram size={14} /> 1週間分（7投稿）を生成
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Pro Max ユーザー限定: 完了カード（バッチ生成成功直後） */}
                        {isProMax && !batchStatus && batchCompleted && (
                            <div className="w-full flex flex-col items-center mt-12 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="w-full max-w-md bg-gradient-to-br from-emerald-50 via-white to-emerald-50 border-2 border-emerald-300 rounded-2xl shadow-lg px-6 py-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <CheckCircle2 size={18} className="text-emerald-600" />
	                                        <span className="text-xs font-bold tracking-widest text-emerald-700">
	                                            {batchCompleted.ready ? '確認できます' : batchCompleted.started ? '生成中' : '生成完了'}
	                                        </span>
	                                    </div>
	                                    <h4 className="text-base md:text-lg font-bold text-gray-900 mb-1">
	                                        {batchCompleted.ready
	                                            ? `${batchCompleted.pendingCount || batchCompleted.count}件の投稿案を確認できます`
	                                            : batchCompleted.started
	                                                ? `${batchCompleted.count}件の投稿案を作成中です`
	                                            : `${batchCompleted.count}件の投稿案が生成されました`}
	                                    </h4>
	                                    <p className="text-xs text-gray-600 leading-relaxed mb-4">
	                                        {batchCompleted.ready ? (
	                                            <>
	                                                次は <strong>確認画面</strong> を開いてください。<br />
	                                                投稿文はすぐ確認でき、画像は確認画面で裏側生成されます。
	                                            </>
	                                        ) : batchCompleted.started ? (
	                                            <>
	                                                {batchCompleted.responseLost ? (
	                                                    <>
	                                                        画面の通信は切れましたが、生成はサーバー側で進んでいる可能性があります。<br />
	                                                        確認画面を開くと、投稿案ができるまで自動で確認します。
	                                                    </>
	                                                ) : (
	                                                    <>
	                                                        サーバー側で投稿案を作成しています。<br />
	                                                        ここで少し待つと、確認画面へ進めるボタンが有効になります。
	                                                    </>
	                                                )}
	                                                {batchCompleted.timedOut && (
	                                                    <>
	                                                        <br />時間がかかっています。確認画面を開くと自動更新で確認できます。
	                                                    </>
	                                                )}
	                                            </>
	                                        ) : (
	                                            <>
                                                次は <strong>確認画面</strong> を開いてください。<br />
                                                確認画面で<strong>AI画像の生成と文字合成が自動で実行</strong>されます (1件あたり ~30秒)。<br />
                                                画像生成完了後、内容を確認して承認 → 予約時刻 (毎日 12:00 JST) に自動投稿されます。
                                            </>
                                        )}
                                    </p>
	                                    {batchCompleted.ready || batchCompleted.timedOut || batchCompleted.responseLost ? (
	                                        <a
	                                            href="/approve"
	                                            className="w-full px-4 py-3 rounded-full text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2 shadow-md"
	                                        >
	                                            <Sparkles size={14} /> 今週の投稿を確認する <ArrowRight size={14} />
	                                        </a>
	                                    ) : (
	                                        <button
	                                            type="button"
	                                            disabled
	                                            className="w-full px-4 py-3 rounded-full text-sm font-bold bg-gray-300 text-gray-500 inline-flex items-center justify-center gap-2"
	                                        >
	                                            <RefreshCw size={14} className="animate-spin" /> 投稿案を作成中
	                                        </button>
	                                    )}
	                                    <button
	                                        onClick={() => handleBatchGenerate('instagram')}
	                                        disabled={loading || (batchCompleted.started && !batchCompleted.ready)}
	                                        className="w-full mt-2 px-4 py-2 rounded-full text-xs text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
	                                    >
                                        または、もう一度生成する
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Pro Max のバッチ生成中ステータス表示（再生成ボタンから呼ばれた場合に表示） */}
                        {isProMax && batchStatus && (
                            <div className="w-full max-w-md mx-auto mt-4 px-5 py-5 bg-black/60 shadow-inner backdrop-blur-xl rounded-2xl border border-cyan-500/40 relative overflow-hidden">
                                <div
                                    className="absolute top-0 left-0 h-1 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500"
                                    style={{ width: `${loadingProgress}%`, transition: 'width 0.5s ease-out' }}
                                ></div>
                                <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent animate-pulse-scan pointer-events-none"></div>
                                <div className="flex flex-col items-center justify-center gap-4 relative z-10">
                                    <div className="relative w-10 h-10 flex items-center justify-center">
                                        <div className="absolute inset-0 rounded-full border-[3px] border-t-cyan-400 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                                        <div className="absolute inset-1 rounded-full border-[3px] border-b-purple-400 border-r-transparent border-t-transparent border-l-transparent animate-[spin_1.5s_linear_infinite_reverse]"></div>
                                        <div className="w-3 h-3 bg-cyan-300 rounded-full animate-ping opacity-80"></div>
                                    </div>
                                    <p className="text-sm md:text-base text-cyan-50 text-center font-bold tracking-wide animate-pulse">
                                        {batchStatus}
                                    </p>
                                </div>
                            </div>
                        )}

                    </>
                )}

                {step === 1 && (
                    <div className="w-full max-w-2xl px-4 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="w-full flex items-center mb-8">
                            <button type="button" onClick={() => setStep(0)} disabled={loading} className={`min-h-11 px-2 -ml-2 text-slate-800 font-medium hover:text-gray-900 flex items-center gap-1 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg ${loading ? 'opacity-0 cursor-default' : 'opacity-100'}`}>
                                <ChevronLeft size={20} /> <span className="text-sm">戻る</span>
                            </button>
                        </div>

                        {loading ? (
                            <div className="w-full flex flex-col items-center justify-center py-6 animate-in fade-in zoom-in duration-700">
                                {/* インジケーター＆スピナー部分 */}
                                <div className="relative w-48 h-48 mb-6 flex items-center justify-center">
                                    {/* 外側の高速回転データリング */}
                                    <div className="absolute inset-0 rounded-full border border-t-[3px] border-r-transparent border-b-transparent border-l-transparent border-cyan-400 animate-spin-fast shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
                                    <div className="absolute inset-1 rounded-full border border-b-[3px] border-t-transparent border-r-transparent border-l-transparent border-pink-500 animate-[spin_2s_linear_infinite_reverse] shadow-[0_0_15px_rgba(236,72,153,0.5)]"></div>
                                    <div className="absolute inset-5 rounded-full border border-dashed border-white animate-[spin_6s_linear_infinite]"></div>
                                    <div className="absolute inset-8 rounded-full border-[0.5px] border-white shadow-lg"></div>

                                    {/* パルス（波紋）エフェクト */}
                                    <div className="absolute inset-4 rounded-full border border-cyan-400/30 animate-ping"></div>

                                    {/* 中央の「AI・データ解析」コア部分 */}
                                    <div className="absolute w-28 h-28 bg-gradient-to-tr from-purple-900 via-indigo-900 to-black rounded-full shadow-[0_0_50px_rgba(6,182,212,0.8)] flex flex-col items-center justify-center overflow-hidden border border-cyan-500/30">
                                        {/* スキャンラインエフェクト */}
                                        <div className="absolute w-full h-[2px] bg-cyan-400 opacity-90 blur-[1px] shadow-[0_0_15px_#06b6d4] animate-pulse-scan top-0 bottom-0 m-auto"></div>

                                        {/* HUDプログレス表示 (0〜100%) */}
                                        <div className="relative z-10 flex flex-col items-center justify-center">
                                            <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-cyan-200 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] tabular-nums tracking-tighter">
                                                {loadingProgress}
                                                <span className="text-sm text-[#D4A373] opacity-80">%</span>
                                            </span>
                                            <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#D4A373] mt-1 opacity-80">
                                                Processing
                                            </span>
                                        </div>
                                    </div>

                                    {/* 周囲のデータパーティクル（疑似） */}
                                    <div className="absolute top-0 right-8 w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_10px_#06b6d4] animate-ping"></div>
                                    <div className="absolute bottom-4 left-4 w-1.5 h-1.5 bg-pink-500 rounded-full shadow-[0_0_10px_#ec4899] animate-ping animation-delay-500"></div>
                                    <div className="absolute top-1/2 -right-4 w-1 h-1 bg-purple-400 rounded-full shadow-[0_0_8px_#a855f7] animate-pulse"></div>
                                </div>

                                <h3 className="text-xl font-black tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 mb-8 animate-pulse text-center drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                                    AI SYNC IN PROGRESS
                                </h3>

                                <div className="w-full flex border h-4 mt-8 rounded-full border-rose-200">
                                    <div className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(168,85,247,0.8)]" style={{ width: `${loadingProgress}%` }}></div>
                                </div>

                                {/* ランダムな解析ダミーログ表示コンソール */}
                                <div className="w-full mt-6 bg-black/80 border border-green-500/30 rounded-lg p-3 h-28 overflow-hidden relative shadow-[inset_0_0_20px_rgba(0,0,0,1)]">
                                    {/* background progress */}
                                    <div
                                        className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-cyan-900/20 to-purple-900/20 transition-all duration-300 ease-out"
                                        style={{ width: `${loadingProgress}%` }}
                                    ></div>
                                    <div className="absolute top-0 left-0 w-full h-[1px] bg-green-500/20"></div>
                                    <div className="flex flex-col justify-end h-full">
                                        {terminalLogs.map((log, i) => (
                                            <div key={i} className={`font-mono text-[10px] md:text-xs text-green-400/90 leading-relaxed ${i === terminalLogs.length - 1 ? 'animate-pulse text-green-300 font-bold' : 'opacity-70'}`}>
                                                {log}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="absolute bottom-0 left-0 w-full h-[1px] bg-green-500/20"></div>
                                </div>

                                <div className="w-full max-w-sm mt-8">
                                    <div className="flex flex-col space-y-4 font-medium text-sm text-gray-700 relative z-10 w-full">
                                        {/* Phase 1 */}
                                        <div className={`flex items-start gap-4 transition-all duration-700 ${loadingPhase >= 0 ? 'opacity-100' : 'opacity-30 blur-[1px]'}`}>
                                            <div className="mt-1 relative flex items-center justify-center w-3 h-3">
                                                {loadingPhase === 0 && <span className="absolute w-full h-full rounded-full bg-cyan-500 opacity-75 animate-ping"></span>}
                                                <span className={`relative w-2 h-2 rounded-full ${loadingPhase >= 0 ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-gray-600'}`}></span>
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-bold mb-0.5 ${loadingPhase >= 0 ? 'text-gray-900' : 'text-slate-600'}`}>1. 市場・競合リサーチ中</p>
                                                <p className="text-[11px] text-slate-800 font-medium leading-tight">指定プラットフォームの最新トレンドデータと検索ボリュームを抽出</p>
                                            </div>
                                        </div>

                                        {/* Phase 2 */}
                                        <div className={`flex items-start gap-4 transition-all duration-700 ${loadingPhase >= 1 ? 'opacity-100' : 'opacity-30 blur-[1px]'}`}>
                                            <div className="mt-1 relative flex items-center justify-center w-3 h-3">
                                                {loadingPhase === 1 && <span className="absolute w-full h-full rounded-full bg-blue-500 opacity-75 animate-ping"></span>}
                                                <span className={`relative w-2 h-2 rounded-full ${loadingPhase >= 1 ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-gray-600'}`}></span>
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-bold mb-0.5 ${loadingPhase >= 1 ? 'text-gray-900' : 'text-slate-600'}`}>2. ユーザー心理プロファイリング</p>
                                                <p className="text-[11px] text-slate-800 font-medium leading-tight">ターゲット情報から深層心理・行動パターンを解析中</p>
                                            </div>
                                        </div>

                                        {/* Phase 3 */}
                                        <div className={`flex items-start gap-4 transition-all duration-700 ${loadingPhase >= 2 ? 'opacity-100' : 'opacity-30 blur-[1px]'}`}>
                                            <div className="mt-1 relative flex items-center justify-center w-3 h-3">
                                                {loadingPhase === 2 && <span className="absolute w-full h-full rounded-full bg-purple-500 opacity-75 animate-ping"></span>}
                                                <span className={`relative w-2 h-2 rounded-full ${loadingPhase >= 2 ? 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]' : 'bg-gray-600'}`}></span>
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-bold mb-0.5 ${loadingPhase >= 2 ? 'text-gray-900' : 'text-slate-600'}`}>3. コアバリュー最適化</p>
                                                <p className="text-[11px] text-slate-800 font-medium leading-tight">貴社・サービス情報を独自の強み（USP）に変換・統合</p>
                                            </div>
                                        </div>

                                        {/* Phase 4 */}
                                        <div className={`flex items-start gap-4 transition-all duration-700 ${loadingPhase >= 3 ? 'opacity-100' : 'opacity-30 blur-[1px]'}`}>
                                            <div className="mt-1 relative flex items-center justify-center w-3 h-3">
                                                {loadingPhase === 3 && <span className="absolute w-full h-full rounded-full bg-pink-500 opacity-75 animate-ping"></span>}
                                                <span className={`relative w-2 h-2 rounded-full ${loadingPhase >= 3 ? 'bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.8)]' : 'bg-gray-600'}`}></span>
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-bold mb-0.5 ${loadingPhase >= 3 ? 'text-gray-900' : 'text-slate-600'}`}>4. コピーライティング構築</p>
                                                <p className="text-[11px] text-slate-800 font-medium leading-tight">エンゲージメントを最大化する構文とハッシュタグを生成中</p>
                                            </div>
                                        </div>

                                        {/* Phase 5 */}
                                        <div className={`flex items-start gap-4 transition-all duration-700 ${loadingPhase >= 4 ? 'opacity-100' : 'opacity-30 blur-[1px]'}`}>
                                            <div className="mt-1 relative flex items-center justify-center w-3 h-3">
                                                {loadingPhase === 4 && <span className="absolute w-full h-full rounded-full bg-rose-500 opacity-75 animate-ping"></span>}
                                                <span className={`relative w-2 h-2 rounded-full ${loadingPhase >= 4 ? 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]' : 'bg-gray-600'}`}></span>
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-bold mb-0.5 ${loadingPhase >= 4 ? 'text-gray-900' : 'text-slate-600'}`}>5. ビジュアルクリエイティブ合成</p>
                                                <p className="text-[11px] text-slate-800 font-medium leading-tight">コンテキストに最適化した高精細クリエイティブを最終出力</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-64 h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent mt-12 animate-pulse"></div>
                                <p className="text-xs text-slate-600 mt-4">※高精度な解析と画像生成を行うため、通常50〜60秒ほどかかります。そのままお待ちください。</p>
                            </div>
                        ) : (
                            <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-500 gap-2">
                                {generationRecoveryNotice && (
                                    <div className="w-full mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-left shadow-sm">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-amber-900 mb-1">通信が一時的に切れました</p>
                                                <p className="text-xs text-amber-800 leading-relaxed">{generationRecoveryNotice}</p>
                                                <button
                                                    type="button"
                                                    onClick={handleGenerate}
                                                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition-colors"
                                                >
                                                    <RefreshCw size={14} /> もう一度生成する
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <CategorySelector selected={{ id: selectedCategory }} onSelect={(c) => setSelectedCategory(c.id)} />
                                <PurposeSelector selected={selectedPurpose} onSelect={setSelectedPurpose} />
                                <TargetSelector selected={selectedTarget} onSelect={setSelectedTarget} isPro={isPro} />
                                <GenderSelector selected={selectedGender} onSelect={setSelectedGender} />
                                <BusinessStyleSelector selected={selectedBusinessStyle} onSelect={setSelectedBusinessStyle} />
                                <ToneSelector selected={selectedTone} onSelect={setSelectedTone} />
                                <FormatSelector selected={selectedFormat} onSelect={setSelectedFormat} isPro={isPro} />
                                <OverlayLanguageSelector selected={selectedOverlayLanguage} onSelect={setSelectedOverlayLanguage} />
                                <LanguageSelector selected={selectedLanguage} onSelect={setSelectedLanguage} isPro={isPro} />
                                <ProductInput value={productContext} onChange={setProductContext} />

                                <div className="mt-8 mb-16 flex w-full flex-col items-center gap-4">
                                    {generationError && (
                                        <div
                                            id="generation-error"
                                            role="alert"
                                            aria-live="assertive"
                                            className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-left shadow-sm"
                                        >
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle size={20} className="mt-0.5 flex-shrink-0 text-rose-600" aria-hidden="true" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-rose-950">{generationError.title}</p>
                                                    <p className="mt-1 text-sm leading-relaxed text-rose-800">{generationError.message}</p>
                                                    {generationError.showUpgrade && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setStep(0);
                                                                window.setTimeout(() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }), 100);
                                                            }}
                                                            className="mt-3 inline-flex min-h-11 items-center rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                                                        >
                                                            料金プランを見る
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleGenerate}
                                        aria-describedby={generationError ? 'generation-error' : undefined}
                                        className="w-[320px] h-16 rounded-full overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.25)] hover:scale-105 hover:-translate-y-1 transition-all duration-300 text-white font-extrabold tracking-widest text-lg flex items-center justify-center gap-3 bg-slate-900 border border-slate-700/50"
                                    >
                                        <Sparkles size={22} className="text-white" />
                                        生成する
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {step === 2 && result && (
                    <div className="w-full max-w-3xl px-4 flex flex-col items-center animate-in fade-in duration-500">
                        <div className="w-full flex items-center mb-8">
                            <button type="button" onClick={() => { setStep(0); setResult(null); }} className="min-h-11 px-2 -ml-2 text-slate-800 font-medium hover:text-gray-900 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg">
                                <ChevronLeft size={20} /> <span className="text-sm">トップに戻る</span>
                            </button>
                        </div>

                        <h2 className="text-2xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                            生成が完了しました！
                        </h2>

                        <p role="note" className="mb-6 w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
                            AIが公開情報をもとに作成した参考案です。数値や固有情報は、投稿前に一次情報をご確認ください。
                        </p>

                        <div className="mb-6 w-full rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
                                <BrainCircuit size={20} /> 3D AIトレンドリサーチ
                            </h3>

                            <div className="space-y-4">
                                <div className="bg-white/90 border border-slate-200 shadow-sm text-slate-800 p-4 rounded-xl border border-white shadow-lg/5">
                                    <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
                                        <Globe size={16} className="text-rose-600" /> ① 世の中の大きなトレンド
                                    </h4>
                                    <p className="text-slate-800 font-medium text-sm leading-relaxed">{result.research.insight_macro}</p>
                                </div>
                                <div className="bg-white/90 border border-slate-200 shadow-sm text-slate-800 p-4 rounded-xl border border-white shadow-lg/5">
                                    <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
                                        <Building size={16} className="text-rose-600" /> ② 業界内でのトレンド
                                    </h4>
                                    <p className="text-slate-800 font-medium text-sm leading-relaxed">{result.research.insight_industry}</p>
                                </div>
                                <div className="bg-white/90 border border-slate-200 shadow-sm text-slate-800 p-4 rounded-xl border border-white shadow-lg/5">
                                    <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
                                        <Target size={16} className="text-rose-600" /> ③ ターゲット層のトレンド
                                    </h4>
                                    <p className="text-slate-800 font-medium text-sm leading-relaxed">{result.research.insight_target}</p>
                                </div>

                                <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
                                    <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-950">
                                        <Lightbulb size={16} className="text-blue-700" /> 統合インサイト（今回のアプローチ方針）
                                    </h4>
                                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                                        {result.research.insight_summary}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6 w-full rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
                                <PenTool size={20} className="text-rose-600" /> 生成されたキャプション {selectedFormat === 'video_script' && '（投稿文用）'}
                            </h3>
                            <div className="bg-white/90 border border-slate-200 shadow-sm text-slate-800 border border-white shadow-lg/5 p-4 rounded-xl mb-4 text-sm leading-relaxed whitespace-pre-wrap">
                                {result.post.caption}
                                {'\n\n'}
                                <span className="text-[#D4A373]">
                                    {(result.post.hashtags || []).map(t => t.startsWith('#') ? t : `#${t}`).join(' ')}
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(result.post.caption + '\n\n' + (result.post.hashtags || []).map(t => t.startsWith('#') ? t : `#${t}`).join(' '));
                                    posthog?.capture('content_copied', { format: selectedFormat });
                                    alert('コピーしました！');
                                }}
                                className="flex w-full flex-row items-center justify-center gap-2 rounded-lg bg-slate-900 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                            >
                                <Copy size={16} /> キャプションをコピー
                            </button>
                        </div>

                        <div className="mb-8 w-full rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                            {selectedFormat === 'video_script' ? (
                                <>
                                    <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
                                        <ImageIcon size={20} className="text-rose-600" /> ショート動画台本 (TikTok / Reels / Shorts)
                                    </h3>
                                    <p className="text-xs text-slate-600 mb-4">{result.post.image_idea}</p>

                                    <div className="space-y-4">
                                        {(result.post.video_script || []).map((script, idx) => (
                                            <div key={idx} className="bg-white/90 border border-slate-200 shadow-sm text-slate-800 border border-white shadow-lg shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-xl p-4 flex flex-col gap-2">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-xs font-bold">{script.time}</span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <h5 className="text-[10px] font-bold text-slate-800 font-medium mb-1">【映像・音声】</h5>
                                                        <p className="text-sm font-medium text-gray-900 mb-2 max-w-full">
                                                            <span className="text-blue-500 font-bold">[音声] </span>{script.audio}
                                                        </p>
                                                        <p className="text-xs text-slate-800 font-medium">
                                                            <span className="text-slate-600 font-bold">[映像] </span>{script.visual}
                                                        </p>
                                                    </div>
                                                    <div className="bg-white/90 border border-slate-200 shadow-sm text-slate-8000 p-3 rounded-lg border border-white shadow-lg/5">
                                                        <h5 className="text-[10px] font-bold text-slate-800 font-medium mb-1">【画面テロップ】</h5>
                                                        <p className="text-sm font-bold text-center text-yellow-300 drop-shadow-md py-4">{script.text_overlay}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
                                        <ImageIcon size={20} className="text-rose-600" /> {selectedFormat === 'carousel' ? 'カルーセル用 画像一覧' : 'AI生成画像'}
                                    </h3>
                                    <p className="text-xs text-slate-600 mb-4">{result.post.image_idea}</p>

                                    {/* 複数枚画像コンテナ (スマホでは縦積み100%幅、PC等ではFlex横並び) */}
                                    <div className="w-full flex flex-col md:flex-row md:flex-wrap justify-center gap-6 pb-4">
                                        {result.imageUrls && result.imageUrls.length > 0 ? (
                                            result.imageUrls.map((url, idx) => (
                                                <div key={idx} className="w-full md:w-[45%] lg:w-[30%] aspect-square bg-[#1a1a1a] rounded-xl overflow-hidden relative shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-white shadow-lg shadow-[0_8px_30px_rgb(0,0,0,0.06)] mx-auto">
                                                    <NextImage
                                                        src={url}
                                                        alt={`AIが生成した投稿画像 ${idx + 1}枚目`}
                                                        fill
                                                        sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
                                                        className="object-cover"
                                                        unoptimized
                                                    />

                                                    {selectedFormat === 'carousel' && (
                                                        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-gray-900 text-xs px-2 py-1 rounded-md font-bold border border-rose-200">
                                                            {idx + 1}枚目
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="w-full aspect-square flex items-center justify-center text-slate-600 text-sm bg-white/90 border border-slate-200 shadow-sm text-slate-800 rounded-xl">画像生成に失敗しました（または制限）</div>
                                        )}
                                    </div>
                                </>
                            )}

                            {result.imageUrls && result.imageUrls.length > 0 && selectedFormat !== 'video_script' && !result.imageUrls[0].startsWith('http') && (
                                <>
                                    <button
                                        onClick={async (e) => {
                                            posthog?.capture('image_download_clicked', { format: selectedFormat });
                                            // 全画像をZIPか複数回ダウンロードさせる実装も可能だが、現状は代表して1枚目をロゴ画像合成付きでDL
                                            // カルーセル複数枚の場合は別途機能追加余地あり。今回は1枚目のダウンロード機能として維持
                                            const targetIndex = 0;
                                            if (productContext?.logoUrl && !productContext.baseImage) {
                                                const btn = e.currentTarget;
                                                const prevText = btn.innerHTML;
                                                btn.innerHTML = '<span class="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4 mr-2"></span>合成中...';
                                                try {
                                                    const canvas = document.createElement('canvas');
                                                    const ctx = canvas.getContext('2d');
                                                    const mainImg = new Image();
                                                    mainImg.crossOrigin = 'anonymous';
                                                    await new Promise((res, rej) => { mainImg.onload = res; mainImg.onerror = rej; mainImg.src = result.imageUrls[targetIndex]; });

                                                    canvas.width = mainImg.width;
                                                    canvas.height = mainImg.height;
                                                    ctx.drawImage(mainImg, 0, 0);

                                                    const logoImg = new Image();
                                                    await new Promise((res, rej) => { logoImg.onload = res; logoImg.onerror = rej; logoImg.src = productContext.logoUrl; });

                                                    const maxLogoW = canvas.width * 0.25;
                                                    const maxLogoH = canvas.height * 0.25;
                                                    const size = Math.min(maxLogoW, maxLogoH, logoImg.width, logoImg.height);
                                                    const padding = canvas.width * 0.04;

                                                    const cw = canvas.width;
                                                    const ch = canvas.height;
                                                    const r = size / 2;
                                                    const cx = cw - padding - r;
                                                    const cy = ch - padding - r;

                                                    ctx.save();
                                                    ctx.globalAlpha = 0.95;
                                                    ctx.shadowColor = 'rgba(0,0,0,0.5)';
                                                    ctx.shadowBlur = 15;
                                                    ctx.shadowOffsetX = 2;
                                                    ctx.shadowOffsetY = 2;

                                                    ctx.beginPath();
                                                    ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
                                                    ctx.fillStyle = 'rgba(20,20,20,0.5)';
                                                    ctx.fill();
                                                    ctx.restore();

                                                    ctx.save();
                                                    ctx.beginPath();
                                                    ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
                                                    ctx.clip();
                                                    ctx.drawImage(logoImg, cx - r, cy - r, size, size);
                                                    ctx.restore();

                                                    ctx.save();
                                                    ctx.beginPath();
                                                    ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
                                                    ctx.lineWidth = 2;
                                                    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                                                    ctx.stroke();
                                                    ctx.restore();

                                                    const a = document.createElement('a');
                                                    a.href = canvas.toDataURL('image/jpeg', 0.95);
                                                    a.download = `sns-image-with-logo-${Date.now()}.jpg`;
                                                    a.click();
                                                } catch (err) {
                                                    console.error(err);
                                                    alert("ロゴ画像の合成に失敗しました");
                                                } finally {
                                                    btn.innerHTML = prevText;
                                                }
                                            } else {
                                                // 複数枚ある場合はスマホのネイティブ共有機能(カメラロールへ保存可)か個別ダウンロードを行う
                                                const btn = e.currentTarget;
                                                const prevText = btn.innerHTML;
                                                btn.innerHTML = '<span class="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4 mr-2"></span>画像を準備中...';
                                                btn.disabled = true;

                                                try {
                                                    console.log("Starting multi-image processing...", result.imageUrls.length, "images");
                                                    const files = [];

                                                    // 1. 各画像のBlobを取得し、Fileオブジェクトに変換する
                                                    for (let i = 0; i < result.imageUrls.length; i++) {
                                                        const url = result.imageUrls[i];
                                                        console.log(`Fetching image ${i + 1}...`);

                                                        let blob;
                                                        if (url.startsWith('data:image')) {
                                                            const res = await fetch(url);
                                                            blob = await res.blob();
                                                        } else {
                                                            // CORSエラーを防ぐためプロキシAPIを経由
                                                            const proxyUrl = `/api/download?url=${encodeURIComponent(url)}`;
                                                            const res = await fetch(proxyUrl);
                                                            if (!res.ok) {
                                                                throw new Error(`Proxy HTTP error! status: ${res.status}`);
                                                            }
                                                            blob = await res.blob();
                                                        }

                                                        const file = new File([blob], `sns-image-${i + 1}.jpg`, { type: blob.type || 'image/jpeg' });
                                                        files.push(file);
                                                    }

                                                    // スマホ(iOS/Android等)かPCかを簡易判定する
                                                    console.log("Checking Device & Web Share API compatibility...");
                                                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

                                                    if (!isMobile) {
                                                        alert("画像のダウンロード機能はスマートフォン環境（iOS/Android）のみ対応しています。\nPCをご利用の場合は、恐れ入りますがスマートフォンからアクセスし直して保存をお願いいたします。");
                                                        return;
                                                    }

                                                    // 2. スマホかつWeb Share APIが利用可能な場合のみ「〜枚の画像を保存」を呼び出す
                                                    if (navigator.canShare && navigator.canShare({ files: files })) {
                                                        try {
                                                            await navigator.share({
                                                                files: files,
                                                                title: 'SNS Agent24 カルーセル画像'
                                                            });
                                                            console.log("Shared successfully via Web Share API.");
                                                        } catch (shareErr) {
                                                            console.error("Web Share API error or cancelled:", shareErr);
                                                            // ユーザーのキャンセル(AbortError)以外で失敗した場合のアラート
                                                            if (shareErr.name !== 'AbortError') {
                                                                alert("お使いの端末・ブラウザでは一括保存機能がサポートされていないか、エラーが発生しました。");
                                                            }
                                                        }
                                                    } else {
                                                        // スマホだがWeb Share API非対応の場合のアラート
                                                        alert("お使いのブラウザは画像の一括保存（シェア機能）に対応していません。\nSafariやChromeなどの標準ブラウザをご利用ください。");
                                                    }
                                                } catch (err) {
                                                    console.error("Multi-image generation/download error:", err);
                                                    alert("画像の一括準備・ダウンロード中にエラーが発生しました。コンソールをご確認ください。");
                                                } finally {
                                                    btn.innerHTML = prevText;
                                                    btn.disabled = false;
                                                    console.log("Download process finished.");
                                                }
                                            }
                                        }}
                                        className="w-full py-3 mt-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 rounded-lg text-sm font-bold flex flex-row items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Download size={16} /> {selectedFormat === 'carousel' ? 'すべての画像をダウンロード' : '画像をダウンロード'}
                                    </button>
                                    <p className="text-[11px] text-slate-800 font-medium mt-2 text-center leading-relaxed">
                                        ※画像保存（シェア機能）は<strong className="text-gray-700">スマートフォン専用</strong>です。<br />
                                        PC等をご利用の方は、お手数ですがスマホから再度ご確認ください。
                                    </p>
                                </>
                            )}
                        </div>

                        {/* フォローアップ導線（Next Action） */}
                        <div className="w-full bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-2xl p-6 mb-8 shadow-[0_0_30px_rgba(99,102,241,0.15)] relative overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700 delay-500 fill-mode-both">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -ml-8 -mb-8 pointer-events-none"></div>

                            <div className="relative z-10">
                                <h3 className="text-xl font-bold mb-2 flex items-center justify-center gap-2 text-gray-900">
                                    <Rocket size={24} className="text-slate-500" /> 次にやること（Next Action）
                                </h3>
                                <p className="text-center text-indigo-200 text-sm mb-6">
                                    AIが生成した最高のコンテンツを、今すぐ世界に届けましょう！
                                </p>

                                <div className="space-y-3 mb-6 max-w-lg mx-auto">
                                    <div className="flex items-center gap-3 bg-white/90 border border-slate-200 shadow-sm text-slate-800 border border-white shadow-lg shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-3 rounded-xl">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-sm">1</div>
                                        <div className="flex-1 text-sm text-gray-200">画像をダウンロードする</div>
                                        <Download size={16} className="text-slate-600" />
                                    </div>
                                    <div className="flex items-center gap-3 bg-white/90 border border-slate-200 shadow-sm text-slate-800 border border-white shadow-lg shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-3 rounded-xl">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-sm">2</div>
                                        <div className="flex-1 text-sm text-gray-200">キャプションとハッシュタグをコピーする</div>
                                        <Copy size={16} className="text-slate-600" />
                                    </div>
                                    <div className="flex items-center gap-3 bg-indigo-500/20 border border-indigo-500/30 p-3 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500 text-gray-900 flex items-center justify-center font-bold text-sm shadow-lg border border-indigo-400">3</div>
                                        <div className="flex-1 text-sm font-bold text-gray-900">アプリを開いて貼り付け、投稿を完了する！</div>
                                        <Zap size={16} className="text-yellow-400 animate-pulse" />
                                    </div>
                                </div>

                                <div className="max-w-lg mx-auto">
                                    <button
                                        onClick={() => {
                                            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                                            if (isMobile) {
                                                // スマホの場合はまずアプリ起動を試みる
                                                window.location.href = 'instagram://camera';
                                                // 起動しなかった場合のための保険（数秒後にWeb版を開く）
                                                setTimeout(() => {
                                                    window.open('https://www.instagram.com/', '_blank');
                                                }, 2000);
                                            } else {
                                                // PCの場合は最初からWeb版を開く
                                                window.open('https://www.instagram.com/', '_blank');
                                            }
                                        }}
                                        className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl text-md font-bold text-gray-900 flex flex-row items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:shadow-[0_0_30px_rgba(147,51,234,0.6)] transform hover:-translate-y-1"
                                    >
                                        <Instagram size={20} />
                                        Instagramを開いて投稿する
                                    </button>
                                    <p className="text-[11px] text-center text-indigo-300/60 mt-3">
                                        ※スマホでアプリがインストールされている場合は直接起動します
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* 料金比較は作成開始前だけ表示し、入力・結果確認に集中できるようにする */}
            {step === 0 && <div id="pricing" className="w-full mt-24 mb-12 flex flex-col items-center">
                {checkoutError && (
                    <div className="bg-red-500/20 border border-red-500 text-red-100 p-4 rounded-lg mb-8 max-w-2xl w-full mx-4 text-center">
                        <p className="font-bold">決済画面への移動に失敗しました</p>
                        <p className="text-sm mt-1">{checkoutError}</p>
                    </div>
                )}
                {isCheckoutLoading && (
                    <div className="text-slate-500 mb-8 max-w-2xl w-full mx-4 text-center animate-pulse">
                        <p className="font-bold">決済画面の準備中です...</p>
                        <p className="text-sm mt-1">Stripeと通信しています。そのままお待ちください。</p>
                    </div>
                )}
                <PricingSection onUpgrade={handleCheckout} isPro={isPro} isProMax={isProMax} />
            </div>}

            {/* Footer */}
            <footer className="w-full text-center pb-8 pt-12 flex flex-col items-center gap-1">
                <div className="text-slate-600 text-xs font-medium tracking-wide">
                    SNS Agent24 v2.3 | © 2026 DEARS CONSULTING
                </div>
                <a
                    href="https://dearsconsulting.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center px-2 text-[#E0455B] hover:text-[#FF6B80] text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg"
                >
                    https://dearsconsulting.com/
                </a>
            </footer >

            {/* Profile Setup Modal */}
            <ProfileSetupModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                user={user}
            />

            {/* Pro Max Plan 個別相談モーダル */}
            <ProMaxInquiryModal
                isOpen={proMaxInquiryOpen}
                onClose={() => setProMaxInquiryOpen(false)}
                defaultEmail={user?.emailAddresses?.[0]?.emailAddress || ''}
                defaultName={user?.fullName || ''}
            />
        </div >
    );
}
