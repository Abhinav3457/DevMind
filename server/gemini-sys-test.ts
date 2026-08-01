require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

(async () => {
  // Mimic generateFromAI's exact call shape for a large prompt (systemInstruction with role user)
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Review this code: const x = 1;' }] }],
      systemInstruction: { role: 'user', parts: [{ text: 'You are a code reviewer.'.repeat(100) }] },
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    });
    console.log('GEMINI systemInstruction WITH role=user => OK:', result.response.text().slice(0, 80));
  } catch (e) {
    console.log('GEMINI systemInstruction WITH role=user => FAIL:', String(e.message || e).slice(0, 200));
  }
})();
