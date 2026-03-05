"use client";
import React, { useState, useEffect } from 'react';
import { Gem, Instagram, Twitter, Facebook, Sparkles, Download, Copy, RefreshCw, ChevronLeft, Globe, Building, Target, Lightbulb, PenTool, ImageIcon, BrainCircuit } from 'lucide-react';
import { UserButton, useUser, useClerk, useSession } from "@clerk/nextjs";
import PricingSection from '@/components/layout/PricingSection';
import { CategorySelector, TargetSelector, GenderSelector, BusinessStyleSelector, ToneSelector, LanguageSelector, ProductInput } from '@/components/features/Selectors';
import { researchTrends, generatePost, generateImage, scrapeWebsite } from '@/lib/apiService';

export default function Home() {
    const { user, isLoaded, isSignedIn } = useUser();
    const { session } = useSession();
    const { openSignIn, openSignUp } = useClerk();

    // JWTトークン内のメタデータ（ユーザー自身またはカスタムクレーム）を確実に取得
    const sessionRole = session?.user?.publicMetadata?.role || null;
    const isPro = sessionRole === 'pro' || user?.publicMetadata?.role === 'pro';

    const [step, setStep] = useState(0); // 0: Platform, 1: Process, 2: Result
    const [selectedPlatform, setSelectedPlatform] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [selectedGender, setSelectedGender] = useState(null);
    const [selectedBusinessStyle, setSelectedBusinessStyle] = useState(null);
    const [selectedTone, setSelectedTone] = useState(null);
    const [selectedLanguage, setSelectedLanguage] = useState('ja'); // デフォルトは日本語
    const [productContext, setProductContext] = useState({});

    const [isStateLoaded, setIsStateLoaded] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('snsAgent24_formState');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.selectedPlatform) setSelectedPlatform(parsed.selectedPlatform);
                if (parsed.selectedCategory) setSelectedCategory(parsed.selectedCategory);
                if (parsed.selectedTarget) setSelectedTarget(parsed.selectedTarget);
                if (parsed.selectedGender) setSelectedGender(parsed.selectedGender);
                if (parsed.selectedBusinessStyle) setSelectedBusinessStyle(parsed.selectedBusinessStyle);
                if (parsed.selectedTone) setSelectedTone(parsed.selectedTone);
                if (parsed.selectedLanguage) setSelectedLanguage(parsed.selectedLanguage);
                if (parsed.productContext) setProductContext(parsed.productContext);
            } catch (e) {
                console.error("Failed to parse form state", e);
            }
        }
        setIsStateLoaded(true);
    }, []);

    useEffect(() => {
        if (isStateLoaded) {
            localStorage.setItem('snsAgent24_formState', JSON.stringify({
                selectedPlatform,
                selectedCategory,
                selectedTarget,
                selectedGender,
                selectedBusinessStyle,
                selectedTone,
                selectedLanguage,
                productContext
            }));
        }
    }, [selectedPlatform, selectedCategory, selectedTarget, selectedGender, selectedBusinessStyle, selectedTone, selectedLanguage, productContext, isStateLoaded]);

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [checkoutError, setCheckoutError] = useState(null);
    const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

    // 回数制限のチェック関数 (localStorageベース)
    const checkLimitAndRecord = () => {
        if (isPro) return true; // Proプランは無制限

        const today = new Date().toLocaleDateString('ja-JP');
        const usageDataStr = localStorage.getItem('snsAgent24_usage');
        let usageData = usageDataStr ? JSON.parse(usageDataStr) : { date: today, count: 0 };

        // 日付が変わっていればリセット
        if (usageData.date !== today) {
            usageData = { date: today, count: 0 };
        }

        if (usageData.count >= 1) {
            return false; // 制限オーバー
        }

        // カウントアップして保存
        usageData.count += 1;
        localStorage.setItem('snsAgent24_usage', JSON.stringify(usageData));
        return true;
    };

    const handleCheckout = async (interval = 'month') => {
        try {
            if (!isSignedIn) {
                openSignUp();
                return;
            }
            setCheckoutError(null);
            setIsCheckoutLoading(true);

            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ interval })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`(${res.status}) ${text}`);
            }

            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error("決済URLが取得できませんでした");
            }
        } catch (e) {
            console.error(e);
            setCheckoutError(e.message);
        } finally {
            setIsCheckoutLoading(false);
        }
    };

    const handlePortal = async () => {
        try {
            const res = await fetch('/api/portal', { method: 'POST' });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
        } catch (e) {
            alert("管理画面への移動に失敗しました");
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
        if (!selectedCategory || !selectedTarget || !selectedGender || !selectedBusinessStyle || !selectedTone) {
            alert("すべての項目を選択してください");
            return;
        }

        // 無料プランの回数制限チェック
        if (!checkLimitAndRecord()) {
            alert("本日の無料生成枠（1回）を使い切りました。\\n引き続き無制限でご利用いただくには、Proプランへのアップグレードをご検討ください！");
            document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        setLoading(true);

        // ユーザーが生成中画面(ローディング)に気づけるようにDOM更新後に一番上へスクロールする
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);

        try {
            // APIに巨大な画像データ(Base64)が含まれたまま送るとVercelの制限(Server Action)でエラーになる原因を防ぐため、裏側へ送信するデータからは画像を除外する
            const cleanProductContext = { ...productContext };
            delete cleanProductContext.logoUrl;
            delete cleanProductContext.baseImage; // APIに渡さないように除外

            let siteContent = null;
            if (cleanProductContext?.websiteUrl) {
                siteContent = await scrapeWebsite(cleanProductContext.websiteUrl);
            }

            const targetLabel = selectedTarget === 'teens' ? '10代' : selectedTarget === 'young_adults' ? '20-30代' : selectedTarget === 'parents' ? 'パパママ' : selectedTarget === 'high_end' ? '富裕層・ハイエンド' : 'ビジネス層';

            // 1. リサーチ
            const research = await researchTrends(selectedCategory, targetLabel, selectedGender, selectedBusinessStyle, selectedPlatform, cleanProductContext?.location, siteContent);

            // 2. キャプション生成 (言語指定を追加)
            const post = await generatePost(research, selectedPlatform, selectedCategory, targetLabel, selectedGender, selectedBusinessStyle, selectedTone, selectedLanguage, cleanProductContext, siteContent);

            // 3. 画像合成または生成
            let imageUrls = [];

            if (productContext.baseImage) {
                // 【新機能】ユーザー提供の生写真＋AIテキスト自動合成 (Image-to-Image代替の自動デザイン機能)
                imageUrls = await new Promise((resolve) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1080;
                    canvas.height = 1080;
                    const ctx = canvas.getContext('2d');

                    const bgImg = new Image();
                    if (productContext.baseImage.startsWith('http')) {
                        bgImg.crossOrigin = 'anonymous';
                    }

                    bgImg.onload = async () => {
                        // アスペクト比を維持しつつカバー全面に描画(中央切り抜き)
                        const scale = Math.max(canvas.width / bgImg.width, canvas.height / bgImg.height);
                        const drawWidth = bgImg.width * scale;
                        const drawHeight = bgImg.height * scale;
                        const dx = (canvas.width - drawWidth) / 2;
                        const dy = (canvas.height - drawHeight) / 2;
                        ctx.drawImage(bgImg, dx, dy, drawWidth, drawHeight);

                        // テキストを読みやすくするためのダークグラデーションフィルターを追加
                        const grad = ctx.createLinearGradient(0, canvas.height * 0.3, 0, canvas.height);
                        grad.addColorStop(0, 'rgba(0,0,0,0)');
                        grad.addColorStop(0.5, 'rgba(0,0,0,0.4)');
                        grad.addColorStop(1, 'rgba(0,0,0,0.85)');
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // AIが考えたキャッチコピー（overlay_copy）の描画
                        const text = post.overlay_copy || `${cleanProductContext.companyName ? cleanProductContext.companyName + '\\n' : ''}最新のトレンド情報をチェック！`;

                        // 動的フォントサイズ初期設定 (文字量が多い場合は少し小さくする)
                        let fontSize = text.length > 30 ? 60 : 80;
                        ctx.font = `bold ${fontSize}px sans-serif`;

                        // 文字の自動折り返し（ワードラップ）処理
                        const maxWidth = canvas.width - 160; // 左右に80pxずつの広めの余白
                        const segmentLines = text.split('\\n');
                        const lines = [];

                        segmentLines.forEach(segment => {
                            let currentLine = '';
                            // 日本語は1文字ずつ幅を判定する
                            for (let i = 0; i < segment.length; i++) {
                                const char = segment[i];
                                const testLine = currentLine + char;
                                const metrics = ctx.measureText(testLine);
                                const testWidth = metrics.width;

                                if (testWidth > maxWidth && i > 0) {
                                    lines.push(currentLine);
                                    currentLine = char;
                                } else {
                                    currentLine = testLine;
                                }
                            }
                            lines.push(currentLine);
                        });

                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';

                        // 文字のドロップシャドウ (可読性向上のため強化)
                        ctx.shadowColor = 'rgba(0,0,0,0.95)';
                        ctx.shadowBlur = 30;
                        ctx.shadowOffsetX = 4;
                        ctx.shadowOffsetY = 4;

                        // 行ごとに中央やや下寄りに描画
                        const lineHeight = fontSize * 1.4;
                        const startY = canvas.height * 0.65 - ((lines.length - 1) * lineHeight) / 2;
                        lines.forEach((line, index) => {
                            ctx.fillText(line.trim(), canvas.width / 2, startY + (index * lineHeight));
                        });

                        // 影のエフェクトを完全にリセット（これがないと後のロゴにも影が落ちて二重に見えてしまう）
                        ctx.shadowColor = 'rgba(0,0,0,0)';
                        ctx.shadowBlur = 0;
                        ctx.shadowOffsetX = 0;
                        ctx.shadowOffsetY = 0;

                        // もしロゴ画像があれば、右下（または左上）に合成
                        if (productContext.logoUrl) {
                            try {
                                const logoImg = new Image();
                                if (productContext.logoUrl.startsWith('http')) {
                                    logoImg.crossOrigin = 'anonymous';
                                }
                                await new Promise((res, rej) => { logoImg.onload = res; logoImg.onerror = rej; logoImg.src = productContext.logoUrl; });

                                const maxLogoSize = 250;
                                const size = Math.min(maxLogoSize, logoImg.width, logoImg.height);
                                const padding = 40;
                                // 右下に配置（画像そのものの左上座標）
                                const x = canvas.width - padding - size;
                                const y = canvas.height - padding - size;
                                // 円の中心座標
                                const centerX = x + size / 2;
                                const centerY = y + size / 2;

                                ctx.save();

                                // シャドウリセットの念押し
                                ctx.shadowColor = 'rgba(0,0,0,0)';
                                ctx.shadowBlur = 0;
                                ctx.shadowOffsetX = 0;
                                ctx.shadowOffsetY = 0;

                                // 既にSelectors.js側で丸く透過PNG化されているので、そのまま描画
                                ctx.drawImage(logoImg, x, y, size, size);

                                // ロゴの外周を囲う白枠
                                ctx.beginPath();
                                ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2, true);
                                ctx.lineWidth = 4;
                                ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                                ctx.stroke();
                                ctx.restore();
                            } catch (e) {
                                console.log("ロゴの合成に失敗しました", e);
                            }
                        }

                        // 完成した画像をBase64として出力
                        resolve([canvas.toDataURL('image/jpeg', 0.95)]);
                    };

                    bgImg.onerror = () => {
                        console.error('Base Image load error');
                        resolve([]); // エラー時は空配列を返す
                    };

                    bgImg.src = productContext.baseImage;
                });

            } else {
                // 従来のAIフル画像生成 (Gemini Imagen API)
                const imgContext = post.image_idea || research.insight_summary;
                imageUrls = await generateImage(selectedCategory, targetLabel, selectedGender, imgContext, cleanProductContext, selectedPlatform, null, 1);
            }

            setResult({ research, post, imageUrls });
            setStep(2);
            setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 100);
        } catch (e) {
            console.error(e);
            alert("エラーが発生しました: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // Hydration Mismatch防止: クライアントサイドでのマウント完了を検知する
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="min-h-screen bg-[#111112] text-white font-sans selection:bg-purple-500/30 flex flex-col pt-4">
            {/* Header */}
            <header className="w-full flex justify-end items-center px-6 py-2">
                <div className="flex items-center gap-4">
                    {mounted && !isPro ? (
                        <button
                            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                            className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold py-2 px-4 rounded-full flex items-center gap-2 text-sm transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                        >
                            <Gem size={16} className="text-cyan-300" />
                            Proにアップグレード
                        </button>
                    ) : mounted && isPro ? (
                        <button
                            onClick={handlePortal}
                            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white py-2 px-4 rounded-full flex items-center gap-2 text-sm transition-all"
                        >
                            <Gem size={16} className="text-cyan-300" />
                            Proプラン管理
                        </button>
                    ) : (
                        <div className="w-32 h-8 rounded-full bg-gray-800 animate-pulse"></div> // マウント前のプレースホルダー
                    )}

                    {mounted && isLoaded && isSignedIn ? (
                        <UserButton afterSignOutUrl="/" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-700 animate-pulse border-2 border-transparent"></div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center mt-12 px-4 w-full">

                {step === 0 && (
                    <>
                        {/* Logo & Hero */}
                        <div className="flex flex-col items-center mb-12">
                            {/* Circle Logo */}
                            <div className="w-24 h-24 bg-black rounded-full flex flex-col items-center justify-center mb-6 shadow-xl border border-white/10">
                                <span className="text-white text-[15px] tracking-[0.2em] font-light leading-tight">DEARS</span>
                                <span className="text-white text-[9px] tracking-[0.1em] font-light opacity-80 mt-1">CONSULTING</span>
                            </div>

                            <h1 className="text-5xl md:text-6xl font-extrabold mb-4 tracking-tight drop-shadow-md">
                                SNS Agent24
                            </h1>
                            <p className="text-gray-400 text-sm md:text-[15px] max-w-xl text-center leading-relaxed">
                                最新のトレンドリサーチから投稿作成まで全自動。見込み客の心を掴む発信を、これひとつで。
                            </p>
                        </div>

                        {/* Platforms selection */}
                        <div className="w-full max-w-2xl px-4 flex flex-col items-center min-h-[400px]">
                            {!mounted || !isLoaded ? (
                                <div className="flex flex-col items-center justify-center h-48">
                                    <div className="animate-spin border-4 border-purple-500 border-t-transparent rounded-full w-12 h-12 mb-4"></div>
                                    <p className="text-gray-400 text-sm">ユーザー情報を確認中...</p>
                                </div>
                            ) : !isSignedIn ? (
                                <div className="bg-[#1a1a24] border border-purple-500/30 rounded-2xl p-6 mb-10 w-full max-w-lg text-center shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500"></div>
                                    <h3 className="text-xl font-bold text-white mb-2">🎉 まずは無料でスタート！</h3>
                                    <p className="text-gray-400 text-[13px] md:text-sm mb-6 leading-relaxed">
                                        最初から最後まで全自動でキャプションや画像を生成できる<br className="hidden md:block" />
                                        プロ向けAIエージェントを、1日1回無料で体験できます。
                                    </p>

                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full px-4">
                                        <button
                                            onClick={() => openSignUp()}
                                            className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3.5 px-8 rounded-full transition-all shadow-[0_0_20px_rgba(219,39,119,0.4)] hover:shadow-[0_0_30px_rgba(219,39,119,0.6)] transform hover:-translate-y-0.5"
                                        >
                                            🚀 新規アカウント登録 (無料)
                                        </button>

                                        <button
                                            onClick={() => openSignIn()}
                                            className="w-full sm:w-auto bg-transparent border border-white/20 text-white font-bold py-3.5 px-8 rounded-full hover:bg-white/10 transition-all"
                                        >
                                            ログイン
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-4">
                                        ※登録でクレジットカード等は不要です
                                    </p>
                                </div>
                            ) : null}

                            <h2 className={`text-xl md:text-2xl font-bold mb-8 text-center drop-shadow-sm ${!mounted || !isLoaded ? 'opacity-0' : isSignedIn ? 'text-white' : 'text-gray-500'}`}>
                                投稿するプラットフォームを選択
                            </h2>

                            <div className={`grid grid-cols-2 lg:grid-cols-3 gap-4 mb-16 w-full px-4 md:px-12 transition-all duration-500 ${!mounted || !isLoaded ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                                {/* Instagram */}
                                <button
                                    onClick={() => setSelectedPlatform('instagram')}
                                    disabled={!mounted || !isLoaded || !isSignedIn}
                                    className={`flex flex-col items-center justify-center py-8 px-4 rounded-2xl border ${selectedPlatform === 'instagram' ? 'bg-white/10 border-white text-white scale-105' : 'bg-transparent border-white/10 text-gray-400 hover:bg-white/5 hover:border-white/30'} transition-all duration-300 group`}
                                >
                                    <Instagram size={36} className={`mb-4 ${selectedPlatform === 'instagram' ? 'text-white' : 'group-hover:text-white'}`} strokeWidth={1.5} />
                                    <span className="font-semibold tracking-wide text-sm">Instagram</span>
                                </button>

                                {/* X (Twitter) */}
                                <button
                                    onClick={() => setSelectedPlatform('twitter')}
                                    disabled={!mounted || !isLoaded || !isSignedIn}
                                    className={`flex flex-col items-center justify-center py-8 px-4 rounded-2xl border ${selectedPlatform === 'twitter' ? 'bg-white/10 border-white text-white scale-105' : 'bg-transparent border-white/10 text-gray-400 hover:bg-white/5 hover:border-white/30'} transition-all duration-300 group`}
                                >
                                    <Twitter size={36} className={`mb-4 ${selectedPlatform === 'twitter' ? 'text-white' : 'group-hover:text-white'}`} strokeWidth={1.5} />
                                    <span className="font-semibold tracking-wide text-sm">X (Twitter)</span>
                                </button>

                                {/* Facebook */}
                                <button
                                    onClick={() => setSelectedPlatform('facebook')}
                                    disabled={!mounted || !isLoaded || !isSignedIn}
                                    className={`col-span-2 lg:col-span-1 flex flex-col items-center justify-center py-8 px-4 rounded-2xl border ${selectedPlatform === 'facebook' ? 'bg-white/10 border-white text-white scale-105' : 'bg-transparent border-white/10 text-gray-400 hover:bg-white/5 hover:border-white/30'} transition-all duration-300 group`}
                                >
                                    <Facebook size={36} className={`mb-4 ${selectedPlatform === 'facebook' ? 'text-white' : 'group-hover:text-white'}`} strokeWidth={1.5} />
                                    <span className="font-semibold tracking-wide text-sm">Facebook</span>
                                </button>
                            </div>

                            {/* START Button */}
                            <button
                                onClick={handleStart}
                                disabled={!mounted || !isLoaded || !isSignedIn}
                                className={`w-[280px] h-14 rounded overflow-hidden relative group text-xl font-bold tracking-wider transition-all duration-500 ${!mounted || !isLoaded ? 'opacity-0 scale-95' : isSignedIn ? 'opacity-100 shadow-[0_0_30px_rgba(200,50,50,0.4)] cursor-pointer scale-100' : 'opacity-40 cursor-not-allowed grayscale'}`}
                                style={{
                                    background: 'linear-gradient(90deg, #A85500, #9A2833)'
                                }}
                            >
                                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <span className="relative z-10 text-white drop-shadow-md">
                                    {!mounted || !isLoaded ? '...' : isSignedIn ? 'START' : 'ログインしてください'}
                                </span>
                            </button>
                        </div>
                    </>
                )}

                {step === 1 && (
                    <div className="w-full max-w-2xl px-4 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="w-full flex items-center mb-8">
                            <button onClick={() => setStep(0)} disabled={loading} className={`text-gray-400 hover:text-white flex items-center gap-1 transition-opacity ${loading ? 'opacity-0 cursor-default' : 'opacity-100'}`}>
                                <ChevronLeft size={20} /> <span className="text-sm">戻る</span>
                            </button>
                        </div>

                        {loading ? (
                            <div className="w-full flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in duration-500">
                                <div className="relative w-48 h-48 mb-8 flex items-center justify-center">
                                    {/* 外側の高速回転データリング */}
                                    <div className="absolute inset-0 rounded-full border border-t-[3px] border-r-transparent border-b-transparent border-l-transparent border-cyan-400 animate-spin-fast"></div>
                                    <div className="absolute inset-2 rounded-full border border-b-[3px] border-t-transparent border-r-transparent border-l-transparent border-pink-500 animate-spin-slow-reverse"></div>
                                    <div className="absolute inset-6 rounded-full border border-dashed border-purple-500/50 animate-spin-very-slow"></div>
                                    <div className="absolute inset-8 rounded-full border-[0.5px] border-white/20"></div>

                                    {/* 中央の「AI・データ解析」コア部分 */}
                                    <div className="absolute w-24 h-24 bg-gradient-to-tr from-purple-900 via-indigo-900 to-black rounded-full shadow-[0_0_50px_rgba(6,182,212,0.6)] flex items-center justify-center overflow-hidden">
                                        {/* スキャンラインエフェクト */}
                                        <div className="absolute w-full h-[2px] bg-cyan-400 opacity-80 blur-[1px] shadow-[0_0_10px_#06b6d4] animate-pulse-scan top-0 bottom-0 m-auto"></div>

                                        {/* 3D回転するテキスト (BrainCircuitの代替) */}
                                        <div className="relative z-10 animate-spin-3d-y font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-br from-cyan-300 to-purple-400 text-sm">
                                            Agent 24
                                        </div>
                                    </div>

                                    {/* 周囲のデータパーティクル（疑似） */}
                                    <div className="absolute top-0 right-8 w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_#06b6d4] animate-ping"></div>
                                    <div className="absolute bottom-4 left-4 w-1.5 h-1.5 bg-pink-500 rounded-full shadow-[0_0_8px_#ec4899] animate-ping animation-delay-500"></div>
                                </div>

                                <h3 className="text-2xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 mb-8 animate-pulse text-center drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                                    AI ANALYSIS & GENERATION
                                </h3>

                                <div className="w-full max-w-sm bg-black/50 border border-white/10 rounded-xl p-5 shadow-2xl backdrop-blur-sm">
                                    <div className="flex flex-col space-y-4 font-medium text-sm text-gray-300">
                                        <div className="flex items-start gap-4 transition-all duration-300">
                                            <div className="mt-1 relative flex items-center justify-center w-3 h-3">
                                                <span className="absolute w-full h-full rounded-full bg-cyan-500 opacity-75 animate-ping"></span>
                                                <span className="relative w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white font-bold mb-0.5">STEP 1: アルゴリズム解析</p>
                                                <p className="text-xs text-gray-500">選択されたプラットフォームの最新トレンドと検索ボリュームをスキャン</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4 transition-all duration-300 animation-delay-1500">
                                            <div className="mt-1 relative flex items-center justify-center w-3 h-3">
                                                <span className="absolute w-full h-full rounded-full bg-purple-500 opacity-75 animate-ping animation-delay-1500"></span>
                                                <span className="relative w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white font-bold mb-0.5">STEP 2: インサイト抽出</p>
                                                <p className="text-xs text-gray-500">ターゲット心理に基づくエンゲージメント最適化テキストを構築中</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4 transition-all duration-300 animation-delay-3000">
                                            <div className="mt-1 relative flex items-center justify-center w-3 h-3">
                                                <span className="absolute w-full h-full rounded-full bg-pink-500 opacity-75 animate-ping animation-delay-3000"></span>
                                                <span className="relative w-1.5 h-1.5 rounded-full bg-pink-400"></span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white font-bold mb-0.5">STEP 3: クリエイティブ生成</p>
                                                <p className="text-xs text-gray-500">テキストと文脈を統合し、反応率を高める高品質な画像を生成中...</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-64 h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent mt-12 animate-pulse"></div>
                                <p className="text-xs text-gray-500 mt-4">※高精度な解析と画像生成を行うため、通常50〜60秒ほどかかります。そのままお待ちください。</p>
                            </div>
                        ) : (
                            <>
                                <CategorySelector selected={{ id: selectedCategory }} onSelect={(c) => setSelectedCategory(c.id)} />

                                {selectedCategory && (
                                    <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-500">
                                        <TargetSelector selected={selectedTarget} onSelect={setSelectedTarget} isPro={isPro} />

                                        {selectedTarget && (
                                            <>
                                                <GenderSelector selected={selectedGender} onSelect={setSelectedGender} />

                                                {selectedGender && (
                                                    <>
                                                        <BusinessStyleSelector selected={selectedBusinessStyle} onSelect={setSelectedBusinessStyle} />

                                                        {selectedBusinessStyle && (
                                                            <>
                                                                <ToneSelector selected={selectedTone} onSelect={setSelectedTone} />

                                                                {selectedTone && (
                                                                    <>
                                                                        <LanguageSelector selected={selectedLanguage} onSelect={setSelectedLanguage} isPro={isPro} />

                                                                        <ProductInput value={productContext} onChange={setProductContext} />

                                                                        <button
                                                                            onClick={handleGenerate}
                                                                            className="w-[280px] h-14 mt-4 rounded overflow-hidden shadow-[0_0_30px_rgba(200,50,50,0.4)] hover:scale-105 transition-all text-white font-bold text-lg flex items-center justify-center gap-2"
                                                                            style={{ background: 'linear-gradient(90deg, #A85500, #9A2833)' }}
                                                                        >
                                                                            <Sparkles size={20} />
                                                                            生成する
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {step === 2 && result && (
                    <div className="w-full max-w-3xl px-4 flex flex-col items-center animate-in fade-in duration-500">
                        <div className="w-full flex items-center mb-8">
                            <button onClick={() => { setStep(0); setResult(null); }} className="text-gray-400 hover:text-white flex items-center gap-1">
                                <ChevronLeft size={20} /> <span className="text-sm">トップに戻る</span>
                            </button>
                        </div>

                        <h2 className="text-2xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                            生成が完了しました！
                        </h2>

                        <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 mb-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-400">
                                <BrainCircuit size={20} /> 3D AIトレンドリサーチ
                            </h3>

                            <div className="space-y-4">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <h4 className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-2">
                                        <Globe size={16} className="text-gray-400" /> ① 世の中の大きなトレンド
                                    </h4>
                                    <p className="text-gray-400 text-sm leading-relaxed">{result.research.insight_macro}</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <h4 className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-2">
                                        <Building size={16} className="text-gray-400" /> ② 業界内でのトレンド
                                    </h4>
                                    <p className="text-gray-400 text-sm leading-relaxed">{result.research.insight_industry}</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <h4 className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-2">
                                        <Target size={16} className="text-gray-400" /> ③ ターゲット層のトレンド
                                    </h4>
                                    <p className="text-gray-400 text-sm leading-relaxed">{result.research.insight_target}</p>
                                </div>

                                <div className="mt-6 bg-blue-900/20 p-5 rounded-xl border border-blue-500/30">
                                    <h4 className="text-sm font-bold text-blue-300 mb-2 flex items-center gap-2">
                                        <Lightbulb size={16} className="text-blue-400" /> 統合インサイト（今回のアプローチ方針）
                                    </h4>
                                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                        {result.research.insight_summary}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 mb-6">
                            <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-green-400">
                                <PenTool size={20} /> 生成されたキャプション
                            </h3>
                            <div className="bg-white/5 border border-white/5 p-4 rounded-xl mb-4 text-sm leading-relaxed whitespace-pre-wrap">
                                {result.post.caption}
                                {'\n\n'}
                                <span className="text-blue-400">
                                    {(result.post.hashtags || []).map(t => t.startsWith('#') ? t : `#${t}`).join(' ')}
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(result.post.caption + '\n\n' + (result.post.hashtags || []).map(t => t.startsWith('#') ? t : `#${t}`).join(' '));
                                    alert('コピーしました！');
                                }}
                                className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold flex flex-row items-center justify-center gap-2 transition-colors"
                            >
                                <Copy size={16} /> キャプションをコピー
                            </button>
                        </div>

                        <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 mb-8">
                            <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-orange-400">
                                <ImageIcon size={20} /> AI生成画像 (Gemini 4 Imagen)
                            </h3>
                            <p className="text-xs text-gray-500 mb-4">{result.post.image_idea}</p>

                            <div className="w-full aspect-square bg-[#1a1a1a] rounded-xl overflow-hidden mb-4 relative">
                                {result.imageUrls && result.imageUrls[0] ? (
                                    <>
                                        <img src={result.imageUrls[0]} alt="Generated" className="w-full h-full object-cover" />
                                        {productContext?.logoUrl && (
                                            <div className="absolute bottom-4 right-4 max-w-[25%] max-h-[25%] opacity-90 drop-shadow-lg pointer-events-none rounded-full overflow-hidden border-2 border-white/20 bg-black/40">
                                                <img src={productContext.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">画像生成に失敗しました（または制限）</div>
                                )}
                            </div>

                            {result.imageUrls && result.imageUrls[0] && !result.imageUrls[0].startsWith('http') && (
                                <button
                                    onClick={async (e) => {
                                        if (productContext?.logoUrl) {
                                            const btn = e.currentTarget;
                                            const prevText = btn.innerHTML;
                                            btn.innerHTML = '<span class="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4 mr-2"></span>合成中...';
                                            try {
                                                const canvas = document.createElement('canvas');
                                                const ctx = canvas.getContext('2d');
                                                const mainImg = new Image();
                                                mainImg.crossOrigin = 'anonymous';
                                                await new Promise((res, rej) => { mainImg.onload = res; mainImg.onerror = rej; mainImg.src = result.imageUrls[0]; });

                                                canvas.width = mainImg.width;
                                                canvas.height = mainImg.height;
                                                ctx.drawImage(mainImg, 0, 0);

                                                const logoImg = new Image();
                                                await new Promise((res, rej) => { logoImg.onload = res; logoImg.onerror = rej; logoImg.src = productContext.logoUrl; });

                                                const maxLogoW = canvas.width * 0.25;
                                                const maxLogoH = canvas.height * 0.25;
                                                // ロゴは正方形（丸型）を前提とするため最小値をとる
                                                const size = Math.min(maxLogoW, maxLogoH, logoImg.width, logoImg.height);
                                                const padding = canvas.width * 0.04;

                                                // 描画位置の中心点と半径を計算
                                                const cw = canvas.width;
                                                const ch = canvas.height;
                                                const r = size / 2;
                                                const cx = cw - padding - r;
                                                const cy = ch - padding - r;

                                                // 影の設定（影はパスではなく元のコンテキストの状態でかける）
                                                ctx.save();
                                                ctx.globalAlpha = 0.95;
                                                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                                                ctx.shadowBlur = 15;
                                                ctx.shadowOffsetX = 2;
                                                ctx.shadowOffsetY = 2;

                                                // 丸いパス（背景）を描画して影をつける
                                                ctx.beginPath();
                                                ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
                                                ctx.fillStyle = 'rgba(20,20,20,0.5)'; // 透過用の半黒背景
                                                ctx.fill();
                                                ctx.restore();

                                                // 丸にクリッピングして画像を描画する
                                                ctx.save();
                                                ctx.beginPath();
                                                ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
                                                ctx.clip();

                                                // 画像を描画
                                                ctx.drawImage(logoImg, cx - r, cy - r, size, size);
                                                ctx.restore();

                                                // 白い枠線を描画（よりクオリティを上げるため）
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
                                            const a = document.createElement('a');
                                            a.href = result.imageUrls[0];
                                            a.download = `sns-image-${Date.now()}.jpg`;
                                            a.click();
                                        }
                                    }}
                                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 rounded-lg text-sm font-bold flex flex-row items-center justify-center gap-2 transition-all shadow-lg"
                                >
                                    <Download size={16} /> 画像をダウンロード
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* PRICING SECTION */}
            <div id="pricing" className="w-full mt-24 mb-12 flex flex-col items-center">
                {checkoutError && (
                    <div className="bg-red-500/20 border border-red-500 text-red-100 p-4 rounded-lg mb-8 max-w-2xl w-full mx-4 text-center">
                        <p className="font-bold">決済画面への移動に失敗しました</p>
                        <p className="text-sm mt-1">{checkoutError}</p>
                    </div>
                )}
                {isCheckoutLoading && (
                    <div className="text-purple-400 mb-8 max-w-2xl w-full mx-4 text-center animate-pulse">
                        <p className="font-bold">決済画面の準備中です...</p>
                        <p className="text-sm mt-1">Stripeと通信しています。そのままお待ちください。</p>
                    </div>
                )}
                <PricingSection onUpgrade={handleCheckout} isPro={isPro} />
            </div>

            {/* Footer */}
            <footer className="w-full text-center pb-8 pt-12 flex flex-col items-center gap-1">
                <div className="text-gray-500 text-xs font-medium tracking-wide">
                    SNS Agent24 v2.3 | © 2026 DEARS CONSULTING
                </div>
                <a
                    href="https://dearsconsulting.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#E0455B] hover:text-[#FF6B80] text-xs transition-colors"
                >
                    https://dearsconsulting.com/
                </a>
            </footer>
        </div>
    );
}
