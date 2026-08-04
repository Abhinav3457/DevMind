import { Request, Response } from 'express';
import { checkAIHealth } from '../services/ai-health.service';
import { sendSuccess } from '../utils/apiResponse';

export class AIHealthController {
  async check(req: Request, res: Response): Promise<void> {
    const data = await checkAIHealth();

    // Default (client polling): always 200 — provider availability is conveyed
    // in the payload so expected "down" states don't trigger client error
    // toasts. Pass ?strict=1 for uptime monitoring: returns 503 when no
    // provider can actually serve a review.
    const strict = req.query.strict === '1' || req.query.strict === 'true';
    const unhealthy = data.overall === 'none' || data.overall === 'unconfigured';

    sendSuccess(res, {
      statusCode: strict && unhealthy ? 503 : 200,
      message: 'AI provider health checked',
      data,
    });
  }
}

export const aiHealthController = new AIHealthController();
