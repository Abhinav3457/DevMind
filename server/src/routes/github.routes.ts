import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { gitHubController } from '../controllers/github.controller';
import {
  oAuthCallbackSchema,
  importRepoSchema,
  syncRepoSchema,
  repoParamsSchema,
} from '../validators/github.validator';

const router = Router();

router.use(authenticate);

// ─── OAuth ──────────────────────────────────────────────────────

router.get('/auth/url', asyncHandler(gitHubController.getAuthorizationUrl));
router.post('/auth/callback', validate({ body: oAuthCallbackSchema }), asyncHandler(gitHubController.handleOAuthCallback));
router.post('/disconnect', asyncHandler(gitHubController.disconnect));
router.get('/status', asyncHandler(gitHubController.getConnectionStatus));

// ─── Repositories ───────────────────────────────────────────────

router.get('/repos', asyncHandler(gitHubController.listRepositories));
router.get('/repos/imported', asyncHandler(gitHubController.listImportedRepos));
router.post('/repos/import', validate({ body: importRepoSchema }), asyncHandler(gitHubController.importRepository));
router.delete('/repos/imported/:id', asyncHandler(gitHubController.deleteImportedRepo));
router.post('/repos/sync', validate({ body: syncRepoSchema }), asyncHandler(gitHubController.syncRepository));
router.get('/repos/:owner/:repo', validate({ params: repoParamsSchema }), asyncHandler(gitHubController.getRepoMetadata));

// ─── Branches ───────────────────────────────────────────────────

router.get('/repos/:owner/:repo/branches', validate({ params: repoParamsSchema }), asyncHandler(gitHubController.listBranches));

// ─── Commits ────────────────────────────────────────────────────

router.get('/repos/:owner/:repo/commits', validate({ params: repoParamsSchema }), asyncHandler(gitHubController.listCommits));

// ─── Pull Requests ──────────────────────────────────────────────

router.get('/repos/:owner/:repo/pulls', validate({ params: repoParamsSchema }), asyncHandler(gitHubController.listPullRequests));

// ─── File Tree ──────────────────────────────────────────────────

router.get('/repos/:owner/:repo/tree', validate({ params: repoParamsSchema }), asyncHandler(gitHubController.getFileTree));

export default router;
