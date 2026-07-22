import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import workspaceRoutes from './workspace.routes';
import projectRoutes from './project.routes';
import githubRoutes from './github.routes';
import fileRoutes from './file.routes';
import indexerRoutes from './indexer.routes';
import repoIntelligenceRoutes from './repo-intelligence.routes';
import codeReviewRoutes from './code-review.routes';
import docGeneratorRoutes from './doc-generator.routes';
import analyticsRoutes from './analytics.routes';
import healthRoutes from './health.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/projects', projectRoutes);
router.use('/github', githubRoutes);
router.use('/files', fileRoutes);
router.use('/indexer', indexerRoutes);
router.use('/ai/repo-intelligence', repoIntelligenceRoutes);
router.use('/ai/code-review', codeReviewRoutes);
router.use('/ai/doc-generator', docGeneratorRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
