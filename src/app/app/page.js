import { auth } from '@clerk/nextjs/server';
import AppClient from './AppClient';

export const metadata = {
    title: '投稿を作る',
    robots: { index: false, follow: false },
};

// 投稿生成はGeminiの初回生成に加えて品質修復が走る場合がある。
// Server Actionの既定60秒で正常処理を打ち切らないよう、このページだけ上限を延長する。
export const maxDuration = 300;

export default async function AppPage() {
    await auth.protect();
    return <AppClient />;
}
