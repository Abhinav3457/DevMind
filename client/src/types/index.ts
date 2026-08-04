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

export type AIProviderName = 'gemini' | 'groq';

export type AIHealthOverall = 'unconfigured' | 'all' | 'partial' | 'none';

export interface AIProviderHealth {
  provider: AIProviderName;
  configured: boolean;
  available: boolean;
  latencyMs: number | null;
  error?: string;
}

export interface AIHealthReport {
  overall: AIHealthOverall;
  ready: boolean;
  checkedAt: string;
  providers: AIProviderHealth[];
}
