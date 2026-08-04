export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta?: {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  name: string;
  username: string;
}

export interface AnalyticsData {
  overview: {
    repositories: number;
    indexedRepos: number;
    totalFiles: number;
    totalChunks: number;
    aiOperations: number;
  };
  languages: {
    name: string;
    files: number;
    percentage: number;
    color: string;
  }[];
  linesOfCode: {
    total: number;
    byLanguage: { language: string; lines: number; files: number }[];
  };
  repositoryHealth: {
    score: number;
    level: 'excellent' | 'good' | 'fair' | 'poor';
    metrics: {
      indexed: { value: number; max: number };
      documented: { value: number; max: number };
      analyzed: { value: number; max: number };
      chunks: { value: number; max: number };
    };
  };
  quality: {
    securityIssues: number;
    bugCount: number;
    reviewScore: number;
    documentationCoverage: number;
  };
  activity: {
    recentIndexes: number;
    totalAiQueries: number;
    avgReviewScore: number;
    activityScore: number;
  };
}

export type FileLanguage =
  | 'javascript'
  | 'typescript'
  | 'jsx'
  | 'tsx'
  | 'html'
  | 'css'
  | 'python'
  | 'json'
  | 'markdown';

export type AgentToolName = 'search' | 'read_file' | 'list_files' | 'analyze' | 'propose_change';

export type AgentRunStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface AgentStep {
  _id: string;
  order: number;
  tool: AgentToolName;
  params: Record<string, unknown>;
  status: 'running' | 'completed' | 'failed';
  reasoning: string;
  result: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AgentPlanStep {
  action: string;
  tool: AgentToolName;
  params: Record<string, unknown>;
}

export interface AgentChange {
  filePath: string;
  title: string;
  reasoning: string;
  before: string;
  after: string;
}

export interface AgentSolution {
  summary: string;
  report: string;
  changes: AgentChange[];
}

export interface AgentRun {
  id: string;
  repoName: string;
  task: string;
  status: AgentRunStatus;
  plan: AgentPlanStep[];
  steps: AgentStep[];
  solution: AgentSolution | null;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface IndexReportOption {
  id: string;
  repoName: string;
  fileCount: number;
  chunkCount: number;
  createdAt: string;
}
