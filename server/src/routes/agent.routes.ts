import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { agentController } from '../controllers/agent.controller';
import { createAgentRunSchema } from '../validators/agent.validator';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(agentController.listRuns));
router.post('/', validate({ body: createAgentRunSchema }), asyncHandler(agentController.createRun));
router.get('/:id', asyncHandler(agentController.getRun));
router.delete('/:id', asyncHandler(agentController.deleteRun));

export default router;
