export default function AppLoading() {
    return (
        <main
            id="main-content"
            className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center text-slate-900"
            role="status"
            aria-live="polite"
        >
            <div
                className="mb-5 h-12 w-12 animate-spin rounded-full border-4 border-rose-500 border-t-transparent"
                aria-hidden="true"
            />
            <h1 className="text-xl font-bold">投稿作成画面を準備しています</h1>
            <p className="mt-2 text-sm text-slate-600">ログイン状態と入力内容を確認しています。</p>
        </main>
    );
}
