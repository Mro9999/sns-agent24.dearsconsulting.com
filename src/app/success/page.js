import { auth } from '@clerk/nextjs/server';
import SuccessClient from './SuccessClient';

export const metadata = {
    title: 'アップグレード完了',
    robots: { index: false, follow: false },
};

export default async function SuccessPage() {
    await auth.protect();
    return <SuccessClient />;
}
