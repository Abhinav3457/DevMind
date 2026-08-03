import { Router } from 'express';
import authRoutes from './auth.routes';
import invitationRoutes from './invitation.routes';
import workspaceRoutes from './workspace.routes';
import projectRoutes from './project.routes';
import githubRoutes from './github.routes';
import indexerRoutes from './indexer.routes';
import repoIntelligenceRoutes from './repo-intelligence.routes';
import codeReviewRoutes from './code-review.routes';
import docGeneratorRoutes from './doc-generator.routes';
import chatRoutes from './chat.routes';
import analyticsRoutes from './analytics.routes';
import healthRoutes from './health.routes';
import uploadRoutes from './upload.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/invitations', invitationRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/projects', projectRoutes);
router.use('/github', githubRoutes);
router.use('/upload', uploadRoutes);
router.use('/indexer', indexerRoutes);
router.use('/ai/repo-intelligence', repoIntelligenceRoutes);
router.use('/ai/code-review', codeReviewRoutes);
router.use('/ai/doc-generator', docGeneratorRoutes);
router.use('/ai/chat', chatRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
