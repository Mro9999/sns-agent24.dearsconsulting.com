import crypto from 'crypto';
import { NextResponse } from 'next/server';

export function authorizeCronRequest(req) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        console.error('[cron] CRON_SECRET is not configured');
        return new NextResponse('Service unavailable', { status: 503 });
    }

    const supplied = req.headers.get('authorization') || '';
    const expected = `Bearer ${secret}`;
    const suppliedBuffer = Buffer.from(supplied);
    const expectedBuffer = Buffer.from(expected);
    const authorized = suppliedBuffer.length === expectedBuffer.length
        && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);

    return authorized ? null : new NextResponse('Unauthorized', { status: 401 });
}
