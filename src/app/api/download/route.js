import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function getAllowedHost() {
    try {
        return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
    } catch {
        return null;
    }
}

export async function GET(request) {
    const { userId } = await auth();
    if (!userId) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
        const target = new URL(url);
        const allowedHost = getAllowedHost();
        if (!allowedHost || target.protocol !== 'https:' || target.hostname !== allowedHost) {
            return NextResponse.json({ error: 'Image URL is not allowed' }, { status: 400 });
        }

        // サーバーサイドから画像URLへFetchする（CORS制限を非適用）
        const response = await fetch(target, {
            signal: AbortSignal.timeout(15_000),
            redirect: 'error',
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) {
            return NextResponse.json({ error: 'URL did not return an image' }, { status: 415 });
        }

        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > MAX_IMAGE_BYTES) {
            return NextResponse.json({ error: 'Image is too large' }, { status: 413 });
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
            return NextResponse.json({ error: 'Image is too large' }, { status: 413 });
        }

        const requestedFilename = searchParams.get('filename') || `sns-image-${Date.now()}.jpg`;
        const filename = requestedFilename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);

        return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (error) {
        console.error('Image proxy error:', error);
        return NextResponse.json({ error: 'Failed to download image proxy' }, { status: 500 });
    }
}
