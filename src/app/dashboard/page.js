import { auth } from '@clerk/nextjs/server';
import DashboardClient from './DashboardClient';

export const metadata = {
    title: '生成履歴',
    robots: { index: false, follow: false },
};

export default async function DashboardPage() {
    await auth.protect();
    return <DashboardClient />;
}
