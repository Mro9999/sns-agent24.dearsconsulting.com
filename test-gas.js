const fetch = require('node-fetch');

async function testGoogleScript() {
    const url = 'https://script.google.com/macros/s/AKfycbxpn7NmtMArpcrCrWW6caoroY3HKS-GatxjZ3h08mg8I0IY_F7Fgp087oXRElyqp_uVC/exec';

    console.log('Sending test data to Google Apps Script...');
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: 'test_user_id_12345',
                email: 'test@example.com',
                firstName: 'Test',
                lastName: 'User',
                date: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
            })
        });

        if (response.ok) {
            console.log('Success! Response status:', response.status);
            const text = await response.text();
            console.log('Response body:', text);
        } else {
            console.error('Failed! Response status:', response.status);
            const text = await response.text();
            console.error('Response error:', text);
        }
    } catch (error) {
        console.error('Error during fetch:', error);
    }
}

testGoogleScript();
