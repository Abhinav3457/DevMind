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

// Groq models with large context windows (current production models as of 2026)
// Note: mixtral-8x7b-32768 (retired Mar 2025) and llama-3.1-8b-instant (retired Aug 2026)
// are no longer reliable — using llama-3.3 and gpt-oss instead.
// llama-3.3-70b-versatile is tried FIRST because it is the only Groq model verified
// to handle this app's prompts (gpt-oss/qwen cap at 8K tokens/min on free tier and
// 413 on large code-review prompts).
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b'];

// Groq free tier caps gpt-oss/qwen at ~8K tokens/min, so large prompts (e.g. code
// reviews of 5 files x 100 lines) 413 with "Request too large". Gemini allows
// 250K tokens/min, so large prompts are routed straight to Gemini.
const LARGE_PROMPT_CHARS = 30000;

// Gemini model verified to work with free-tier keys (gemini-2.5-flash is retired
// for new users and returns 404).
const GEMINI_MODEL = 'gemini-3.5-flash';

export async function generateFromAI(params: AIGenerateParams): Promise<string> {
  const { systemInstruction, prompt, temperature = 0.3, maxTokens = 4096 } = params;

  // Check if any AI provider is configured
  if (!env.GROQ_API_KEY && !env.GEMINI_API_KEY) {
    throw new Error('No AI service configured. Set GEMINI_API_KEY or GROQ_API_KEY in your .env file.');
  }

  // Large prompts (code reviews, big docs) exceed Groq's ~8K tokens/min free-tier
  // limit for gpt-oss/qwen and 413 with "Request too large". Route them straight to
  // Gemini (250K tokens/min) when it is available. If Gemini is NOT configured, still
  // attempt Groq — llama-3.3-70b-versatile (first in the list) can handle large prompts.
  const promptChars = systemInstruction.length + prompt.length;
  const useGroq = env.GROQ_API_KEY && (!env.GEMINI_API_KEY || promptChars <= LARGE_PROMPT_CHARS);

  if (useGroq) {
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
          max_tokens: Math.min(maxTokens, 8192),
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

  logger.info('AI: Using Gemini (model: ' + GEMINI_MODEL + ')');
  const model = getGeminiModel(GEMINI_MODEL);
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
