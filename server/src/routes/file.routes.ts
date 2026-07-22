import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/upload', authenticate, asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'File upload endpoint - not yet implemented' });
}));

router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Delete file endpoint - not yet implemented' });
}));

export default router;
