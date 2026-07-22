import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { projectController } from '../controllers/project.controller';
import {
  createProjectSchema,
  updateProjectSchema,
  addCollaboratorSchema,
} from '../validators/project.validator';

const router = Router();

// All project routes require authentication
router.use(authenticate);

// ─── Core Project Operations ──────────────────────────────────

router.get('/', asyncHandler(projectController.listMyProjects));
router.post('/', validate({ body: createProjectSchema }), asyncHandler(projectController.create));
router.get('/:id', asyncHandler(projectController.getById));
router.patch('/:id', validate({ body: updateProjectSchema }), asyncHandler(projectController.update));
router.post('/:id/archive', asyncHandler(projectController.archive));
router.delete('/:id', asyncHandler(projectController.delete));
router.delete('/:id/hard', asyncHandler(projectController.hardDelete));

// ─── Collaborator Management ──────────────────────────────────

router.post('/:id/collaborators', validate({ body: addCollaboratorSchema }), asyncHandler(projectController.addCollaborator));
router.delete('/:id/collaborators/:userId', asyncHandler(projectController.removeCollaborator));

// ─── File Tree ────────────────────────────────────────────────

router.get('/:id/files', asyncHandler(projectController.getFileTree));

export default router;
