import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req) {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
        throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
    }

    // Get the headers
    const headerPayload = headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
        return new NextResponse('Error occured -- no svix headers', {
            status: 400
        })
    }

    // Get the body
    const payload = await req.json()
    const body = JSON.stringify(payload);

    // Create a new Svix instance with your secret.
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt;

    // Verify the payload with the headers
    try {
        evt = wh.verify(body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        });
    } catch (err) {
        console.error('Error verifying webhook:', err);
        return new NextResponse('Error occured', {
            status: 400
        })
    }

    const { id } = evt.data;
    const eventType = evt.type;

    console.log(`Webhook with and ID of ${id} and type of ${eventType}`)
    // console.log('Webhook body:', body)

    // Handle email.created event (Custom Email Delivery via SendGrid)
    if (eventType === 'email.created') {
        const { to_email_address, subject, body: htmlBody, body_plain, from_email_name } = evt.data;

        console.log(`Sending custom email via SendGrid to: ${to_email_address} with subject: ${subject}`);

        if (to_email_address && process.env.SENDGRID_API_KEY) {
            try {
                // SendGridの送信APIへ直接fetchでリクエスト
                const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        personalizations: [{ to: [{ email: to_email_address }] }],
                        from: { email: 'notifications@dearsconsulting.com', name: from_email_name || 'SNS Agent24' },
                        subject: subject || '認証コードのご案内',
                        content: [
                            ...(htmlBody ? [{ type: 'text/html', value: htmlBody }] : []),
                            ...(body_plain ? [{ type: 'text/plain', value: body_plain }] : []),
                            // 万が一どちらも空だった場合のエラー回避用ダミーパラメーター
                            ...(!htmlBody && !body_plain ? [{ type: 'text/plain', value: 'Content missing.' }] : [])
                        ]
                    })
                });

                if (response.ok) {
                    console.log(`Successfully sent email to ${to_email_address} via SendGrid API`);
                } else {
                    console.error('Failed to send email via SendGrid API:', await response.text());
                }
            } catch (error) {
                console.error('Error sending email through SendGrid API:', error);
            }
        } else {
            console.error('Missing to_email_address or SENDGRID_API_KEY');
        }
    }

    // Handle user.created event
    if (eventType === 'user.created') {
        const { id, email_addresses, first_name, last_name, created_at } = evt.data;
        const primaryEmail = email_addresses[0]?.email_address;

        console.log(`New user created: ${primaryEmail}`);

        if (primaryEmail && process.env.GOOGLE_SCRIPT_URL) {
            try {
                // Formatting date for spreadsheet
                const date = new Date(created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

                const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'add',
                        userId: id,
                        email: primaryEmail,
                        firstName: first_name || '',
                        lastName: last_name || '',
                        date: date
                    })
                });

                if (response.ok) {
                    console.log('Successfully sent to Google Sheets');
                } else {
                    console.error('Failed to send to Google Sheets:', await response.text());
                }
            } catch (error) {
                console.error('Error sending data to Google Sheets script:', error);
            }
        }

        // 管理者へ通知メール自動送信 (scuderia.ct@gmail.com宛)
        if (process.env.SENDGRID_API_KEY) {
            try {
                const adminEmail = 'scuderia.ct@gmail.com';
                const userName = `${first_name || ''} ${last_name || ''}`.trim() || '名称未設定';
                const emailContent = `SNS Agent24に新しいユーザー登録がありました。\n\nお名前: ${userName}\nメールアドレス: ${primaryEmail}\nユーザーID: ${id}\n登録日時: ${new Date(created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;

                const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        personalizations: [{ to: [{ email: adminEmail }] }],
                        from: { email: 'notifications@dearsconsulting.com', name: 'SNS Agent24 通知システム' },
                        subject: `【新規アカウント登録】${userName} 様`,
                        content: [{ type: 'text/plain', value: emailContent }]
                    })
                });

                if (response.ok) {
                    console.log('Successfully sent registration notification email to Admin.');
                } else {
                    console.error('Failed to send registration notification to Admin:', await response.text());
                }
            } catch (error) {
                console.error('Error sending admin notification (user.created):', error);
            }
        }
    }

    return new NextResponse('', { status: 200 })
}
