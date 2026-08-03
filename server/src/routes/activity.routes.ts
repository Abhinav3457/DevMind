import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { activityController } from '../controllers/activity.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(activityController.listMyActivity));

export default router;
