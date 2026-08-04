import apiClient from '../api/axios';
import { AgentRun, IndexReportOption } from '../types';

export async function fetchIndexReports(): Promise<IndexReportOption[]> {
  const response = await apiClient.get('/ai/repo-intelligence/reports');
  return response.data.data?.reports || [];
}

export async function createAgentRun(reportId: string, task: string): Promise<AgentRun> {
  const response = await apiClient.post('/ai/agent', { reportId, task });
  return response.data.data?.run as AgentRun;
}

export async function fetchAgentRun(runId: string): Promise<AgentRun> {
  const response = await apiClient.get('/ai/agent/' + runId);
  return response.data.data?.run as AgentRun;
}

export async function fetchAgentRuns(): Promise<AgentRun[]> {
  const response = await apiClient.get('/ai/agent');
  return response.data.data?.runs || [];
}

export async function deleteAgentRun(runId: string): Promise<void> {
  await apiClient.delete('/ai/agent/' + runId);
}
