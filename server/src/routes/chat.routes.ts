import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { generateChatSchema, updateTitleSchema } from '../validators/chat.validator';
import { chatController } from '../controllers/chat.controller';

const router = Router();

router.use(authenticate);

// Session management
router.post('/sessions', asyncHandler(chatController.createSession));
router.get('/sessions', asyncHandler(chatController.listSessions));
router.get('/sessions/:chatId', asyncHandler(chatController.getSessionMessages));
router.patch('/sessions/:chatId', validate({ body: updateTitleSchema }), asyncHandler(chatController.updateSessionTitle));
router.delete('/sessions/:chatId', asyncHandler(chatController.deleteSession));

// AI generation (with optional chatId for persistence)
router.post('/generate', validate({ body: generateChatSchema }), asyncHandler(chatController.generate.bind(chatController)));

export default router;
