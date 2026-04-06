import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { clerkClient } from "@clerk/nextjs/server";

export async function POST(req) {
    const body = await req.text();
    const signature = headers().get("Stripe-Signature"); // await headers() if Next 15? No, kept simple.

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
    }

    const session = event.data.object;

    if (event.type === "checkout.session.completed") {
        const subscription = await stripe.subscriptions.retrieve(
            session.subscription
        );

        if (!session?.metadata?.userId) {
            return new NextResponse("User ID is missing in session metadata", { status: 400 });
        }

        const priceId = subscription.items.data[0].price.id;
        
        // プランを判定
        const isProMax = 
            priceId === process.env.STRIPE_PRICE_ID_PROMAX_MONTHLY || 
            priceId === process.env.STRIPE_PRICE_ID_PROMAX_YEARLY;
            
        const assignedRole = isProMax ? 'promax' : 'pro';

        await clerkClient.users.updateUserMetadata(session.metadata.userId, {
            privateMetadata: {
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: subscription.customer,
                stripePriceId: priceId,
                stripeCurrentPeriodEnd: new Date(
                    subscription.current_period_end * 1000
                ),
            },
            publicMetadata: {
                role: assignedRole
            }
        });

        // スプレッドシート側の「有料プラン登録日時(E列)」をアップデート
        if (process.env.GOOGLE_SCRIPT_URL) {
            try {
                const date = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
                const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'update',
                        userId: session.metadata.userId,
                        date: date
                    })
                });
                if (!response.ok) console.error('Failed to update Google Sheets (Stripe):', await response.text());
            } catch (error) {
                console.error('Error updating Google Sheets from Stripe webhook:', error);
            }
        }

        // 管理者へ課金通知メール自動送信 (scuderia.ct@gmail.com宛)
        if (process.env.SENDGRID_API_KEY) {
            try {
                const adminEmail = 'scuderia.ct@gmail.com';
                const customerEmail = session.customer_details?.email || '不明';
                const customerName = session.customer_details?.name || '不明';
                const amount = session.amount_total ? `¥${session.amount_total.toLocaleString()}` : '不明';

                const planName = isProMax ? 'Pro Maxプラン' : 'Proプラン';
                const emailContent = `SNS Agent24で${planName}の新規サブスクリプション契約が完了しました。\n\nお名前: ${customerName}\nメールアドレス: ${customerEmail}\n決済金額: ${amount}\nユーザーID (Clerk): ${session.metadata.userId}\nStripe顧客ID: ${subscription.customer}\n契約日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;

                const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        personalizations: [{ to: [{ email: adminEmail }] }],
                        from: { email: 'notifications@dearsconsulting.com', name: 'SNS Agent24 通知システム' },
                        subject: `【${planName}登録完了】${customerName} 様がサブスク契約しました`,
                        content: [{ type: 'text/plain', value: emailContent }]
                    })
                });

                if (response.ok) {
                    console.log('Successfully sent subscription notification email to Admin.');
                } else {
                    console.error('Failed to send subscription notification to Admin:', await response.text());
                }
            } catch (error) {
                console.error('Error sending admin notification (checkout.session.completed):', error);
            }
        }
    }

    if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;

        if (userId) {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: {
                    stripeSubscriptionId: null,
                    stripePriceId: null,
                    stripeCurrentPeriodEnd: null,
                },
                publicMetadata: {
                    role: null
                }
            });
        }
    }

    return new NextResponse(null, { status: 200 });
}
