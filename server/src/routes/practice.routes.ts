import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { practiceController } from '../controllers/practice.controller';
import {
  submitSolutionSchema,
  problemSlugParamsSchema,
  listProblemsQuerySchema,
  leetcodeUsernameParamsSchema,
  leetcodeListQuerySchema,
  leetcodeSubmitSchema,
} from '../validators/practice.validator';

const router = Router();

router.use(authenticate);

router.get('/problems', validate({ query: listProblemsQuerySchema }), asyncHandler(practiceController.listProblems));
router.get('/problems/:slug', validate({ params: problemSlugParamsSchema }), asyncHandler(practiceController.getProblem));
router.post(
  '/problems/:slug/submit',
  validate({ params: problemSlugParamsSchema, body: submitSolutionSchema }),
  asyncHandler(practiceController.submit),
);

// Live LeetCode problems (specific routes must precede the /:username param route)
router.get('/leetcode/problems', validate({ query: leetcodeListQuerySchema }), asyncHandler(practiceController.listLeetcodeProblems));
router.get(
  '/leetcode/questions/:slug',
  validate({ params: problemSlugParamsSchema }),
  asyncHandler(practiceController.getLeetcodeProblem),
);
router.post(
  '/leetcode/questions/:slug/submit',
  validate({ params: problemSlugParamsSchema, body: leetcodeSubmitSchema }),
  asyncHandler(practiceController.submitLeetcode),
);

router.get(
  '/leetcode/:username',
  validate({ params: leetcodeUsernameParamsSchema }),
  asyncHandler(practiceController.getLeetcodeStats),
);

router.get('/submissions', asyncHandler(practiceController.listSubmissions));
router.get('/stats', asyncHandler(practiceController.getStats));

export default router;
