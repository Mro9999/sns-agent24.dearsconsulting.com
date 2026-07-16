import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { waitUntil } from '@vercel/functions';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = "force-dynamic";

// 運営側通知メール
const ADMIN_EMAIL = 'maeda@dearsconsulting.com';
const FROM_EMAIL = 'notifications@dearsconsulting.com';
const APP_NAME = 'SNS Agent 24';
const inquiryTimestamps = new Map();

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

async function sendAdminNotification(inquiry) {
    if (!process.env.SENDGRID_API_KEY) {
        console.warn('[pro-max-inquiry] SENDGRID_API_KEY未設定のため管理者通知スキップ');
        return;
    }

    const html = `
<!doctype html>
<html lang="ja">
<body style="font-family: system-ui, sans-serif; padding: 24px; color: #111;">
  <h2 style="margin:0 0 16px; color:#d62976;">Pro Max Plan 新規相談申込</h2>
  <table style="border-collapse: collapse; width: 100%; max-width: 560px;">
    <tr><td style="padding:8px 12px; background:#f6f6f6; font-weight:bold; width:140px;">会社名</td><td style="padding:8px 12px;">${escapeHtml(inquiry.company_name || '-')}</td></tr>
    <tr><td style="padding:8px 12px; background:#f6f6f6; font-weight:bold;">お名前</td><td style="padding:8px 12px;">${escapeHtml(inquiry.contact_name || '-')}</td></tr>
    <tr><td style="padding:8px 12px; background:#f6f6f6; font-weight:bold;">メール</td><td style="padding:8px 12px;">${escapeHtml(inquiry.email || '-')}</td></tr>
    <tr><td style="padding:8px 12px; background:#f6f6f6; font-weight:bold;">電話</td><td style="padding:8px 12px;">${escapeHtml(inquiry.phone || '（未記入）')}</td></tr>
    <tr><td style="padding:8px 12px; background:#f6f6f6; font-weight:bold;">事業内容</td><td style="padding:8px 12px; white-space: pre-wrap;">${escapeHtml(inquiry.business_description || '（未記入）')}</td></tr>
    <tr><td style="padding:8px 12px; background:#f6f6f6; font-weight:bold;">相談内容</td><td style="padding:8px 12px; white-space: pre-wrap;">${escapeHtml(inquiry.inquiry_details || '（未記入）')}</td></tr>
    <tr><td style="padding:8px 12px; background:#f6f6f6; font-weight:bold;">Clerk User ID</td><td style="padding:8px 12px; font-family: monospace; font-size: 12px;">${escapeHtml(inquiry.user_id || '（未ログイン）')}</td></tr>
    <tr><td style="padding:8px 12px; background:#f6f6f6; font-weight:bold;">受信日時</td><td style="padding:8px 12px;">${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td></tr>
  </table>
  <p style="margin-top:20px; font-size:13px; color:#666;">Supabase: pro_max_inquiries テーブルにも記録済みです。</p>
</body>
</html>`;

    try {
        await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: ADMIN_EMAIL }] }],
                from: { email: FROM_EMAIL, name: APP_NAME },
                subject: `【${APP_NAME}】Pro Max Plan 新規相談申込: ${inquiry.company_name || inquiry.contact_name}`,
                content: [{ type: 'text/html', value: html }]
            })
        });
    } catch (e) {
        console.error('[pro-max-inquiry] 管理者通知メール送信失敗:', e);
    }
}

async function sendAutoReply(inquiry) {
    if (!process.env.SENDGRID_API_KEY || !inquiry.email) return;

    const html = `
<!doctype html>
<html lang="ja">
<body style="font-family: system-ui, 'Hiragino Sans', sans-serif; padding: 32px 16px; background:#fafafa; color:#222;">
  <div style="max-width: 600px; margin: 0 auto; background:#ffffff; border:1px solid #e5e5e5; border-radius: 8px; padding: 32px;">
    <h1 style="font-size: 20px; margin: 0 0 20px; color:#1a1a1a; font-weight: bold;">Pro Max Plan お問い合わせを承りました</h1>

    <p style="line-height: 1.8; margin: 0 0 16px;">${escapeHtml(inquiry.contact_name)} 様</p>

    <p style="line-height: 1.8; margin: 0 0 16px;">
      この度は、SNS Agent 24 Pro Max Plan につきまして<br>
      お問い合わせを賜り、誠にありがとうございます。
    </p>

    <p style="line-height: 1.8; margin: 0 0 16px;">
      お申込みいただいた内容を確認の上、<strong style="color:#d62976;">2営業日以内</strong>に<br>
      担当者より改めてご連絡を差し上げます。
    </p>

    <p style="line-height: 1.8; margin: 0 0 16px;">
      Pro Max Plan は、お客様の事業特性・ブランドガイドライン・<br>
      ターゲット層に合わせたオーダーメイド設定を行った上で<br>
      ご契約・ご利用開始となる、エンタープライズ向けの運用プランです。<br>
      まずは現状の課題や運用目標について、お気軽にご相談ください。
    </p>

    <div style="background:#f6f6f6; border-left: 3px solid #d62976; padding: 16px 20px; margin: 24px 0; border-radius: 4px;">
      <p style="margin:0 0 8px; font-size: 13px; color:#666; font-weight:bold;">お問い合わせ内容（受付控え）</p>
      <table style="width:100%; font-size: 13px; color:#333;">
        <tr><td style="padding:4px 0; width: 80px; color:#888;">会社名</td><td>${escapeHtml(inquiry.company_name || '-')}</td></tr>
        <tr><td style="padding:4px 0; color:#888;">お名前</td><td>${escapeHtml(inquiry.contact_name || '-')}</td></tr>
        <tr><td style="padding:4px 0; color:#888;">メール</td><td>${escapeHtml(inquiry.email || '-')}</td></tr>
        <tr><td style="padding:4px 0; color:#888;">電話</td><td>${escapeHtml(inquiry.phone || '（未記入）')}</td></tr>
      </table>
    </div>

    <p style="line-height: 1.8; margin: 24px 0 0; font-size: 14px; color:#555;">
      今後とも ${APP_NAME} をどうぞよろしくお願い申し上げます。
    </p>

    <hr style="border:none; border-top: 1px solid #e5e5e5; margin: 32px 0;">

    <div style="font-size: 12px; color:#888; line-height: 1.6;">
      <p style="margin: 0 0 8px;"><strong>${APP_NAME}</strong> カスタマーサクセス</p>
      <p style="margin: 0 0 4px;">DEARS Consulting</p>
      <p style="margin: 0;">本メールは自動送信されています。このアドレスへのご返信にはお答えできない場合があります。</p>
    </div>
  </div>
</body>
</html>`;

    try {
        await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: inquiry.email }] }],
                from: { email: FROM_EMAIL, name: APP_NAME },
                subject: `【${APP_NAME}】Pro Max Plan お問い合わせを承りました`,
                content: [{ type: 'text/html', value: html }]
            })
        });
    } catch (e) {
        console.error('[pro-max-inquiry] 自動返信メール送信失敗:', e);
    }
}

export async function POST(req) {
    try {
        const clientId = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const now = Date.now();
        const previous = inquiryTimestamps.get(clientId) || 0;
        if (now - previous < 60_000) {
            return NextResponse.json({ error: '送信間隔を空けてもう一度お試しください' }, { status: 429 });
        }

        // ログイン必須ではないが、ログイン済みならuser_idを記録
        let userId = null;
        try {
            const authResult = await auth();
            userId = authResult?.userId || null;
        } catch (e) {
            // ignore - auth optional
        }

        const body = await req.json();
        const {
            company_name,
            contact_name,
            email,
            phone,
            business_description,
            inquiry_details
        } = body || {};

        if (body?.company_website) {
            return NextResponse.json({ success: true });
        }

        // バリデーション
        if (!company_name || !contact_name || !email) {
            return NextResponse.json({ error: '必須項目（会社名・お名前・メール）が入力されていません' }, { status: 400 });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 });
        }

        const record = {
            user_id: userId,
            company_name: String(company_name).slice(0, 200),
            contact_name: String(contact_name).slice(0, 100),
            email: String(email).slice(0, 200),
            phone: phone ? String(phone).slice(0, 50) : null,
            business_description: business_description ? String(business_description).slice(0, 2000) : null,
            inquiry_details: inquiry_details ? String(inquiry_details).slice(0, 4000) : null,
            status: 'new'
        };

        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return NextResponse.json({ error: 'お問い合わせ受付を一時的に利用できません' }, { status: 503 });
        }

        const { data, error } = await supabase
            .from('pro_max_inquiries')
            .insert(record)
            .select()
            .maybeSingle();

        if (error) throw error;
        inquiryTimestamps.set(clientId, now);

        waitUntil(Promise.all([
            sendAdminNotification({ ...record, user_id: userId }),
            sendAutoReply(record)
        ]).catch(e => console.error('[pro-max-inquiry] メール送信エラー（非致命）:', e)));

        return NextResponse.json({ success: true, id: data?.id });
    } catch (error) {
        console.error('[pro-max-inquiry] POST error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
