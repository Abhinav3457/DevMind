import AgentRun, { IAgentRun } from '../models/AgentRun';
import IndexReport from '../models/IndexReport';
import ImportedRepository from '../models/ImportedRepository';
import { agentEngineService } from '../agent/agent-engine.service';
import { ApiError } from '../utils/apiResponse';
import logger from '../utils/logger';

const STALE_RUN_MS = 5 * 60 * 1000;

export class AgentService {
  /**
   * Mark runs stuck in 'running'/'queued' (e.g. after a server restart) as
   * failed so the client polling loop settles instead of spinning forever.
   */
  private async recoverStaleRuns(userId: string): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_RUN_MS);
    await AgentRun.updateMany(
      {
        userId,
        status: { $in: ['running', 'queued'] },
        $or: [
          { startedAt: { $lt: cutoff } },
          { startedAt: { $exists: false }, createdAt: { $lt: cutoff } },
        ],
      },
      {
        $set: {
          status: 'failed',
          error: 'Agent run was interrupted (server restarted). Please start a new run.',
          completedAt: new Date(),
        },
      },
    );
  }

  async createRun(userId: string, reportId: string, task: string): Promise<IAgentRun> {
    // Guard against AI-quota abuse: each run makes several sequential AI calls,
    // so allow only one active run per user at a time.
    const activeRun = await AgentRun.findOne({ userId, status: { $in: ['running', 'queued'] } })
      .select('_id')
      .lean();
    if (activeRun) {
      throw new ApiError(409, 'An agent run is already in progress. Please wait for it to finish before starting another.');
    }

    const report = await IndexReport.findOne({ _id: reportId, userId });
    if (!report) {
      throw new ApiError(404, 'Index report not found or access denied');
    }
    if (report.status !== 'completed') {
      throw new ApiError(400, 'Indexing has not completed yet. Status: ' + report.status);
    }

    let repoName = 'your repository';
    const repo = await ImportedRepository.findById(report.repositoryId).select('fullName').lean();
    if (repo?.fullName) repoName = repo.fullName;

    const run = await AgentRun.create({ userId, reportId, repoName, task, status: 'queued' });

    // Run the agent in the background so the request returns immediately and
    // the client can poll for live step progress.
    void agentEngineService.runAgent(run._id.toString()).catch((error) => {
      logger.error('Agent: background run crashed - ' + (error instanceof Error ? error.message : String(error)));
    });

    return run;
  }

  async getRun(runId: string, userId: string): Promise<IAgentRun> {
    await this.recoverStaleRuns(userId);
    const run = await AgentRun.findOne({ _id: runId, userId });
    if (!run) {
      throw new ApiError(404, 'Agent run not found');
    }
    return run;
  }

  async listRuns(userId: string, limit = 20): Promise<IAgentRun[]> {
    await this.recoverStaleRuns(userId);
    return AgentRun.find({ userId }).sort({ createdAt: -1 }).limit(limit);
  }

  async deleteRun(runId: string, userId: string): Promise<boolean> {
    const result = await AgentRun.deleteOne({ _id: runId, userId });
    return result.deletedCount > 0;
  }
}

export const agentService = new AgentService();
