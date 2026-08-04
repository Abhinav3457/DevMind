import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateFromAI } from '../ai';

// ── Create mock functions using vi.hoisted() to survive hoisting ──

const { mockGeminiGenerateContent, mockGroqCreate, mockGetGeminiModel, env } = vi.hoisted(() => ({
  mockGeminiGenerateContent: vi.fn(),
  mockGroqCreate: vi.fn(),
  mockGetGeminiModel: vi.fn(),
  env: { GEMINI_API_KEY: 'test-gemini-key', GROQ_API_KEY: 'test-groq-key' },
}));

// ── Mock all dependencies ───────────────────────────────────────

vi.mock('../environment', () => ({ env }));

vi.mock('../gemini', () => ({
  getGeminiModel: mockGetGeminiModel,
}));

vi.mock('groq-sdk', () => ({
  default: class MockGroq {
    chat = { completions: { create: mockGroqCreate } };
  },
}));

vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Helper: fake Gemini generateContent result ─────────────────

function fakeGeminiResponse(text: string) {
  return {
    response: {
      text: () => text,
      candidates: [{ finishReason: 'STOP' }],
      promptFeedback: undefined,
    },
  };
}

// A prompt large enough (> 30000 chars) to flip generateFromAI's
// preference from Groq to Gemini.
const LARGE_PROMPT = 'x'.repeat(30001);

describe('generateFromAI', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetGeminiModel.mockReturnValue({ generateContent: mockGeminiGenerateContent });
    env.GEMINI_API_KEY = 'test-gemini-key';
    env.GROQ_API_KEY = 'test-groq-key';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prefers Groq for small prompts and returns its answer', async () => {
    mockGroqCreate.mockResolvedValue({ choices: [{ message: { content: 'groq answer' } }] });

    const result = await generateFromAI({ systemInstruction: 'sys', prompt: 'small prompt' });

    expect(result).toBe('groq answer');
    expect(mockGroqCreate).toHaveBeenCalled();
    expect(mockGeminiGenerateContent).not.toHaveBeenCalled();
  });

  it('prefers Gemini for large prompts', async () => {
    mockGeminiGenerateContent.mockResolvedValue(fakeGeminiResponse('gemini answer'));

    const result = await generateFromAI({ systemInstruction: 'sys', prompt: LARGE_PROMPT });

    expect(result).toBe('gemini answer');
    expect(mockGeminiGenerateContent).toHaveBeenCalled();
    expect(mockGroqCreate).not.toHaveBeenCalled();
  });

  it('retries a transient empty Gemini response before succeeding', async () => {
    vi.useFakeTimers();
    mockGeminiGenerateContent
      .mockResolvedValueOnce(fakeGeminiResponse(''))
      .mockResolvedValueOnce(fakeGeminiResponse('review done'));

    const promise = generateFromAI({ systemInstruction: 'sys', prompt: LARGE_PROMPT });
    await vi.advanceTimersByTimeAsync(10000);
    const result = await promise;

    expect(result).toBe('review done');
    expect(mockGeminiGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('treats a whitespace-only Gemini response as empty and retries', async () => {
    vi.useFakeTimers();
    mockGeminiGenerateContent
      .mockResolvedValueOnce(fakeGeminiResponse('   \n  '))
      .mockResolvedValueOnce(fakeGeminiResponse('review done'));

    const promise = generateFromAI({ systemInstruction: 'sys', prompt: LARGE_PROMPT });
    await vi.advanceTimersByTimeAsync(10000);
    const result = await promise;

    expect(result).toBe('review done');
    expect(mockGeminiGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('falls back to Groq when Gemini keeps returning empty responses', async () => {
    vi.useFakeTimers();
    mockGeminiGenerateContent.mockResolvedValue(fakeGeminiResponse(''));
    mockGroqCreate.mockResolvedValue({ choices: [{ message: { content: 'groq fallback' } }] });

    const promise = generateFromAI({ systemInstruction: 'sys', prompt: LARGE_PROMPT });
    await vi.advanceTimersByTimeAsync(30000);
    const result = await promise;

    expect(result).toBe('groq fallback');
    // 3 retry attempts on Gemini before falling through to Groq
    expect(mockGeminiGenerateContent).toHaveBeenCalledTimes(3);
    expect(mockGroqCreate).toHaveBeenCalled();
  });

  it('falls back to Gemini when Groq fails on a small prompt', async () => {
    vi.useFakeTimers();
    mockGroqCreate.mockRejectedValue(new Error('429 rate limit exceeded'));
    mockGeminiGenerateContent.mockResolvedValue(fakeGeminiResponse('gemini answer'));

    const promise = generateFromAI({ systemInstruction: 'sys', prompt: 'small prompt' });
    await vi.advanceTimersByTimeAsync(30000);
    const result = await promise;

    expect(result).toBe('gemini answer');
    expect(mockGeminiGenerateContent).toHaveBeenCalled();
  });

  it('reports every provider failure when all attempts fail', async () => {
    vi.useFakeTimers();
    mockGeminiGenerateContent.mockResolvedValue(fakeGeminiResponse(''));
    mockGroqCreate.mockRejectedValue(new Error('413 Request too large for model'));

    const promise = generateFromAI({ systemInstruction: 'sys', prompt: LARGE_PROMPT });
    // Attach the rejection handler FIRST so the error isn't unhandled while
    // the retry backoff timers are still advancing.
    const rejection = promise.catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(40000);

    const error = await rejection;
    expect(error.message).toContain('All AI providers failed');
    expect(error.message).toContain('Gemini returned an empty response');
    expect(error.message).toContain('Request too large');
  });

  it('throws a clear error when no AI provider is configured', async () => {
    env.GEMINI_API_KEY = '';
    env.GROQ_API_KEY = '';

    await expect(generateFromAI({ systemInstruction: 'sys', prompt: 'hi' })).rejects.toThrow(
      /No AI service configured/,
    );
  });
});
