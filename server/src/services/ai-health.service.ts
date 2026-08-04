import { env } from '../config/environment';
import { attemptGemini, attemptGroq, isRetryableError, AIGenerateParams } from '../config/ai';

export type AIProviderName = 'gemini' | 'groq';

export interface AIProviderHealth {
  provider: AIProviderName;
  configured: boolean;
  available: boolean;
  latencyMs: number | null;
  error?: string;
}

export type AIHealthOverall = 'unconfigured' | 'all' | 'partial' | 'none';

export interface AIHealthReport {
  overall: AIHealthOverall;
  ready: boolean;
  checkedAt: string;
  providers: AIProviderHealth[];
}

const PING_TIMEOUT_MS = 15000;
const PING_MAX_ATTEMPTS = 3;
const PING_RETRY_DELAY_MS = 1000;

const PING_PARAMS: AIGenerateParams = {
  systemInstruction: 'You are a health-check probe. Reply with exactly the single word ok.',
  prompt: 'Reply with exactly the single word ok.',
  temperature: 0,
  maxTokens: 1024,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function notConfigured(provider: AIProviderName): AIProviderHealth {
  return { provider, configured: false, available: false, latencyMs: null };
}

async function pingProvider(
  provider: AIProviderName,
  fn: (params: AIGenerateParams) => Promise<string>,
): Promise<AIProviderHealth> {
  const start = Date.now();
  // Whole probe is bounded by one deadline; each attempt gets the remaining time.
  const deadline = start + PING_TIMEOUT_MS;
  let lastError = '';

  for (let attempt = 0; attempt < PING_MAX_ATTEMPTS; attempt++) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('Request timed out after ' + remainingMs + 'ms')),
        remainingMs,
      );
    });

    try {
      await Promise.race([fn(PING_PARAMS), timeout]);
      if (timer) clearTimeout(timer);
      return { provider, configured: true, available: true, latencyMs: Date.now() - start };
    } catch (error) {
      if (timer) clearTimeout(timer);
      lastError = error instanceof Error ? error.message : String(error);
      // Mirrors generateFromAI: transient 429/503/quota/empty blips get retried
      // with backoff so the banner doesn't cry wolf on a single bad response.
      if (attempt >= PING_MAX_ATTEMPTS - 1 || !isRetryableError(lastError)) break;
      // Never sleep past the overall deadline.
      const backoffMs = Math.min(PING_RETRY_DELAY_MS * (attempt + 1), deadline - Date.now());
      if (backoffMs > 0) await sleep(backoffMs);
    }
  }

  return {
    provider,
    configured: true,
    available: false,
    latencyMs: Date.now() - start,
    error: lastError.slice(0, 200),
  };
}

export async function checkAIHealth(): Promise<AIHealthReport> {
  const geminiConfigured = !!env.GEMINI_API_KEY;
  const groqConfigured = !!env.GROQ_API_KEY;

  const geminiPing = geminiConfigured
    ? pingProvider('gemini', attemptGemini)
    : Promise.resolve(notConfigured('gemini'));
  // attemptGroq reports available if ANY of its 4 fallback models responds,
  // which mirrors how reviews are actually served.
  const groqPing = groqConfigured
    ? pingProvider('groq', attemptGroq)
    : Promise.resolve(notConfigured('groq'));

  const [gemini, groq] = await Promise.all([geminiPing, groqPing]);
  const providers = [gemini, groq];

  const configured = providers.filter((p) => p.configured).length;
  const available = providers.filter((p) => p.available).length;

  let overall: AIHealthOverall;
  if (configured === 0) overall = 'unconfigured';
  else if (available === configured) overall = 'all';
  else if (available === 0) overall = 'none';
  else overall = 'partial';

  return {
    overall,
    ready: available > 0,
    checkedAt: new Date().toISOString(),
    providers,
  };
}
