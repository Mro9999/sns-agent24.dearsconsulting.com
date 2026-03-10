import sgMail from '@sendgrid/mail';
import { NextResponse } from 'next/server';

// APIキーが設定されていれば初期化
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { errorName, errorMessage, errorStack, errorContext, user, timestamp } = body;

        // 環境変数から送信元と送信先のアドレスを取得（未設定の場合はプレースホルダー）
        // ※ SENDGRID_FROM_EMAIL は SendGrid で Verified Sender として登録されている必要があります
        const adminEmail = process.env.ADMIN_EMAIL || process.env.SENDGRID_FROM_EMAIL;
        const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@dearsconsulting.com';

        if (!process.env.SENDGRID_API_KEY) {
            console.error("[ERROR NOTIFIER] SENDGRID_API_KEY is not set. Cannot send error email.");
            return NextResponse.json({ success: false, error: "SENDGRID_API_KEY missing" }, { status: 500 });
        }

        if (!adminEmail) {
            console.error("[ERROR NOTIFIER] ADMIN_EMAIL or SENDGRID_FROM_EMAIL is not set.");
            return NextResponse.json({ success: false, error: "Admin email missing" }, { status: 500 });
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
【ユーザー情報】: ${user || '未ログイン / 不明'}

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
    <li><strong>発生日時:</strong> ${timestamp}</li>
    <li><strong>発生箇所/アクション:</strong> ${errorContext}</li>
    <li><strong>ユーザー情報:</strong> ${user || '未ログイン / 不明'}</li>
</ul>
<hr />
<h3>エラー詳細</h3>
<p><strong>エラー名:</strong> ${errorName}</p>
<p><strong>メッセージ:</strong> ${errorMessage}</p>
<h4>スタックトレース:</h4>
<pre style="background:#f4f4f4; padding:10px; border-radius:5px; overflow-x:auto;">${errorStack}</pre>
            `,
        };

        // SendGrid APIでメール送信
        await sgMail.send(msg);
        console.log(`[ERROR NOTIFIER] Error notification email sent to ${adminEmail}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[ERROR NOTIFIER] Failed to send error notification email via SendGrid:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// === 管理者テスト用（ブラウザで /api/log-error にアクセスしてテスト送信） ===
export async function GET(request) {
    try {
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
