const { GoogleGenAI } = require('@google/genai');

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: 'hello',
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    console.log("SUCCESS:", response.text);
  } catch (error) {
    console.error("ERROR:", error.message);
    console.error("FULL ERROR:", error);
  }
}

test();
