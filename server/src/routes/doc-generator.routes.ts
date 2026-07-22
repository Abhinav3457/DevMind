import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { docGeneratorController } from '../controllers/doc-generator.controller';
import { generateDocSchema, generateDirectDocSchema } from '../validators/doc-generator.validator';

const router = Router();

router.use(authenticate);

router.get('/types', asyncHandler(docGeneratorController.getAvailableTypes));

// Direct doc generation (send project context, get AI-generated doc)
router.post('/generate', validate({ body: generateDirectDocSchema }), asyncHandler(docGeneratorController.generateDirect));

// Repository-based doc generation (generate from an indexed repository)
router.post('/:reportId/generate', validate({ body: generateDocSchema }), asyncHandler(docGeneratorController.generate));

export default router;
