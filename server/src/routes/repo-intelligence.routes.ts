import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { repoIntelligenceController } from '../controllers/repo-intelligence.controller';
import { askQuestionSchema, queryQuestionSchema } from '../validators/repo-intelligence.validator';

const router = Router();

router.use(authenticate);

router.get('/questions', asyncHandler(repoIntelligenceController.getQuestionTemplates));
router.get('/status', asyncHandler(repoIntelligenceController.getIndexStatus));
router.get('/reports', asyncHandler(repoIntelligenceController.listReports));

// Query with reportId in body (used by AI Chat page)
router.post('/query', validate({ body: queryQuestionSchema }), asyncHandler(repoIntelligenceController.query));

// Query with reportId in URL path (original route)
router.post('/:reportId/ask', validate({ body: askQuestionSchema }), asyncHandler(repoIntelligenceController.ask));

export default router;
