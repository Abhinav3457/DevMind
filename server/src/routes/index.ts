import { Router } from 'express';
import authRoutes from './auth.routes';
import activityRoutes from './activity.routes';
import notificationRoutes from './notification.routes';
import githubRoutes from './github.routes';
import indexerRoutes from './indexer.routes';
import repoIntelligenceRoutes from './repo-intelligence.routes';
import codeReviewRoutes from './code-review.routes';
import docGeneratorRoutes from './doc-generator.routes';
import chatRoutes from './chat.routes';
import analyticsRoutes from './analytics.routes';
import healthRoutes from './health.routes';
import aiHealthRoutes from './ai-health.routes';
import uploadRoutes from './upload.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/ai', aiHealthRoutes);
router.use('/auth', authRoutes);
router.use('/activity', activityRoutes);
router.use('/notifications', notificationRoutes);
router.use('/github', githubRoutes);
router.use('/upload', uploadRoutes);
router.use('/indexer', indexerRoutes);
router.use('/ai/repo-intelligence', repoIntelligenceRoutes);
router.use('/ai/code-review', codeReviewRoutes);
router.use('/ai/doc-generator', docGeneratorRoutes);
router.use('/ai/chat', chatRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
