require('dotenv').config({ path: '.env.local' });
const { clerkClient } = require('@clerk/clerk-sdk-node');

async function run() {
  try {
    const users = await clerkClient.users.getUserList();
    users.data.forEach(u => console.log(u.id, u.emailAddresses[0].emailAddress, u.publicMetadata));
  } catch(e) { console.error(e); }
}
run();
