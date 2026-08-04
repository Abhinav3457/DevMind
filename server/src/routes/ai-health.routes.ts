import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { aiHealthController } from '../controllers/ai-health.controller';

const router = Router();

router.get('/health', asyncHandler(aiHealthController.check));

export default router;
