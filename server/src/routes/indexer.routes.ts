import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { indexerController } from '../controllers/indexer.controller';
import { indexRepoSchema } from '../validators/indexer.validator';

const router = Router();

router.use(authenticate);

router.post('/repos/:repositoryId/index', validate({ body: indexRepoSchema }), asyncHandler(indexerController.indexRepository));
router.get('/reports/:reportId', asyncHandler(indexerController.getReport));
router.get('/reports/:reportId/files', asyncHandler(indexerController.getFiles));
router.get('/reports/:reportId/files/:fileId', asyncHandler(indexerController.getFile));
router.get('/reports/:reportId/chunks', asyncHandler(indexerController.getChunks));
router.delete('/reports/:reportId', asyncHandler(indexerController.deleteReport));

export default router;
