import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { idempotency } from '../middleware/idempotency';
import { docGeneratorController } from '../controllers/doc-generator.controller';
import { generateDocSchema, generateDirectDocSchema } from '../validators/doc-generator.validator';

const router = Router();

router.use(authenticate);

router.get('/types', asyncHandler(docGeneratorController.getAvailableTypes));

// Generation history (registered before the parameterised routes)
router.get('/history', asyncHandler(docGeneratorController.listHistory));
router.get('/history/:id', asyncHandler(docGeneratorController.getHistory));
router.delete('/history/:id', asyncHandler(docGeneratorController.deleteHistory));

// Direct doc generation (send project context, get AI-generated doc)
router.post('/generate', validate({ body: generateDirectDocSchema }), idempotency('doc-generator.generate-direct'), asyncHandler(docGeneratorController.generateDirect));

// Repository-based doc generation (generate from an indexed repository)
router.post('/:reportId/generate', validate({ body: generateDocSchema }), idempotency('doc-generator.generate'), asyncHandler(docGeneratorController.generate));

export default router;
