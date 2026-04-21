const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function testGemini() {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API Key found");
        return;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    console.log("Checking Gemini API capacity...");
    const startTime = Date.now();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: "Hi, this is a capacity and status check. Please reply with 'OK' if you can receive this.",
        });
        const elapsed = Date.now() - startTime;
        console.log(`[Success] API is responding normally. Response took ${elapsed}ms.`);
        console.log(`Response: ${response.text}`);
    } catch (e) {
        const elapsed = Date.now() - startTime;
        console.error(`[Error] API check failed after ${elapsed}ms:`, e.message);
    }
}

testGemini();
