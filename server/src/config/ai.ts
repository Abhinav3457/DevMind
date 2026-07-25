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

// Groq models with large context windows
const GROQ_MODELS = ['mixtral-8x7b-32768', 'llama-3.1-8b-instant'];

export async function generateFromAI(params: AIGenerateParams): Promise<string> {
  const { systemInstruction, prompt, temperature = 0.3, maxTokens = 4096 } = params;

  // Check if any AI provider is configured
  if (!env.GROQ_API_KEY && !env.GEMINI_API_KEY) {
    throw new Error('No AI service configured. Set GEMINI_API_KEY or GROQ_API_KEY in your .env file.');
  }

  // Try Groq first if API key is configured
  if (env.GROQ_API_KEY) {
    const client = getGroqClient();
    // Try each Groq model in order until one works
    for (const model of GROQ_MODELS) {
      try {
        logger.info('AI: Using Groq (model: ' + model + ')');
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt },
          ],
          temperature,
          max_tokens: Math.min(maxTokens, 2048),
        });
        const content = response.choices[0]?.message?.content || '';
        if (content) {
          logger.info('AI: Groq response received (' + content.length + ' chars)');
          return content;
        }
      } catch (groqError: unknown) {
        const errMsg = groqError instanceof Error ? groqError.message : String(groqError);
        logger.warn('AI: Groq model ' + model + ' failed (' + errMsg.slice(0, 120) + ')');
        // Continue to next model
      }
    }
    // All Groq models failed
    if (!env.GEMINI_API_KEY) {
      throw new Error('Groq failed with all available models. Try asking a more specific question or configure GEMINI_API_KEY as a fallback.');
    }
    logger.warn('AI: All Groq models failed, falling back to Gemini');
  }

  // Only try Gemini if API key is configured
  if (!env.GEMINI_API_KEY) {
    throw new Error('All AI providers failed. Configure GEMINI_API_KEY for a fallback, or check your GROQ_API_KEY.');
  }

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
