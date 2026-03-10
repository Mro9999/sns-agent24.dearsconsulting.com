const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

async function check() {
    try {
        const res = await fetch('https://api.clerk.com/v1/users?email_address=scuderia.ct@gmail.com', {
            headers: {
                'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`
            }
        });
        const users = await res.json();
        console.log(JSON.stringify(users[0], null, 2));
    } catch (e) {
        console.error(e);
    }
}
check();
