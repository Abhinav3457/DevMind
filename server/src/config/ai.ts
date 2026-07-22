import { env } from './environment';
import { getGeminiModel } from './gemini';
import Groq from 'groq-sdk';
import logger from '../utils/logger';

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: env.GROQ_API_KEY });
  }
  return groqClient;
}

export interface AIGenerateParams {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export async function generateFromAI(params: AIGenerateParams): Promise<string> {
  const { systemInstruction, prompt, temperature = 0.3, maxTokens = 4096 } = params;

  // Try Groq first if API key is configured
  if (env.GROQ_API_KEY) {
    try {
      logger.info('AI: Using Groq (model: llama-3.3-70b-versatile)');
      const client = getGroqClient();
      const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
      });
      const content = response.choices[0]?.message?.content || '';
      if (content) {
        logger.info('AI: Groq response received (' + content.length + ' chars)');
        return content;
      }
      logger.warn('AI: Groq returned empty response, falling back to Gemini');
    } catch (groqError: unknown) {
      const errMsg = groqError instanceof Error ? groqError.message : String(groqError);
      logger.warn('AI: Groq failed (' + errMsg.slice(0, 100) + '), falling back to Gemini');
    }
  }

  // Fall back to Gemini
  logger.info('AI: Using Gemini (model: gemini-2.0-flash)');
  const model = getGeminiModel('gemini-2.0-flash');
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  const content = result.response.text();
  logger.info('AI: Gemini response received (' + content.length + ' chars)');
  return content;
}
