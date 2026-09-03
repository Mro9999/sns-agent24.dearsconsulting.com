import sgMail from '@sendgrid/mail';
import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

const requestTimestamps = new Map();

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

async function getRequestUser() {
    const { userId } = await auth();
    if (!userId) return null;
    return userId;
}

async function isAdmin(userId) {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    return user.publicMetadata?.role === 'admin';
}

// APIキーが設定されていれば初期化
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function POST(request) {
    try {
        const userId = await getRequestUser();
        if (!userId) return new NextResponse('Unauthorized', { status: 401 });

        const now = Date.now();
        const previous = requestTimestamps.get(userId) || 0;
        if (now - previous < 60_000) {
            return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
        }
        requestTimestamps.set(userId, now);

        const body = await request.json();
        const errorName = String(body?.errorName || 'UnknownError').slice(0, 120);
        const errorMessage = String(body?.errorMessage || '').slice(0, 2000);
        const errorStack = String(body?.errorStack || '').slice(0, 8000);
        const errorContext = String(body?.errorContext || '').slice(0, 500);
        const timestamp = String(body?.timestamp || new Date().toISOString()).slice(0, 80);

        // メール通知が停止していても、Vercelのランタイムログには必ず残す。
        console.error('[APP ERROR]', JSON.stringify({
            timestamp,
            errorName,
            errorMessage,
            errorContext,
            userId
        }));

        // 環境変数から送信元と送信先のアドレスを取得（未設定の場合はプレースホルダー）
        // ※ SENDGRID_FROM_EMAIL は SendGrid で Verified Sender として登録されている必要があります
        const adminEmail = process.env.ADMIN_EMAIL || process.env.SENDGRID_FROM_EMAIL;
        const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@dearsconsulting.com';

        if (!process.env.SENDGRID_API_KEY) {
            console.error("[ERROR NOTIFIER] SENDGRID_API_KEY is not set. Cannot send error email.");
            return NextResponse.json({ success: true, logged: true, emailDelivered: false }, { status: 202 });
        }

        if (!adminEmail) {
            console.error("[ERROR NOTIFIER] ADMIN_EMAIL or SENDGRID_FROM_EMAIL is not set.");
            return NextResponse.json({ success: true, logged: true, emailDelivered: false }, { status: 202 });
        }

        const msg = {
            to: adminEmail,
            from: fromEmail,
            subject: `[InstagramAuto Alert] アプリケーションエラー発生: ${errorName}`,
            text: `
InstagramAuto システムの本番環境でエラーが検知されました。
至急内容を確認し、改善を行ってください。

【発生日時】: ${timestamp}
【発生箇所/アクション】: ${errorContext}
【ユーザーID】: ${userId}

==============================
【エラー名】: ${errorName}
【メッセージ】: ${errorMessage}

【スタックトレース】:
${errorStack}
==============================
            `,
            html: `
<h2>InstagramAuto システムエラー検知アラート</h2>
<p>InstagramAuto システムの本番環境でエラーが検知されました。<br>至急内容を確認し、改善を行ってください。</p>
<ul>
    <li><strong>発生日時:</strong> ${escapeHtml(timestamp)}</li>
    <li><strong>発生箇所/アクション:</strong> ${escapeHtml(errorContext)}</li>
    <li><strong>ユーザーID:</strong> ${escapeHtml(userId)}</li>
</ul>
<hr />
<h3>エラー詳細</h3>
<p><strong>エラー名:</strong> ${escapeHtml(errorName)}</p>
<p><strong>メッセージ:</strong> ${escapeHtml(errorMessage)}</p>
<h4>スタックトレース:</h4>
<pre style="background:#f4f4f4; padding:10px; border-radius:5px; overflow-x:auto;">${escapeHtml(errorStack)}</pre>
            `,
        };

        // SendGrid APIでメール送信
        await sgMail.send(msg);
        console.log(`[ERROR NOTIFIER] Error notification email sent to ${adminEmail}`);

        return NextResponse.json({ success: true, logged: true, emailDelivered: true });
    } catch (error) {
        console.error("[ERROR NOTIFIER] Failed to send error notification email via SendGrid:", error);
        // 通知失敗そのものを500で返すと、元の障害に別のAPI障害が重なって見える。
        // console.error はVercelログへ残るため、受付済みとして返してユーザー処理を妨げない。
        return NextResponse.json({ success: true, logged: true, emailDelivered: false }, { status: 202 });
    }
}

// === 管理者テスト用（ブラウザで /api/log-error にアクセスしてテスト送信） ===
export async function GET(request) {
    try {
        const userId = await getRequestUser();
        if (!userId) return new NextResponse('Unauthorized', { status: 401 });
        if (!await isAdmin(userId)) return new NextResponse('Forbidden', { status: 403 });

        const adminEmail = process.env.ADMIN_EMAIL || process.env.SENDGRID_FROM_EMAIL;
        const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@dearsconsulting.com';

        if (!process.env.SENDGRID_API_KEY) {
            return new NextResponse("SENDGRID_API_KEY is missing", { status: 500 });
        }
        if (!adminEmail) {
            return new NextResponse("ADMIN_EMAIL is missing", { status: 500 });
        }

        const msg = {
            to: adminEmail,
            from: fromEmail,
            subject: "[TEST] InstagramAuto エラー通知システムの疎通確認",
            text: "これはVercelに設定されたSendGridのAPI連携テストです。このメールが届いていれば設定は完ぺきです！",
        };

        await sgMail.send(msg);
        return new NextResponse(`テストメールを ${adminEmail} 宛に送信しました！メールボックスをご確認ください。`, { status: 200 });
    } catch (e) {
        return new NextResponse(`テストメール送信失敗: ${e.message}`, { status: 500 });
    }
}
