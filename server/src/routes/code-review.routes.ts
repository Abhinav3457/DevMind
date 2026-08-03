import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { codeReviewController } from '../controllers/code-review.controller';
import { reviewRepoSchema, reviewCodeSchema } from '../validators/code-review.validator';

const router = Router();

// Public share link (no auth — keyed by unguessable token, must precede authenticate)
router.get('/shared/:token', asyncHandler(codeReviewController.getSharedReview));

router.use(authenticate);

// Review history (must be registered before the /:reportId route)
router.get('/history', asyncHandler(codeReviewController.listHistory));
router.get('/history/:id', asyncHandler(codeReviewController.getHistory));
router.delete('/history/:id', asyncHandler(codeReviewController.deleteHistory));

// Direct code review (send raw code, get AI review)
router.post('/review', validate({ body: reviewCodeSchema }), asyncHandler(codeReviewController.reviewCode));

// Repository code review (review an indexed repository)
router.post('/:reportId', validate({ body: reviewRepoSchema }), asyncHandler(codeReviewController.reviewRepository));

export default router;
