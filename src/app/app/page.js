"use client";
import React, { useState, useEffect } from 'react';
import { Gem, Instagram, Twitter, Facebook, Sparkles, Download, Copy, RefreshCw, ChevronLeft, Globe, Building, Target, Lightbulb, PenTool, ImageIcon, BrainCircuit, Search, Brain, Palette, Rocket, Zap } from 'lucide-react';
import { UserButton, useUser, useClerk, useSession } from "@clerk/nextjs";
import PricingSection from '@/components/layout/PricingSection';
import { CategorySelector, TargetSelector, GenderSelector, BusinessStyleSelector, ToneSelector, LanguageSelector, FormatSelector, ProductInput } from '@/components/features/Selectors';
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
    const [selectedFormat, setSelectedFormat] = useState('carousel'); // デフォルトはカルーセル(5枚)
    const [productContext, setProductContext] = useState({});

    // UIリッチ化用のステート
    const [loadingProgress, setLoadingProgress] = useState(0); // 0〜99の疑似進捗
    const [terminalLogs, setTerminalLogs] = useState([]); // サイバー風の解析ダミーログ
    const DUMMY_LOGS = [
        "Initializing neural network...",
        "Connecting to data nodes...",
        "Fetching global trend metrics...",
        "Mapping user persona vectors...",
        "Analyzing sentiment patterns...",
        "Extracting high-engagement hashtags...",
        "Synthesizing core value proposition...",
        "Generating linguistic variations...",
        "Optimizing CTA for conversions...",
        "Applying visual aesthetic filters...",
        "Rendering canvas nodes...",
        "Finalizing prompt structures..."
    ];

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
            localStorage.setItem('snsAgent24_formState', JSON.stringify({
                selectedPlatform,
                selectedCategory,
                selectedTarget,
                selectedGender,
                selectedBusinessStyle,
                selectedTone,
                selectedLanguage,
                selectedFormat,
                productContext
            }));
        }
    }, [selectedPlatform, selectedCategory, selectedTarget, selectedGender, selectedBusinessStyle, selectedTone, selectedLanguage, selectedFormat, productContext, isStateLoaded]);

    const [loading, setLoading] = useState(false);
    const [loadingPhase, setLoadingPhase] = useState(0);
    const [result, setResult] = useState(null);
    const [checkoutError, setCheckoutError] = useState(null);
    const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

    // アカウント作成から7日以内か判定し、無料生成枠の上限を返す
    const getDailyFreeLimit = () => {
        if (!user || !user.createdAt) return 1;
        const createdDate = new Date(user.createdAt);
        const now = new Date();
        const diffTime = Math.abs(now - createdDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        // 最初の7日間は1日3回、それ以降は1日1回
        return diffDays <= 7 ? 3 : 1; 
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

        const phaseRef = { current: loadingPhase };
        phaseRef.current = loadingPhase;

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
                    const phaseMax = Math.min((phaseRef.current + 1) * 20, 98);

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
            setTerminalLogs(["> System boot sequence initiated."]);
            logInterval = setInterval(() => {
                setTerminalLogs(prev => {
                    const randomLog = DUMMY_LOGS[Math.floor(Math.random() * DUMMY_LOGS.length)];
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
            if (e.message !== "ログインが必要です。") {
                reportErrorToAdmin(e, "handleCheckout - Stripeチェックアウト遷移時");
            }
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
        if (!selectedCategory || !selectedTarget || !selectedGender || !selectedBusinessStyle || !selectedTone || !selectedFormat) {
            alert("すべての項目を選択してください");
            return;
        }

        // 無料プランの回数制限チェック
        const maxLimit = getDailyFreeLimit();
        if (!checkLimitAndRecord()) {
            alert(`本日の無料生成枠（${maxLimit}回）を使い切りました。\n引き続き無制限でご利用いただくには、Proプランへのアップグレードをご検討ください！`);
            document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        setLoading(true);
        setLoadingProgress(0); // 確実に0からプログレスアニメーションをスタートさせる
        setLoadingPhase(0); // 0: "世界中のトレンドを分析しています..."

        // ユーザーが生成中画面(ローディング)に気づけるようにDOM更新後に一番上へスクロールする
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);

        try {
            // APIに巨大な画像データ(Base64)が含まれたまま送るとVercelの制限(Server Action)でエラーになる原因を防ぐため、裏側へ送信するデータからは画像を除外する
            const cleanProductContext = { ...productContext };
            delete cleanProductContext.logoUrl;
            delete cleanProductContext.baseImage; // 後方互換性のため
            delete cleanProductContext.baseImages; // 複数画像配列を除外

            let siteContent = null;
            if (cleanProductContext?.websiteUrl) {
                siteContent = await scrapeWebsite(cleanProductContext.websiteUrl);
            }

            const targetLabel = selectedTarget === 'teens' ? '10代' : selectedTarget === 'young_adults' ? '20-30代' : selectedTarget === 'parents' ? 'パパママ' : selectedTarget === 'high_end' ? '富裕層・ハイエンド' : 'ビジネス層';

            // 1. リサーチ
            const research = await researchTrends(selectedCategory, targetLabel, selectedGender, selectedBusinessStyle, selectedPlatform, cleanProductContext?.location, siteContent);
            setLoadingPhase(1); // 1: "ターゲットの深層心理に基づいてキャプションを構築中..."
            await new Promise(resolve => setTimeout(resolve, 300)); // ReactのUI再レンダリングを確実に行わせるための待機（ローディングアニメの真実味を出す）

            // 2. キャプション生成 (言語指定・フォーマット指定を追加)
            const post = await generatePost(research, selectedPlatform, selectedCategory, targetLabel, selectedGender, selectedBusinessStyle, selectedTone, selectedLanguage, cleanProductContext, siteContent, selectedFormat);
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
                // ユーザーアップロード画像がない場合、AI(Gemini)で背景用画像を1枚生成する
                setLoadingPhase(3); // 3: "画像を生成・合成中..."
                await new Promise(resolve => setTimeout(resolve, 300)); // UI更新の待機

                const imgContext = post.image_idea || research.insight_summary;
                const generated = await generateImage(selectedCategory, targetLabel, selectedGender, imgContext, cleanProductContext, selectedPlatform, null, 1);

                if (generated && generated.length > 0) {
                    baseImagesArray = [generated[0]]; // AIが生成した画像を配列の1要素目とする
                } else {
                    throw new Error("AI画像生成に失敗しました（結果が空です）。");
                }
            } else {
                setLoadingPhase(3); // 3: "画像を生成・合成中..."
                await new Promise(resolve => setTimeout(resolve, 300)); // UI更新の待機
            }

            // 4. 文字合成を汎用的に行うヘルパー関数 (背景画像を引数で受ける, indexでエフェクト分岐)
            const drawCanvasImage = async (textToOverlay, bgUrl, index = 0) => {
                return new Promise((resolve) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1080;
                    canvas.height = 1080;
                    const ctx = canvas.getContext('2d');

                    const bgImg = new Image();
                    if (bgUrl && bgUrl.startsWith('http')) {
                        bgImg.crossOrigin = 'anonymous';
                    }

                    bgImg.onload = async () => {
                        // エフェクト用の定数定義 (デフォルトは等倍、中央配置、フィルターなし)
                        let zoomScale = 1.0;
                        let filter = 'none';
                        let panX = 0.5; // 0.0 (左端) 〜 1.0 (右端)
                        let panY = 0.5; // 0.0 (上端) 〜 1.0 (下端)

                        // カルーセルのページ(index)に応じた大胆な視覚的バリエーション（パン＆ズーム効果）の適用
                        if (index === 1) {
                            // 2枚目: 1.4倍にズームし、画像の「左上」寄りにパン（視点を動かす）
                            zoomScale = 1.4;
                            panX = 0.2;
                            panY = 0.2;
                        } else if (index === 2) {
                            // 3枚目: 1.5倍にズームし、「右下」寄りにパン ＋ 強いモノクロ調（過去や課題感を演出）
                            zoomScale = 1.5;
                            panX = 0.8;
                            panY = 0.8;
                            filter = 'grayscale(100%) brightness(0.6) contrast(1.2)';
                        } else if (index === 3) {
                            // 4枚目: 1.3倍ズームし、「右上」寄りにパン ＋ セピア調でエモーショナルに
                            zoomScale = 1.3;
                            panX = 0.8;
                            panY = 0.2;
                            filter = 'sepia(0.8) contrast(1.3) brightness(0.7)';
                        } else if (index === 4) {
                            // 5枚目(結論/CTA等): 1.6倍の超ズームで「左下」寄りにパン ＋ ブラー（背景を完全にボカして文字に全集中）
                            zoomScale = 1.6;
                            panX = 0.2;
                            panY = 0.8;
                            filter = 'blur(8px) brightness(0.6)';
                        }

                        // アスペクト比を維持しつつカバー全面に描画(中央切り抜きベース)
                        const baseScale = Math.max(canvas.width / bgImg.width, canvas.height / bgImg.height);
                        const finalScale = baseScale * zoomScale;
                        const drawWidth = bgImg.width * finalScale;
                        const drawHeight = bgImg.height * finalScale;

                        // panX, panY に基づいて描画開始位置(dx, dy)を決定する
                        // pan = 0.5 のときは従来通り中央揃えになる
                        const dx = (canvas.width - drawWidth) * panX;
                        const dy = (canvas.height - drawHeight) * panY;

                        ctx.save();
                        ctx.filter = filter;
                        // スムージングを有効にして粗さを軽減
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(bgImg, dx, dy, drawWidth, drawHeight);
                        ctx.restore();

                        // テキストを読みやすくするためのダークグラデーションフィルターを追加
                        const grad = ctx.createLinearGradient(0, canvas.height * 0.3, 0, canvas.height);
                        grad.addColorStop(0, 'rgba(0,0,0,0)');
                        grad.addColorStop(0.5, 'rgba(0,0,0,0.4)');
                        grad.addColorStop(1, 'rgba(0,0,0,0.85)');
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // 描画するテキスト
                        const text = textToOverlay || `${cleanProductContext.companyName ? cleanProductContext.companyName + '\\n' : ''}最新のトレンド情報をチェック！`;

                        // 動的フォントサイズ初期設定 (文字量が多い場合は少し小さくする)
                        let fontSize = text.length > 30 ? 60 : 80;
                        ctx.font = `bold ${fontSize}px "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif`;

                        // 文字の自動折り返し（ワードラップ）処理（単語単位で自然に）
                        const maxWidth = canvas.width - 160; // 左右に80pxずつの広めの余白
                        // AIが文字列として返した '\n' や '\\n' を実際の改行コードに置換し、さらに描画時の「。」を削除する
                        const actualText = text.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n').replace(/。/g, '');
                        const segmentLines = actualText.split('\n');
                        const lines = [];

                        // 日本語対応の単語セグメンター（形態素や単語の区切りを判定）
                        const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });

                        segmentLines.forEach(segment => {
                            // 空行の場合はパディングとして空文字を入れるが、無駄な記号は描画しないように前処理
                            if (!segment.trim()) {
                                lines.push('');
                                return;
                            }

                            let currentLine = '';
                            const words = Array.from(segmenter.segment(segment)).map(s => s.segment);

                            words.forEach((word) => {
                                const testLine = currentLine + word;
                                const metrics = ctx.measureText(testLine);
                                const testWidth = metrics.width;

                                // 単語を追加して幅を超えたら、一つ前の状態(currentLine)を確定させて改行
                                if (testWidth > maxWidth && currentLine !== '') {
                                    lines.push(currentLine.trim());
                                    currentLine = word; // 新しい行は今の単語から始める
                                } else {
                                    currentLine = testLine;
                                }
                            });
                            if (currentLine.trim()) {
                                lines.push(currentLine.trim());
                            }
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
                        const lineHeight = fontSize * 1.5; // 行間を少し広げて読みやすく
                        // 全体の高さを計算
                        const totalTextHeight = (lines.length - 1) * lineHeight;
                        // Y座標の開始位置（画像全体の高さを基準に中央に配置する）
                        const startY = (canvas.height / 2) - (totalTextHeight / 2);

                        lines.forEach((line, index) => {
                            if (line) { // 空文字以外の場合のみ描画
                                ctx.fillText(line, canvas.width / 2, startY + (index * lineHeight));
                            }
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
                        resolve(canvas.toDataURL('image/jpeg', 0.95));
                    };

                    bgImg.onerror = () => {
                        console.error('Base Image load error');
                        resolve(null); // エラー時はnullを返す
                    };

                    bgImg.src = bgUrl;
                });
            };

            // 5. 決定したベース画像に対して、必要な枚数分(カルーセルなら5枚)の文言を合成していく
            if (baseImagesArray.length > 0) {
                if (selectedFormat === 'carousel' && post.carousel_slides && Array.isArray(post.carousel_slides)) {
                    // カルーセルの場合は複数枚(5枚)の画像を生成し、アップロードされた画像をローテーション（順番）で割り当てる
                    for (let i = 0; i < post.carousel_slides.length; i++) {
                        const slide = post.carousel_slides[i];
                        const currentBgUrl = baseImagesArray[i % baseImagesArray.length];
                        const imgData = await drawCanvasImage(slide.overlay_copy, currentBgUrl, i);
                        if (imgData) imageUrls.push(imgData);
                    }
                } else if (selectedFormat !== 'video_script') {
                    // 通常の1枚画像生成（カルーセル以外）は配列の1枚目を使用
                    const currentBgUrl = baseImagesArray[0];
                    const imgData = await drawCanvasImage(post.overlay_copy, currentBgUrl, 0);
                    if (imgData) imageUrls.push(imgData);
                }
            }

            setResult({ research, post, imageUrls, isSynthesized: true });
            setStep(2);
            setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 100);
        } catch (e) {
            console.error(e);
            alert("エラーが発生しました: " + e.message);
            reportErrorToAdmin(e, "handleGenerate - 投稿自動生成プロセス全体");
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
                        <div className="flex flex-col items-center mb-16 mt-4 w-full max-w-4xl text-center">
                            {/* Circle Logo - Animated Pulse */}
                            <div className="w-24 h-24 bg-black rounded-full flex flex-col items-center justify-center mb-8 shadow-[0_0_30px_rgba(255,255,255,0.05)] border border-white/10 relative group">
                                <div className="absolute inset-0 rounded-full border border-purple-500/30 group-hover:border-purple-500/80 transition-all duration-700 animate-[spin_10s_linear_infinite]"></div>
                                <span className="text-white text-[15px] tracking-[0.2em] font-light leading-tight">DEARS</span>
                                <span className="text-white text-[9px] tracking-[0.1em] font-light opacity-80 mt-1">CONSULTING</span>
                            </div>

                            {/* Main Title & Hero Copy */}
                            <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000 fill-mode-both">
                                <h1 className="text-5xl md:text-7xl font-extrabold mb-4 tracking-tight drop-shadow-2xl">
                                    SNS Agent<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">24</span>
                                </h1>
                                <h2 className="text-2xl md:text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-500 tracking-wide">
                                    AIが、あなたの専属SNSマーケターに。
                                </h2>
                                <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed mb-10">
                                    高精度なトレンドリサーチから、ターゲットの深層心理を突くキャプション構築、
                                    そしてプロ品質のビジュアル合成まで。すべてを全自動で完結。
                                </p>
                            </div>

                            {/* Feature Badges */}
                            <div className="flex flex-wrap justify-center gap-3 w-full mb-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both">
                                <div className="flex items-center gap-2 bg-gradient-to-r from-cyan-950/40 to-cyan-900/10 border border-cyan-500/20 px-4 py-2 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                                    <Search size={16} className="text-cyan-400" />
                                    <span className="text-gray-300 text-xs md:text-sm font-semibold tracking-wide">最新トレンドリアルタイム解析</span>
                                </div>
                                <div className="flex items-center gap-2 bg-gradient-to-r from-purple-950/40 to-purple-900/10 border border-purple-500/20 px-4 py-2 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                                    <Brain size={16} className="text-purple-400" />
                                    <span className="text-gray-300 text-xs md:text-sm font-semibold tracking-wide">ターゲット深層心理プロファイリング</span>
                                </div>
                                <div className="flex items-center gap-2 bg-gradient-to-r from-pink-950/40 to-pink-900/10 border border-pink-500/20 px-4 py-2 rounded-full shadow-[0_0_15px_rgba(236,72,153,0.1)]">
                                    <Palette size={16} className="text-pink-400" />
                                    <span className="text-gray-300 text-xs md:text-sm font-semibold tracking-wide">オリジナルSNSバナー完全自動合成</span>
                                </div>
                            </div>
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
                                    <h3 className="text-xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                                        <Zap size={20} className="text-yellow-400" />
                                        まずは無料でスタート
                                    </h3>
                                    <p className="text-gray-400 text-[13px] md:text-sm mb-6 leading-relaxed">
                                        最初から最後まで全自動でキャプションや画像を生成できる<br className="hidden md:block" />
                                        プロ向けAIエージェントを、登録から7日間は「1日3回」まで無料で体験できます。
                                    </p>

                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full px-4">
                                        <button
                                            onClick={() => openSignUp()}
                                            className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3.5 px-8 rounded-full transition-all shadow-[0_0_20px_rgba(219,39,119,0.4)] hover:shadow-[0_0_30px_rgba(219,39,119,0.6)] transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                                        >
                                            <Rocket size={18} />
                                            新規アカウント登録 (無料)
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

                            {/* モバイル専用機能についての事前警告（PCアクセス時の不満を防ぐ） */}
                            <div className={`w-full max-w-lg mb-8 p-4 bg-orange-900/30 border border-orange-500/40 rounded-xl text-center shadow-lg transition-all duration-500 ${!mounted || !isLoaded ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                                <h4 className="text-orange-400 font-bold text-sm mb-1 flex items-center justify-center gap-2">
                                    <span className="text-lg">📱</span> スマートフォンからのご利用を推奨
                                </h4>
                                <p className="text-gray-300 text-xs leading-relaxed">
                                    生成した画像の一括保存（カメラロールへのシェア機能等）は、<br className="hidden sm:block" />
                                    <strong className="text-orange-300">スマートフォン環境（iOS / Android）専用</strong>の機能です。<br />
                                    PC等で生成された場合、ダウンロード機能に制限がありますのでご注意ください。
                                </p>
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
                            <div className="w-full flex flex-col items-center justify-center py-6 animate-in fade-in zoom-in duration-700">
                                {/* インジケーター＆スピナー部分 */}
                                <div className="relative w-48 h-48 mb-6 flex items-center justify-center">
                                    {/* 外側の高速回転データリング */}
                                    <div className="absolute inset-0 rounded-full border border-t-[3px] border-r-transparent border-b-transparent border-l-transparent border-cyan-400 animate-spin-fast shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
                                    <div className="absolute inset-1 rounded-full border border-b-[3px] border-t-transparent border-r-transparent border-l-transparent border-pink-500 animate-[spin_2s_linear_infinite_reverse] shadow-[0_0_15px_rgba(236,72,153,0.5)]"></div>
                                    <div className="absolute inset-5 rounded-full border border-dashed border-purple-500/50 animate-[spin_6s_linear_infinite]"></div>
                                    <div className="absolute inset-8 rounded-full border-[0.5px] border-white/10"></div>

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
                                                <span className="text-sm text-cyan-400 opacity-80">%</span>
                                            </span>
                                            <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-cyan-400 mt-1 opacity-80">
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

                                <div className="w-full flex border h-4 mt-8 rounded-full border-white/20">
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
                                    <div className="flex flex-col space-y-4 font-medium text-sm text-gray-300 relative z-10 w-full">
                                        {/* Phase 1 */}
                                        <div className={`flex items-start gap-4 transition-all duration-700 ${loadingPhase >= 0 ? 'opacity-100' : 'opacity-30 blur-[1px]'}`}>
                                            <div className="mt-1 relative flex items-center justify-center w-3 h-3">
                                                {loadingPhase === 0 && <span className="absolute w-full h-full rounded-full bg-cyan-500 opacity-75 animate-ping"></span>}
                                                <span className={`relative w-2 h-2 rounded-full ${loadingPhase >= 0 ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-gray-600'}`}></span>
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-bold mb-0.5 ${loadingPhase >= 0 ? 'text-white' : 'text-gray-500'}`}>1. 市場・競合リサーチ中</p>
                                                <p className="text-[11px] text-gray-400 leading-tight">指定プラットフォームの最新トレンドデータと検索ボリュームを抽出</p>
                                            </div>
                                        </div>

                                        {/* Phase 2 */}
                                        <div className={`flex items-start gap-4 transition-all duration-700 ${loadingPhase >= 1 ? 'opacity-100' : 'opacity-30 blur-[1px]'}`}>
                                            <div className="mt-1 relative flex items-center justify-center w-3 h-3">
                                                {loadingPhase === 1 && <span className="absolute w-full h-full rounded-full bg-blue-500 opacity-75 animate-ping"></span>}
                                                <span className={`relative w-2 h-2 rounded-full ${loadingPhase >= 1 ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-gray-600'}`}></span>
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-bold mb-0.5 ${loadingPhase >= 1 ? 'text-white' : 'text-gray-500'}`}>2. ユーザー心理プロファイリング</p>
                                                <p className="text-[11px] text-gray-400 leading-tight">ターゲット情報から深層心理・行動パターンを解析中</p>
                                            </div>
                                        </div>

                                        {/* Phase 3 */}
                                        <div className={`flex items-start gap-4 transition-all duration-700 ${loadingPhase >= 2 ? 'opacity-100' : 'opacity-30 blur-[1px]'}`}>
                                            <div className="mt-1 relative flex items-center justify-center w-3 h-3">
                                                {loadingPhase === 2 && <span className="absolute w-full h-full rounded-full bg-purple-500 opacity-75 animate-ping"></span>}
                                                <span className={`relative w-2 h-2 rounded-full ${loadingPhase >= 2 ? 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]' : 'bg-gray-600'}`}></span>
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-bold mb-0.5 ${loadingPhase >= 2 ? 'text-white' : 'text-gray-500'}`}>3. コアバリュー最適化</p>
                                                <p className="text-[11px] text-gray-400 leading-tight">貴社・サービス情報を独自の強み（USP）に変換・統合</p>
                                            </div>
                                        </div>

                                        {/* Phase 4 */}
                                        <div className={`flex items-start gap-4 transition-all duration-700 ${loadingPhase >= 3 ? 'opacity-100' : 'opacity-30 blur-[1px]'}`}>
                                            <div className="mt-1 relative flex items-center justify-center w-3 h-3">
                                                {loadingPhase === 3 && <span className="absolute w-full h-full rounded-full bg-pink-500 opacity-75 animate-ping"></span>}
                                                <span className={`relative w-2 h-2 rounded-full ${loadingPhase >= 3 ? 'bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.8)]' : 'bg-gray-600'}`}></span>
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-bold mb-0.5 ${loadingPhase >= 3 ? 'text-white' : 'text-gray-500'}`}>4. コピーライティング構築</p>
                                                <p className="text-[11px] text-gray-400 leading-tight">エンゲージメントを最大化する構文とハッシュタグを生成中</p>
                                            </div>
                                        </div>

                                        {/* Phase 5 */}
                                        <div className={`flex items-start gap-4 transition-all duration-700 ${loadingPhase >= 4 ? 'opacity-100' : 'opacity-30 blur-[1px]'}`}>
                                            <div className="mt-1 relative flex items-center justify-center w-3 h-3">
                                                {loadingPhase === 4 && <span className="absolute w-full h-full rounded-full bg-rose-500 opacity-75 animate-ping"></span>}
                                                <span className={`relative w-2 h-2 rounded-full ${loadingPhase >= 4 ? 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]' : 'bg-gray-600'}`}></span>
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-bold mb-0.5 ${loadingPhase >= 4 ? 'text-white' : 'text-gray-500'}`}>5. ビジュアルクリエイティブ合成</p>
                                                <p className="text-[11px] text-gray-400 leading-tight">コンテキストに最適化した高精細クリエイティブを最終出力</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-64 h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent mt-12 animate-pulse"></div>
                                <p className="text-xs text-gray-500 mt-4">※高精度な解析と画像生成を行うため、通常50〜60秒ほどかかります。そのままお待ちください。</p>
                            </div>
                        ) : (
                            <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-500 gap-2">
                                <CategorySelector selected={{ id: selectedCategory }} onSelect={(c) => setSelectedCategory(c.id)} />
                                <TargetSelector selected={selectedTarget} onSelect={setSelectedTarget} isPro={isPro} />
                                <GenderSelector selected={selectedGender} onSelect={setSelectedGender} />
                                <BusinessStyleSelector selected={selectedBusinessStyle} onSelect={setSelectedBusinessStyle} />
                                <ToneSelector selected={selectedTone} onSelect={setSelectedTone} />
                                <FormatSelector selected={selectedFormat} onSelect={setSelectedFormat} isPro={isPro} />
                                <LanguageSelector selected={selectedLanguage} onSelect={setSelectedLanguage} isPro={isPro} />
                                <ProductInput value={productContext} onChange={setProductContext} />

                                <div className="mt-8 mb-16">
                                    <button
                                        onClick={handleGenerate}
                                        className="w-[280px] h-14 rounded overflow-hidden shadow-[0_0_30px_rgba(200,50,50,0.4)] hover:scale-105 transition-all text-white font-bold text-lg flex items-center justify-center gap-2"
                                        style={{ background: 'linear-gradient(90deg, #A85500, #9A2833)' }}
                                    >
                                        <Sparkles size={20} />
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
                                <PenTool size={20} /> 生成されたキャプション {selectedFormat === 'video_script' && '（投稿文用）'}
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
                            {selectedFormat === 'video_script' ? (
                                <>
                                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-orange-400">
                                        <ImageIcon size={20} /> ショート動画台本 (TikTok / Reels / Shorts)
                                    </h3>
                                    <p className="text-xs text-gray-500 mb-4">{result.post.image_idea}</p>

                                    <div className="space-y-4">
                                        {(result.post.video_script || []).map((script, idx) => (
                                            <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-xs font-bold">{script.time}</span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <h5 className="text-[10px] font-bold text-gray-400 mb-1">【映像・音声】</h5>
                                                        <p className="text-sm font-medium text-white mb-2 max-w-full">
                                                            <span className="text-blue-300">🎵 </span>{script.audio}
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            <span className="text-gray-500">🎥 </span>{script.visual}
                                                        </p>
                                                    </div>
                                                    <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                                                        <h5 className="text-[10px] font-bold text-gray-400 mb-1">【画面テロップ】</h5>
                                                        <p className="text-sm font-bold text-center text-yellow-300 drop-shadow-md py-4">{script.text_overlay}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-orange-400">
                                        <ImageIcon size={20} /> {selectedFormat === 'carousel' ? 'カルーセル用 画像一覧' : 'AI生成画像'}
                                    </h3>
                                    <p className="text-xs text-gray-500 mb-4">{result.post.image_idea}</p>

                                    {/* 複数枚画像コンテナ (スマホでは縦積み100%幅、PC等ではFlex横並び) */}
                                    <div className="w-full flex flex-col md:flex-row md:flex-wrap justify-center gap-6 pb-4">
                                        {result.imageUrls && result.imageUrls.length > 0 ? (
                                            result.imageUrls.map((url, idx) => (
                                                <div key={idx} className="w-full md:w-[45%] lg:w-[30%] aspect-square bg-[#1a1a1a] rounded-xl overflow-hidden relative shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-white/10 mx-auto">
                                                    <img src={url} alt={`Generated ${idx + 1}`} className="w-full h-full object-cover" />
                                                    {/* CSSロゴ合成 (未合成時) */}
                                                    {productContext?.logoUrl && !productContext.baseImage && (
                                                        <div className="absolute bottom-4 right-4 max-w-[25%] max-h-[25%] opacity-90 drop-shadow-lg pointer-events-none rounded-full overflow-hidden border-2 border-white/20 bg-black/40">
                                                            <img src={productContext.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                                        </div>
                                                    )}
                                                    {selectedFormat === 'carousel' && (
                                                        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md font-bold border border-white/20">
                                                            {idx + 1}枚目
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="w-full aspect-square flex items-center justify-center text-gray-500 text-sm bg-black/20 rounded-xl">画像生成に失敗しました（または制限）</div>
                                        )}
                                    </div>
                                </>
                            )}

                            {result.imageUrls && result.imageUrls.length > 0 && selectedFormat !== 'video_script' && !result.imageUrls[0].startsWith('http') && (
                                <>
                                    <button
                                        onClick={async (e) => {
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
                                    <p className="text-[11px] text-gray-400 mt-2 text-center leading-relaxed">
                                        ※画像保存（シェア機能）は<strong className="text-gray-300">スマートフォン専用</strong>です。<br />
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
                                <h3 className="text-xl font-bold mb-2 flex items-center justify-center gap-2 text-white">
                                    <Rocket size={24} className="text-pink-400" /> 次にやること（Next Action）
                                </h3>
                                <p className="text-center text-indigo-200 text-sm mb-6">
                                    AIが生成した最高のコンテンツを、今すぐ世界に届けましょう！
                                </p>

                                <div className="space-y-3 mb-6 max-w-lg mx-auto">
                                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-xl">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-sm">1</div>
                                        <div className="flex-1 text-sm text-gray-200">画像をダウンロードする</div>
                                        <Download size={16} className="text-gray-500" />
                                    </div>
                                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-xl">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-sm">2</div>
                                        <div className="flex-1 text-sm text-gray-200">キャプションとハッシュタグをコピーする</div>
                                        <Copy size={16} className="text-gray-500" />
                                    </div>
                                    <div className="flex items-center gap-3 bg-indigo-500/20 border border-indigo-500/30 p-3 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-lg border border-indigo-400">3</div>
                                        <div className="flex-1 text-sm font-bold text-white">アプリを開いて貼り付け、投稿を完了する！</div>
                                        <Zap size={16} className="text-yellow-400 animate-pulse" />
                                    </div>
                                </div>

                                <div className="max-w-lg mx-auto">
                                    <button
                                        onClick={() => {
                                            // アプリ用のカスタムURLスキーム
                                            const urls = {
                                                instagram: 'instagram://camera',
                                                twitter: 'twitter://post',
                                                facebook: 'fb://composer'
                                            };
                                            // Webブラウザ用のフォールバックURL
                                            const webUrls = {
                                                instagram: 'https://www.instagram.com/',
                                                twitter: 'https://twitter.com/compose/tweet',
                                                facebook: 'https://www.facebook.com/'
                                            };
                                            
                                            const platform = selectedPlatform || 'instagram';
                                            
                                            // ユーザーエージェントからモバイルを判定
                                            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                                            
                                            if (isMobile) {
                                                // スマホの場合はまずアプリ起動を試みる
                                                window.location.href = urls[platform];
                                                // 起動しなかった場合のための保険（数秒後にWeb版を開く）
                                                setTimeout(() => {
                                                    window.open(webUrls[platform], '_blank');
                                                }, 2000);
                                            } else {
                                                // PCの場合は最初からWeb版を開く
                                                window.open(webUrls[platform], '_blank');
                                            }
                                        }}
                                        className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl text-md font-bold text-white flex flex-row items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:shadow-[0_0_30px_rgba(147,51,234,0.6)] transform hover:-translate-y-1"
                                    >
                                        {selectedPlatform === 'instagram' && <Instagram size={20} />}
                                        {selectedPlatform === 'twitter' && <Twitter size={20} />}
                                        {selectedPlatform === 'facebook' && <Facebook size={20} />}
                                        {selectedPlatform === 'instagram' ? 'Instagramを開いて投稿する' :
                                         selectedPlatform === 'twitter' ? 'X (Twitter)を開いて投稿する' :
                                         selectedPlatform === 'facebook' ? 'Facebookを開いて投稿する' : 'SNSアプリを開いて投稿する'}
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
            </footer >
        </div >
    );
}
