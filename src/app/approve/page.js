"use client";

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Check, X, Loader2, Calendar, Sparkles, ArrowLeft, RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
// drawCanvasImage は /api/generate-post-image のサーバー側合成へ移行したため、ここでは未使用

// 週次自動生成されたpending_approvalな投稿を確認・承認・却下するページ
// 承認時は現在のブラウザ上でCanvasオーバーレイ合成を実行し、合成済画像を再アップロード
const WEEKLY_BATCH_STARTED_KEY = 'sns-agent24-weekly-generation-started-at';
const BATCH_WAIT_MS = 10 * 60 * 1000;

export default function ApprovePage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingIds, setProcessingIds] = useState(new Set());
    const [statusMsg, setStatusMsg] = useState('');
    const [imageErrors, setImageErrors] = useState({});
    const [waitingForBatch, setWaitingForBatch] = useState(false);

    const hasRecentBatchStart = () => {
        if (typeof window === 'undefined') return false;
        const raw = window.localStorage.getItem(WEEKLY_BATCH_STARTED_KEY);
        const startedAt = raw ? Number(raw) : 0;
        return Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < BATCH_WAIT_MS;
    };

    const fetchPending = async (options = {}) => {
        const silent = options?.silent === true;
        try {
            if (!silent) setLoading(true);
            const res = await fetch('/api/batch-approve');
            if (!res.ok) throw new Error('取得失敗');
            const json = await res.json();
            const fetched = json.posts || [];
            setPosts(fetched);
            const shouldWait = fetched.length === 0 && hasRecentBatchStart();
            setWaitingForBatch(shouldWait);

            if (fetched.length > 0 && typeof window !== 'undefined') {
                window.localStorage.removeItem(WEEKLY_BATCH_STARTED_KEY);
            }

            if (shouldWait) {
                setStatusMsg('投稿案を作成中です。承認画面は自動で更新されます。少し待ってください。');
            }

            // 投稿文を先に表示し、画像は裏側で生成する。
            // ここで await すると承認画面全体が長時間「読み込み中」になり、離脱ポイントになる。
            setLoading(false);
            generateMissingImages(fetched);
        } catch (e) {
            console.error(e);
            setStatusMsg(`読み込みエラー: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    // どのpostが画像生成中かを追跡(カードにスケルトン表示するため)
    const [generatingIds, setGeneratingIds] = useState(new Set());
    // 承認時に使用する、文字合成済みの preview data URL
    // { [postId]: ['data:image/...', 'data:image/...'] }
    const [composedPreviews, setComposedPreviews] = useState({});

    // 画像のオーバーレイ合成は /api/generate-post-image でサーバー側 (Satori) で完了するため、
    // クライアント側ではそのまま表示用に URL を返すだけ (pass-through)。
    // 旧設計: ここで client-side canvas (drawCanvasImage) を使っていたが CORS / キャッシュ等で
    // 無音失敗するケースがあり、テキストなし画像が DB に保存される事故があった。
    const composePreviewsFor = async (post, imageUrls) => {
        if (!Array.isArray(imageUrls)) return [];
        return imageUrls;
    };

    const hasImages = (post) => Array.isArray(post.image_urls) && post.image_urls.length > 0;

    // 画像未生成の投稿について、投稿文の確認を止めずに /api/generate-post-image を裏側で叩いて埋める
    const generateMissingImages = async (list) => {
        const needsImage = list.filter(p => !hasImages(p) && !generatingIds.has(p.id));

        // 既に画像があるpostも先にプレビュー合成しておく(再訪問時など)
        for (const p of list) {
            if (hasImages(p) && !composedPreviews[p.id]) {
                composePreviewsFor(p, p.image_urls).then(composed => {
                    setComposedPreviews(prev => ({ ...prev, [p.id]: composed }));
                });
            }
        }

        if (needsImage.length === 0) return;

        // 先に全て「生成中」としてマーク。投稿文はこの時点で読める。
        setImageErrors(prev => {
            const next = { ...prev };
            needsImage.forEach(p => delete next[p.id]);
            return next;
        });
        setGeneratingIds(prev => {
            const next = new Set(prev);
            needsImage.forEach(p => next.add(p.id));
            return next;
        });
        setStatusMsg(`${needsImage.length}件の画像を裏側で生成中です。文章は先に確認できます。画像が揃った投稿から承認できます。`);

        const concurrency = Math.min(2, needsImage.length);
        let cursor = 0;
        let processedCount = 0;
        let failedCount = 0;
        let warningCount = 0;

        const runOne = async (p, idx) => {
            try {
                const res = await fetch('/api/generate-post-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ postId: p.id, variationIndex: idx })
                });
                if (!res.ok) {
                    const errorText = await res.text();
                    console.warn(`画像生成失敗 (${p.id}):`, errorText);
                    let message = '画像生成に失敗しました。更新すると再試行できます。';
                    try {
                        const errorJson = JSON.parse(errorText);
                        message = errorJson?.message || errorJson?.error || message;
                    } catch {
                        // plain text error
                    }
                    throw new Error(message);
                }

                const data = await res.json();
                if (Array.isArray(data.quality_warnings) && data.quality_warnings.length > 0) {
                    warningCount++;
                }
                if (!Array.isArray(data.image_urls) || data.image_urls.length === 0) {
                    throw new Error(data.reason || '画像URLが返りませんでした。更新すると再試行できます。');
                }

                setPosts(prev => prev.map(x => x.id === p.id ? { ...x, image_urls: data.image_urls } : x));
                // 生成完了後すぐに文字合成プレビューも作る
                const composed = await composePreviewsFor(p, data.image_urls);
                setComposedPreviews(prev => ({ ...prev, [p.id]: composed }));
            } catch (err) {
                console.error('image gen loop:', err);
                failedCount++;
                setImageErrors(prev => ({
                    ...prev,
                    [p.id]: err?.message || '画像生成に失敗しました。更新すると再試行できます。'
                }));
            } finally {
                processedCount++;
                setStatusMsg(`画像を裏側で生成中: ${processedCount} / ${needsImage.length} 件完了。文章は先に確認できます。`);
                setGeneratingIds(prev => {
                    const s = new Set(prev);
                    s.delete(p.id);
                    return s;
                });
            }
        };

        const workers = Array.from({ length: concurrency }, async () => {
            while (cursor < needsImage.length) {
                const idx = cursor++;
                await runOne(needsImage[idx], idx);
            }
        });

        await Promise.all(workers);

        if (failedCount > 0) {
            setStatusMsg(`${failedCount}件の画像生成に失敗しました。投稿案は残しています。更新すると再試行できます。`);
        } else if (warningCount > 0) {
            setStatusMsg('画像生成は完了しました。一部の画像は品質警告があります。必ず目視で確認してから承認してください。');
        } else {
            setStatusMsg('画像生成がすべて完了しました。内容をご確認のうえ承認してください。');
        }
    };

    useEffect(() => {
        if (isLoaded && user) fetchPending();
    }, [isLoaded, user]);

    useEffect(() => {
        if (!waitingForBatch || !isLoaded || !user) return;

        const timer = setInterval(() => {
            fetchPending({ silent: true });
        }, 10000);

        return () => clearInterval(timer);
    }, [waitingForBatch, isLoaded, user]);

    // 承認時: 画像URLはサーバー側 (/api/generate-post-image) で既に合成済みなので
    // そのまま返すだけ。アップロード処理も不要 (Supabase Storage 上に既にある)。
    const composeAndUpload = async (post) => {
        return post.image_urls || [];
    };

    const handleApprove = async (post) => {
        if (!hasImages(post)) {
            setStatusMsg('この投稿はまだ画像生成中です。文章確認はできますが、承認は画像が揃ってから実行してください。');
            return;
        }
        setProcessingIds(prev => new Set(prev).add(post.id));
        setStatusMsg(`${post.id.slice(0, 8)}... を承認しています`);
        try {
            const composedUrls = await composeAndUpload(post);
            const res = await fetch('/api/batch-approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'approve',
                    id: post.id,
                    image_urls: composedUrls
                })
            });
            if (!res.ok) throw new Error('承認APIエラー');
            setPosts(prev => prev.filter(p => p.id !== post.id));
            setStatusMsg(`承認完了: ${post.id.slice(0, 8)}...`);
        } catch (e) {
            setStatusMsg(`承認エラー: ${e.message}`);
        } finally {
            setProcessingIds(prev => {
                const s = new Set(prev);
                s.delete(post.id);
                return s;
            });
        }
    };

    const handleReject = async (post) => {
        if (!confirm('この投稿を却下しますか？')) return;
        setProcessingIds(prev => new Set(prev).add(post.id));
        try {
            const res = await fetch('/api/batch-approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject', id: post.id })
            });
            if (!res.ok) throw new Error('却下APIエラー');
            setPosts(prev => prev.filter(p => p.id !== post.id));
            setStatusMsg(`却下: ${post.id.slice(0, 8)}...`);
        } catch (e) {
            setStatusMsg(`却下エラー: ${e.message}`);
        } finally {
            setProcessingIds(prev => {
                const s = new Set(prev);
                s.delete(post.id);
                return s;
            });
        }
    };

    const handleApproveAll = async () => {
        const notReadyCount = posts.filter(p => !hasImages(p)).length;
        if (notReadyCount > 0) {
            setStatusMsg(`${notReadyCount}件はまだ画像生成中です。全件承認は画像が揃ってから実行してください。`);
            return;
        }
        if (!confirm(`${posts.length}件すべてを承認しますか？`)) return;
        for (const p of [...posts]) {
            await handleApprove(p);
        }
        setStatusMsg('全件承認完了');
    };

    const handleRejectAll = async () => {
        if (!confirm(`${posts.length}件すべてを却下しますか？この操作は取り消せません。`)) return;
        const targets = [...posts];
        // 並列で却下API を叩く (確認ダイアログは handleReject 側ではスキップしたいので直接呼ぶ)
        setProcessingIds(new Set(targets.map(p => p.id)));
        try {
            await Promise.all(targets.map(async (post) => {
                try {
                    const res = await fetch('/api/batch-approve', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'reject', id: post.id })
                    });
                    if (!res.ok) throw new Error(`却下API失敗 (${post.id.slice(0, 8)})`);
                } catch (e) {
                    console.error('rejectAll item error:', e);
                }
            }));
            setPosts([]);
            setStatusMsg(`${targets.length}件すべてを却下しました`);
        } catch (e) {
            setStatusMsg(`全件却下エラー: ${e.message}`);
        } finally {
            setProcessingIds(new Set());
        }
    };

    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <Loader2 className="animate-spin" />
            </div>
        );
    }
    if (!user) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div>ログインが必要です</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-950/40 text-white">
            <div className="max-w-4xl mx-auto px-4 py-8">
                <button
                    onClick={() => router.push('/app')}
                    className="flex items-center gap-2 text-gray-300 hover:text-white mb-6 text-sm"
                >
                    <ArrowLeft size={16} /> アプリへ戻る
                </button>

                <header className="mb-8">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Sparkles className="text-purple-400" />
                        今週の投稿を承認
                    </h1>
                    <p className="text-gray-400 mt-2 text-sm">
                        投稿文はすぐ確認できます。画像は裏側で生成され、揃った投稿から承認できます。
                    </p>
                </header>

                {statusMsg && (
                    <div className="mb-4 bg-purple-900/30 border border-purple-500/30 rounded-lg px-4 py-3 text-sm flex items-center gap-3">
                        {generatingIds.size > 0 && <Loader2 size={16} className="animate-spin text-purple-400 flex-shrink-0" />}
                        <span className="text-purple-100">{statusMsg}</span>
                    </div>
                )}

                <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-gray-400">
                        承認待ち: <span className="text-white font-bold">{posts.length}</span> 件
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={fetchPending}
                            className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded"
                        >
                            <RefreshCcw size={14} /> 更新
                        </button>
                        {posts.length > 0 && (
                            <>
                                <button
                                    onClick={handleRejectAll}
                                    disabled={processingIds.size > 0}
                                    className="flex items-center gap-2 text-sm bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-bold disabled:opacity-50"
                                >
                                    <X size={16} /> 全件却下
                                </button>
	                                <button
	                                    onClick={handleApproveAll}
	                                    disabled={processingIds.size > 0 || generatingIds.size > 0 || posts.some(p => !hasImages(p))}
	                                    className="flex items-center gap-2 text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 px-4 py-2 rounded font-bold disabled:opacity-50"
	                                >
                                    <Check size={16} /> 全件承認
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-16 text-gray-500">
                        <Loader2 className="animate-spin mx-auto mb-2" />
                        読み込み中...
                    </div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-16 bg-gray-900/50 rounded-lg border border-gray-800">
                        {waitingForBatch ? (
                            <>
                                <Loader2 className="animate-spin mx-auto mb-3 text-purple-400" />
                                <p className="text-gray-300">投稿案を作成中です</p>
                                <p className="text-gray-500 text-sm mt-2">通常は数分以内にここへ表示されます。画面は自動で更新されます。</p>
                            </>
                        ) : (
                            <>
                                <p className="text-gray-400">承認待ちの投稿はありません</p>
                                <p className="text-gray-600 text-sm mt-2">次の日曜日 20:00 に自動生成が実行されます</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {posts.map(post => {
                            const isProcessing = processingIds.has(post.id);
                            const isGeneratingImage = generatingIds.has(post.id);
                            const scheduledDate = post.scheduled_at ? new Date(post.scheduled_at) : null;
                            // 画像はサーバー側 (Satori) で合成済みなので post.image_urls をそのまま表示
                            const allImages = Array.isArray(post.image_urls) ? post.image_urls : [];
                            const isCarousel = allImages.length > 1;
                            const imageError = imageErrors[post.id];
                            return (
                                <div key={post.id} className="bg-gray-900/60 border border-gray-800 rounded-lg overflow-hidden">
                                    <div className="p-4 space-y-4">
                                        {/* メタ情報 */}
                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                            <Calendar size={14} />
                                            {scheduledDate
                                                ? scheduledDate.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })
                                                : '予約時刻未設定'}
                                            {isCarousel && (
                                                <span className="ml-2 bg-purple-900/50 px-2 py-0.5 rounded">
                                                    カルーセル {allImages.length}枚
                                                </span>
                                            )}
                                        </div>

                                        {/* 画像プレビュー: カルーセルは横並び全件、単発は1枚 */}
                                        {allImages.length > 0 ? (
                                            <div className={isCarousel
                                                ? "grid grid-cols-3 gap-2"
                                                : "max-w-xs"}>
                                                {allImages.map((url, idx) => (
                                                    <div key={idx} className="bg-gray-950 rounded overflow-hidden aspect-square relative">
                                                        <img src={url} alt={`slide ${idx + 1}`} className="w-full h-full object-cover" />
                                                        {isCarousel && (
                                                            <span className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                                                                {idx + 1}/{allImages.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : isGeneratingImage ? (
                                            <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 animate-pulse rounded aspect-square max-w-xs flex flex-col items-center justify-center px-4 text-center">
                                                <Loader2 className="animate-spin text-purple-400 mb-2" size={24} />
                                                <span className="text-xs text-gray-300">AI画像を生成中</span>
                                                <span className="text-[11px] text-gray-500 mt-1">文章は先に確認できます</span>
                                            </div>
                                        ) : imageError ? (
                                            <div className="bg-red-950/30 border border-red-900/50 rounded aspect-square max-w-xs flex flex-col items-center justify-center px-4 text-center">
                                                <span className="text-xs text-red-200">画像生成に失敗しました</span>
                                                <span className="text-[11px] text-red-300/70 mt-1">更新で再試行できます</span>
                                            </div>
                                        ) : (
                                            <div className="bg-gray-950 rounded aspect-square max-w-xs flex flex-col items-center justify-center text-gray-500 text-xs">
                                                <span>画像準備中</span>
                                                <span className="text-[11px] text-gray-600 mt-1">文章は先に確認できます</span>
                                            </div>
                                        )}

                                        {/* キャプション */}
                                        <div className="text-sm whitespace-pre-wrap text-gray-200">
                                            {post.caption || '(キャプション無し)'}
                                        </div>

                                        {/* 承認/却下ボタン */}
                                        <div className="flex gap-2 pt-2">
	                                            <button
	                                                onClick={() => handleApprove(post)}
	                                                disabled={isProcessing || !hasImages(post)}
	                                                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 px-3 py-2 rounded font-bold disabled:opacity-50"
	                                            >
	                                                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
	                                                {hasImages(post) ? '承認' : '画像待ち'}
	                                            </button>
                                            <button
                                                onClick={() => handleReject(post)}
                                                disabled={isProcessing}
                                                className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded disabled:opacity-50"
                                            >
                                                <X size={16} />
                                                却下
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
