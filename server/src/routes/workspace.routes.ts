import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { workspaceController } from '../controllers/workspace.controller';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  changeMemberRoleSchema,
  transferOwnershipSchema,
} from '../validators/workspace.validator';

const router = Router();

// All workspace routes require authentication
router.use(authenticate);

// ─── Core Workspace Operations ─────────────────────────────────

router.get('/', asyncHandler(workspaceController.listMyWorkspaces));
router.post('/', validate({ body: createWorkspaceSchema }), asyncHandler(workspaceController.create));
router.get('/:id', asyncHandler(workspaceController.getById));
router.patch('/:id', validate({ body: updateWorkspaceSchema }), asyncHandler(workspaceController.update));
router.post('/:id/archive', asyncHandler(workspaceController.archive));
router.post('/:id/unarchive', asyncHandler(workspaceController.unarchive));
router.delete('/:id', asyncHandler(workspaceController.delete));

// ─── Member Management ──────────────────────────────────────────

router.get('/:id/members', asyncHandler(workspaceController.listMembers));
router.patch('/:id/members/:userId', validate({ body: changeMemberRoleSchema }), asyncHandler(workspaceController.changeMemberRole));
router.delete('/:id/members/:userId', asyncHandler(workspaceController.removeMember));

// ─── Invitations within a workspace ─────────────────────────────

router.post('/:id/invitations', validate({ body: inviteMemberSchema }), asyncHandler(workspaceController.sendInvitation));
router.get('/:id/invitations', asyncHandler(workspaceController.listPendingInvitations));
router.delete('/:id/invitations/:inviteId', asyncHandler(workspaceController.revokeInvitation));

// ─── Ownership Transfer ─────────────────────────────────────────

router.post('/:id/transfer', validate({ body: transferOwnershipSchema }), asyncHandler(workspaceController.transferOwnership));

// ─── Repositories ───────────────────────────────────────────────

router.get('/:id/repos', asyncHandler(workspaceController.listRepos));

// ─── Activity ───────────────────────────────────────────────────

router.get('/:id/activity', asyncHandler(workspaceController.getActivityTimeline));

export default router;
