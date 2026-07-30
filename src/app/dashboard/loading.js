export default function DashboardLoading() {
    return (
        <main
            id="main-content"
            className="flex min-h-screen flex-col items-center justify-center bg-[#111112] px-6 text-center text-white"
            role="status"
            aria-live="polite"
        >
            <div
                className="mb-5 h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"
                aria-hidden="true"
            />
            <h1 className="text-xl font-bold">生成履歴を準備しています</h1>
            <p className="mt-2 text-sm text-gray-400">最新の履歴を安全な件数ずつ読み込んでいます。</p>
        </main>
    );
}
