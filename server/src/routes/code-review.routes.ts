import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { codeReviewController } from '../controllers/code-review.controller';
import { reviewRepoSchema, reviewCodeSchema } from '../validators/code-review.validator';

const router = Router();

router.use(authenticate);

// Direct code review (send raw code, get AI review)
router.post('/review', validate({ body: reviewCodeSchema }), asyncHandler(codeReviewController.reviewCode));

// Repository code review (review an indexed repository)
router.post('/:reportId', validate({ body: reviewRepoSchema }), asyncHandler(codeReviewController.reviewRepository));

export default router;
