import { Request, Response } from 'express';
import { checkAIHealth } from '../services/ai-health.service';
import { sendSuccess } from '../utils/apiResponse';

export class AIHealthController {
  async check(req: Request, res: Response): Promise<void> {
    // ?refresh=1 (manual "Check" clicks) requests a live probe; the default
    // client poll and ?strict=1 monitoring both reuse the cached report so
    // repeated checks never burn provider quota (free-tier Gemini caps at
    // ~20 requests/day). Forced probes are additionally throttled server-side.
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const strict = req.query.strict === '1' || req.query.strict === 'true';
    const data = await checkAIHealth(refresh);

    // Default (client polling): always 200 — provider availability is conveyed
    // in the payload so expected "down" states don't trigger client error
    // toasts. Pass ?strict=1 for uptime monitoring: returns 503 when no
    // provider can actually serve a review.
    const unhealthy = data.overall === 'none' || data.overall === 'unconfigured';

    sendSuccess(res, {
      statusCode: strict && unhealthy ? 503 : 200,
      message: 'AI provider health checked',
      data,
    });
  }
}

export const aiHealthController = new AIHealthController();
