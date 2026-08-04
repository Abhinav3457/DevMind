import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkAIHealth } from '../ai-health.service';

const { mockAttemptGemini, mockAttemptGroq, env } = vi.hoisted(() => ({
  mockAttemptGemini: vi.fn(),
  mockAttemptGroq: vi.fn(),
  env: { GEMINI_API_KEY: 'test-gemini-key', GROQ_API_KEY: 'test-groq-key' },
}));

vi.mock('../../config/ai', () => ({
  attemptGemini: mockAttemptGemini,
  attemptGroq: mockAttemptGroq,
}));

vi.mock('../../config/environment', () => ({ env }));

function provider(report: Awaited<ReturnType<typeof checkAIHealth>>, name: 'gemini' | 'groq') {
  return report.providers.find((p) => p.provider === name)!;
}

describe('checkAIHealth', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    env.GEMINI_API_KEY = 'test-gemini-key';
    env.GROQ_API_KEY = 'test-groq-key';
    mockAttemptGemini.mockResolvedValue('ok');
    mockAttemptGroq.mockResolvedValue('ok');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports all providers available when both pings succeed', async () => {
    const report = await checkAIHealth();

    expect(report.overall).toBe('all');
    expect(report.ready).toBe(true);
    expect(mockAttemptGemini).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 1024, temperature: 0 }),
    );
    expect(provider(report, 'gemini')).toMatchObject({ configured: true, available: true });
    expect(provider(report, 'groq')).toMatchObject({ configured: true, available: true });
    expect(provider(report, 'gemini').latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reports partial availability when only one provider works', async () => {
    mockAttemptGemini.mockRejectedValue(new Error('Gemini returned an empty response'));

    const report = await checkAIHealth();

    expect(report.overall).toBe('partial');
    expect(report.ready).toBe(true);
    expect(provider(report, 'gemini').available).toBe(false);
    expect(provider(report, 'gemini').error).toContain('Gemini returned an empty response');
    expect(provider(report, 'groq').available).toBe(true);
  });

  it('reports none when every configured provider fails', async () => {
    mockAttemptGemini.mockRejectedValue(new Error('503 Service Unavailable'));
    mockAttemptGroq.mockRejectedValue(new Error('413 Request too large'));

    const report = await checkAIHealth();

    expect(report.overall).toBe('none');
    expect(report.ready).toBe(false);
    expect(provider(report, 'gemini').available).toBe(false);
    expect(provider(report, 'groq').available).toBe(false);
  });

  it('marks an unconfigured provider without pinging it', async () => {
    env.GEMINI_API_KEY = '';

    const report = await checkAIHealth();

    expect(mockAttemptGemini).not.toHaveBeenCalled();
    expect(mockAttemptGroq).toHaveBeenCalled();
    expect(provider(report, 'gemini')).toMatchObject({ configured: false, available: false, latencyMs: null });
    expect(report.overall).toBe('all');
  });

  it('reports unconfigured when no provider keys are set', async () => {
    env.GEMINI_API_KEY = '';
    env.GROQ_API_KEY = '';

    const report = await checkAIHealth();

    expect(report.overall).toBe('unconfigured');
    expect(report.ready).toBe(false);
    expect(mockAttemptGemini).not.toHaveBeenCalled();
    expect(mockAttemptGroq).not.toHaveBeenCalled();
  });

  it('reports a provider as unavailable when the ping times out', async () => {
    vi.useFakeTimers();
    mockAttemptGemini.mockImplementation(() => new Promise(() => {}));

    const promise = checkAIHealth();
    await vi.advanceTimersByTimeAsync(20000);
    const report = await promise;

    expect(report.overall).toBe('partial');
    expect(provider(report, 'gemini').available).toBe(false);
    expect(provider(report, 'gemini').error).toContain('timed out');
    expect(provider(report, 'groq').available).toBe(true);
  });
});
