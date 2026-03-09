import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
        // サーバーサイドから画像URLへFetchする（CORS制限を非適用）
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
        }

        // 画像のバイナリデータ（Buffer/ArrayBuffer）を取得
        const arrayBuffer = await response.arrayBuffer();

        // ヘッダーに元の画像のMIMEタイプを設定してクライアントへ返す
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        // クライアント側からファイル名の指定があればそれを使う、なければデフォルト設定
        const filename = searchParams.get('filename') || `sns-image-${Date.now()}.jpg`;

        return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Image proxy error:', error);
        return NextResponse.json({ error: 'Failed to download image proxy' }, { status: 500 });
    }
}
