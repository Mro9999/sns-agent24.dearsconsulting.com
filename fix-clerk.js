import { clerkClient } from '@clerk/nextjs/server';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function fix() {
    const userId = "user_39riLiGtlzlkxmRPNtrXxlI1acK"; // extracted from previous check-clerk.js output
    const client = clerkClient();
    try {
        await client.users.updateUserMetadata(userId, {
            publicMetadata: {
                role: null // reset role to null
            },
            privateMetadata: {
                stripeCustomerId: null
            }
        });
        console.log("Successfully reset user PRO role. User is now back to FREE plan.");
    } catch (e) {
        console.error(e);
    }
}
fix();
