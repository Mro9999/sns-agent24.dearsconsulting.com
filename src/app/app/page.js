import { auth } from '@clerk/nextjs/server';
import AppClient from './AppClient';

export const metadata = {
    title: '投稿を作る',
    robots: { index: false, follow: false },
};

export default async function AppPage() {
    await auth.protect();
    return <AppClient />;
}
