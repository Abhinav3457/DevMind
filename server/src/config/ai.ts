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
// 250K tokens/min, so large prompts are preferred on Gemini first.
const LARGE_PROMPT_CHARS = 30000;

// Gemini model verified to work with free-tier keys (gemini-2.5-flash is retired
// for new users and returns 404).
const GEMINI_MODEL = 'gemini-3.5-flash';

// How many times to retry a single provider on transient failures (429/503/5xx),
// and the base delay between attempts (grows with each retry).
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1500;

function isTransientError(message: string): boolean {
  return (
    /503|429|5\d\d|quota|too many requests|high demand|temporar|overloaded|unavailable|busy/i.test(
      message,
    )
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptGroq(params: AIGenerateParams): Promise<string> {
  const { systemInstruction, prompt, temperature = 0.3, maxTokens = 4096 } = params;
  const client = getGroqClient();
  let lastError = 'All Groq models failed';

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
      lastError = groqError instanceof Error ? groqError.message : String(groqError);
      logger.warn('AI: Groq model ' + model + ' failed (' + lastError.slice(0, 140) + ')');
    }
  }

  throw new Error(lastError);
}

async function attemptGemini(params: AIGenerateParams): Promise<string> {
  const { systemInstruction, prompt, temperature = 0.3, maxTokens = 4096 } = params;

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
  if (!content) {
    throw new Error('Gemini returned an empty response');
  }
  logger.info('AI: Gemini response received (' + content.length + ' chars)');
  return content;
}

export async function generateFromAI(params: AIGenerateParams): Promise<string> {
  const { systemInstruction, prompt } = params;

  // Check if any AI provider is configured
  if (!env.GROQ_API_KEY && !env.GEMINI_API_KEY) {
    throw new Error('No AI service configured. Set GEMINI_API_KEY or GROQ_API_KEY in your .env file.');
  }

  const promptChars = systemInstruction.length + prompt.length;
  const largePrompt = promptChars > LARGE_PROMPT_CHARS;
  const groqAvailable = !!env.GROQ_API_KEY;
  const geminiAvailable = !!env.GEMINI_API_KEY;

  // Build the provider queue:
  // - Large prompts (repo reviews, big docs) are preferred on Gemini (250K tokens/min)
  //   but always keep Groq as a fallback — llama-3.3-70b-versatile handles large prompts.
  // - Small prompts are preferred on Groq (fast, free) with Gemini as a fallback.
  // - If the preferred provider fails permanently, the other provider is still tried,
  //   so a single provider outage never takes the feature down.
  const providers: Array<() => Promise<string>> = [];
  if (largePrompt && geminiAvailable) providers.push(() => attemptGemini(params));
  if (groqAvailable) providers.push(() => attemptGroq(params));
  if (!largePrompt && geminiAvailable) providers.push(() => attemptGemini(params));

  if (providers.length === 0) {
    throw new Error('All AI providers failed. Configure GEMINI_API_KEY for a fallback, or check your GROQ_API_KEY.');
  }

  let lastError: unknown = new Error('All AI providers failed');

  for (const attempt of providers) {
    for (let tryCount = 0; tryCount < MAX_ATTEMPTS; tryCount++) {
      try {
        return await attempt();
      } catch (error) {
        lastError = error;
        const errMsg = error instanceof Error ? error.message : String(error);
        const transient = isTransientError(errMsg);
        logger.warn('AI: provider attempt failed (' + errMsg.slice(0, 180) + ')');

        // Transient errors (429/503/quota) are worth retrying; permanent errors
        // (invalid model, auth failure) should fall through to the next provider.
        if (transient && tryCount < MAX_ATTEMPTS - 1) {
          await sleep(RETRY_DELAY_MS * (tryCount + 1));
        } else if (!transient) {
          break;
        }
      }
    }
  }

  const finalMessage = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error('All AI providers failed. ' + finalMessage.slice(0, 300));
}
