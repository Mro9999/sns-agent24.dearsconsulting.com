import { auth } from '@clerk/nextjs/server';
import ApproveClient from './ApproveClient';

export const metadata = {
    title: '投稿を確認・承認',
    robots: { index: false, follow: false },
};

export default async function ApprovePage() {
    await auth.protect();
    return <ApproveClient />;
}
