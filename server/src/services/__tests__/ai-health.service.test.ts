import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAIHealth, resetAIHealthCache } from '../ai-health.service';

const { mockAttemptGemini, mockAttemptGroq } = vi.hoisted(() => ({
  mockAttemptGemini: vi.fn(),
  mockAttemptGroq: vi.fn(),
}));

vi.mock('../../config/ai', () => ({
  attemptGemini: mockAttemptGemini,
  attemptGroq: mockAttemptGroq,
  isRetryableError: (msg: string) => /429|503|quota|too many|empty response/i.test(msg),
}));

vi.mock('../../config/environment', () => ({
  env: { GEMINI_API_KEY: 'test-key', GROQ_API_KEY: 'test-key' },
}));

describe('checkAIHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAIHealthCache();
    mockAttemptGemini.mockResolvedValue('ok');
    mockAttemptGroq.mockResolvedValue('ok');
  });

  it('reports all providers available when both respond', async () => {
    const report = await checkAIHealth();
    expect(report.overall).toBe('all');
    expect(report.ready).toBe(true);
    expect(report.providers.every((p) => p.available)).toBe(true);
  });

  it('retries a transient Gemini failure and recovers', async () => {
    mockAttemptGemini
      .mockRejectedValueOnce(new Error('503 service unavailable'))
      .mockResolvedValueOnce('ok');

    const report = await checkAIHealth();
    expect(report.overall).toBe('all');
    expect(report.providers[0]?.available).toBe(true);
    expect(mockAttemptGemini).toHaveBeenCalledTimes(2);
  });

  it('retries an empty-response Gemini blip', async () => {
    mockAttemptGemini
      .mockRejectedValueOnce(new Error('Gemini returned an empty response'))
      .mockResolvedValueOnce('ok');

    const report = await checkAIHealth();
    expect(report.providers[0]?.available).toBe(true);
    expect(mockAttemptGemini).toHaveBeenCalledTimes(2);
  });

  it('marks Gemini unavailable on a permanent error without retrying', async () => {
    mockAttemptGemini.mockRejectedValue(new Error('API key not valid'));

    const report = await checkAIHealth();
    expect(report.overall).toBe('partial');
    expect(report.providers[0]?.available).toBe(false);
    expect(mockAttemptGemini).toHaveBeenCalledTimes(1);
  });

  it('reports partial when one provider exhausts retries and the other succeeds', async () => {
    mockAttemptGemini.mockRejectedValue(new Error('503 service unavailable'));
    // Groq keeps its default mockResolvedValue('ok').

    const report = await checkAIHealth();
    expect(report.overall).toBe('partial');
    expect(report.providers[0]?.available).toBe(false);
    expect(report.providers[1]?.available).toBe(true);
    expect(mockAttemptGemini).toHaveBeenCalledTimes(3);
    expect(mockAttemptGroq).toHaveBeenCalledTimes(1);
  });

  it('marks both unavailable when all attempts fail', async () => {
    mockAttemptGemini.mockRejectedValue(new Error('503 service unavailable'));
    mockAttemptGroq.mockRejectedValue(new Error('429 rate limit exceeded'));

    const report = await checkAIHealth();
    expect(report.overall).toBe('none');
    expect(report.ready).toBe(false);
    expect(mockAttemptGemini).toHaveBeenCalledTimes(3);
    expect(mockAttemptGroq).toHaveBeenCalledTimes(3);
  });

  it('does not retry an exhausted quota error', async () => {
    mockAttemptGemini.mockRejectedValue(
      new Error('Quota exceeded for metric: generate_content_free_tier_requests, limit: 20'),
    );

    const report = await checkAIHealth();
    expect(report.providers[0]?.available).toBe(false);
    expect(mockAttemptGemini).toHaveBeenCalledTimes(1);
  });

  it('reuses a cached report on subsequent non-refresh checks', async () => {
    const first = await checkAIHealth();
    const second = await checkAIHealth();

    expect(second).toBe(first);
    expect(mockAttemptGemini).toHaveBeenCalledTimes(1);
    expect(mockAttemptGroq).toHaveBeenCalledTimes(1);
  });

  it('forces a fresh probe when refresh is requested', async () => {
    await checkAIHealth();
    await checkAIHealth(true);

    expect(mockAttemptGemini).toHaveBeenCalledTimes(2);
    expect(mockAttemptGroq).toHaveBeenCalledTimes(2);
  });
});
