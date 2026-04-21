"use client";

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Check, X, Loader2, Calendar, Sparkles, ArrowLeft, RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { drawCanvasImage } from '@/lib/canvasHelper';

// 週次自動生成されたpending_approvalな投稿を確認・承認・却下するページ
// 承認時は現在のブラウザ上でCanvasオーバーレイ合成を実行し、合成済画像を再アップロード
export default function ApprovePage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingIds, setProcessingIds] = useState(new Set());
    const [statusMsg, setStatusMsg] = useState('');

    const fetchPending = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/batch-approve');
            if (!res.ok) throw new Error('取得失敗');
            const json = await res.json();
            const fetched = json.posts || [];
            setPosts(fetched);
            // 画像未生成のものがあれば順次生成してstateに反映
            await generateMissingImages(fetched);
        } catch (e) {
            console.error(e);
            setStatusMsg(`読み込みエラー: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    // 画像未生成の投稿について、1件ずつ順番に /api/generate-post-image を叩いて埋める
    const generateMissingImages = async (list) => {
        const needsImage = list.filter(p => !Array.isArray(p.image_urls) || p.image_urls.length === 0);
        if (needsImage.length === 0) return;
        setStatusMsg(`${needsImage.length}件の画像を順次生成中...`);
        for (let idx = 0; idx < needsImage.length; idx++) {
            const p = needsImage[idx];
            try {
                setStatusMsg(`画像生成中 (${idx + 1}/${needsImage.length}) - ${p.caption?.slice(0, 20) || ''}...`);
                const res = await fetch('/api/generate-post-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ postId: p.id, variationIndex: idx })
                });
                if (!res.ok) {
                    console.warn(`画像生成失敗 (${p.id}):`, await res.text());
                    continue;
                }
                const data = await res.json();
                if (Array.isArray(data.image_urls) && data.image_urls.length > 0) {
                    setPosts(prev => prev.map(x => x.id === p.id ? { ...x, image_urls: data.image_urls } : x));
                }
            } catch (err) {
                console.error('image gen loop:', err);
            }
        }
        setStatusMsg('画像生成完了。確認して承認してください。');
    };

    useEffect(() => {
        if (isLoaded && user) fetchPending();
    }, [isLoaded, user]);

    // 画像にオーバーレイを合成してアップロードし直す
    const composeAndUpload = async (post) => {
        if (!Array.isArray(post.image_urls) || post.image_urls.length === 0) {
            return post.image_urls || [];
        }
        const canvasOptions = {
            companyName: post.product_context?.companyName,
            logoUrl: post.product_context?.logoUrl
        };
        const newUrls = [];
        for (let j = 0; j < post.image_urls.length; j++) {
            const raw = post.image_urls[j];
            let overlayText = post.overlay_copy || '';
            if (Array.isArray(post.carousel_slides) && post.carousel_slides[j]?.overlay_copy) {
                overlayText = post.carousel_slides[j].overlay_copy;
            }
            try {
                const composed = await drawCanvasImage(overlayText, raw, j, canvasOptions);
                if (composed && composed.startsWith('data:image')) {
                    const upRes = await fetch('/api/upload-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ base64Data: composed })
                    });
                    if (upRes.ok) {
                        const r = await upRes.json();
                        newUrls.push(r.url);
                        continue;
                    }
                }
            } catch (e) {
                console.error('overlay failed:', e);
            }
            newUrls.push(raw);
        }
        return newUrls;
    };

    const handleApprove = async (post) => {
        setProcessingIds(prev => new Set(prev).add(post.id));
        setStatusMsg(`${post.id.slice(0, 8)}... の画像を合成中`);
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
        if (!confirm(`${posts.length}件すべてを承認しますか？画像合成のため数十秒かかります。`)) return;
        for (const p of [...posts]) {
            await handleApprove(p);
        }
        setStatusMsg('全件承認完了');
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
                        AIが自動生成した投稿案を確認し、承認すると自動投稿キューに入ります。
                        予約時刻までに承認されなかった投稿は自動で承認扱いになります。
                    </p>
                </header>

                {statusMsg && (
                    <div className="mb-4 bg-purple-900/30 border border-purple-500/30 rounded-lg px-4 py-2 text-sm">
                        {statusMsg}
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
                            <button
                                onClick={handleApproveAll}
                                disabled={processingIds.size > 0}
                                className="flex items-center gap-2 text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 px-4 py-2 rounded font-bold disabled:opacity-50"
                            >
                                <Check size={16} /> 全件承認
                            </button>
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
                        <p className="text-gray-400">承認待ちの投稿はありません</p>
                        <p className="text-gray-600 text-sm mt-2">次の日曜日 20:00 に自動生成が実行されます</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {posts.map(post => {
                            const isProcessing = processingIds.has(post.id);
                            const scheduledDate = post.scheduled_at ? new Date(post.scheduled_at) : null;
                            const firstImg = post.image_urls?.[0];
                            return (
                                <div key={post.id} className="bg-gray-900/60 border border-gray-800 rounded-lg overflow-hidden">
                                    <div className="grid md:grid-cols-[240px_1fr] gap-4 p-4">
                                        <div className="bg-gray-950 rounded overflow-hidden aspect-square">
                                            {firstImg ? (
                                                <img src={firstImg} alt="preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">画像なし</div>
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                                                <Calendar size={14} />
                                                {scheduledDate
                                                    ? scheduledDate.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })
                                                    : '予約時刻未設定'}
                                                {post.image_urls?.length > 1 && (
                                                    <span className="ml-2 bg-purple-900/50 px-2 py-0.5 rounded">
                                                        カルーセル {post.image_urls.length}枚
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm whitespace-pre-wrap line-clamp-6 text-gray-200 flex-1">
                                                {post.caption || '(キャプション無し)'}
                                            </div>
                                            <div className="flex gap-2 mt-4">
                                                <button
                                                    onClick={() => handleApprove(post)}
                                                    disabled={isProcessing}
                                                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 px-3 py-2 rounded font-bold disabled:opacity-50"
                                                >
                                                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                    承認
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
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
