import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { analyticsController } from '../controllers/analytics.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(analyticsController.getAnalytics));
router.get('/problems', asyncHandler(analyticsController.getProblemsSolved));
router.get('/repos', asyncHandler(analyticsController.getReposIndexed));

export default router;
