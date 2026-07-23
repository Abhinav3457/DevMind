import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { generateChatSchema } from '../validators/chat.validator';
import { chatController } from '../controllers/chat.controller';

const router = Router();

router.use(authenticate);

router.post('/generate', validate({ body: generateChatSchema }), asyncHandler(chatController.generate));

export default router;
