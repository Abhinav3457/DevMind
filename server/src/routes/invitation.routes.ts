import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { workspaceController } from '../controllers/workspace.controller';

const router = Router();

// All invitation routes require authentication
router.use(authenticate);

// ─── Invitations for the current user (static paths at the API root) ────

router.get('/', asyncHandler(workspaceController.listMyInvitations));
router.get('/:token', asyncHandler(workspaceController.getInvitationByToken));
router.post('/:token/accept', asyncHandler(workspaceController.acceptInvitation));
router.post('/:token/decline', asyncHandler(workspaceController.declineInvitation));

export default router;
