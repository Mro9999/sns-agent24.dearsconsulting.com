import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Vercel Cron ジョブとして定期実行される（毎週月曜日を想定）
// 例: GET /api/cron/weekly-ideas
export async function GET(req) {
    try {
        // 1. Cronの認証（意図しない第三者からの実行を防ぐ）
        // Vercel Cronは実行時に Authorization ヘッダーに CRON_SECRET を付与する設定が可能
        const authHeader = req.headers.get('authorization');
        // もしローカルテスト用などで CRON_SECRET が未設定の場合はスルー（本番では必ず設定する想定）
        if (process.env.CRON_SECRET) {
            if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
                return new NextResponse('Unauthorized', { status: 401 });
            }
        }

        console.log("Starting weekly cron job: Generating universal trends...");

        // 2. Gemini APIを使って「今週のビジネス系SNS全般のトレンドと汎用ネタ1案」を生成
        if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
            throw new Error("Gemini API key is missing.");
        }
        
        const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
        
        const prompt = `
あなたは世界トップクラスのSNSプランナーおよびトレンドアナリストです。
ビジネス全般（実店舗、オンライン、BtoBサービスなど）で活用できる、SNS（Instagram/X/Facebook共通）の「今週のトレンド」と「誰でもマネできる1つの投稿アイデア」を提案してください。

出力は以下の要素を含め、美しいHTMLメールのコード（bodyタグの中身だけ、div等のブロックで整えた状態）として出力してください。

# 必須要件
- 言語は完全で自然な日本語。
- デザインスタイル: モダンで洗練されたSaaSからのメルマガをイメージ。背景は暗め推奨だがテキストが読みやすいインラインCSS(style="color: #333; font-family: sans-serif; ..." 等)を使う。
- AIという言葉を使わず、有能なSNSマーケターからのレターのように書くこと。

# 構成要素
1. タイトル: 【SNS Agent24】今週のトレンド予測と投稿アイデア💡
2. ご挨拶: 今週もビジネスとSNS運用お疲れ様です。
3. 今週のトレンド動向 (200文字程度で、幅広いビジネスで有益な見解)
4. 今週の投稿アイデア (タイトルと、どのような内容を書けばよいかの構成テンプレート)
5. 行動喚起 (CTAボタン風のリンク): アプリのURL (https://instagram-auto-sigma.vercel.app/) へ誘導し、「SNS Agent24を開いて、このネタを『あなたの自社の事業』に合わせて自動生成してみましょう！」と伝える。
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                temperature: 0.8
            }
        });

        const htmlContent = response.text.replace(/```html/gi, '').replace(/```/g, '').trim();
        console.log("Trend generated successfully.");

        // 3. Clerk APIを使って、登録されている全ユーザーのメールアドレスを取得する
        if (!process.env.CLERK_SECRET_KEY) {
            throw new Error("Clerk Secret Key is missing.");
        }

        console.log("Fetching users from Clerk Backend API...");
        const clerkRes = await fetch('https://api.clerk.com/v1/users?limit=500', {
            headers: {
                'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!clerkRes.ok) {
            throw new Error(`Clerk API returned ${clerkRes.status}`);
        }

        const users = await clerkRes.json();
        // email_addresses配列からプライマリアドレスのみを抽出
        const emails = users.map(u => u.email_addresses?.[0]?.email_address).filter(Boolean);
        
        if (emails.length === 0) {
            console.log("No valid user emails found. Aborting mail send.");
            return new NextResponse('No users found', { status: 200 });
        }
        
        console.log(`Prepared to send emails to ${emails.length} users.`);

        // 4. SendGrid APIを使って一斉送信（BCC相当：Personalizationsの複数化）
        if (!process.env.SENDGRID_API_KEY) {
            throw new Error("SendGrid API key is missing.");
        }

        // SendGridの仕様上、1つのAPIコールにつき max 1000 personalizations
        // 全員個別に送るため (to: にそれぞれ1件ずつ)
        const personalizations = emails.map(email => ({
            to: [{ email: email }]
        }));

        const sendGridRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                personalizations: personalizations,
                from: { email: 'notifications@dearsconsulting.com', name: 'SNS Agent24' },
                subject: '【SNS Agent24】今週のトレンド予測と投稿アイデア💡',
                content: [{ type: 'text/html', value: htmlContent }]
            })
        });

        if (sendGridRes.ok || sendGridRes.status === 202) {
            console.log("Weekly emails sent successfully via SendGrid.");
            return NextResponse.json({ success: true, count: emails.length, message: "Weekly idea sent" }, { status: 200 });
        } else {
            const errText = await sendGridRes.text();
            console.error('SendGrid Error:', errText);
            throw new Error(`SendGrid failed: ${errText}`);
        }

    } catch (e) {
        console.error("Cron Job Error:", e);
        return new NextResponse(`Internal Server Error: ${e.message}`, { status: 500 });
    }
}
