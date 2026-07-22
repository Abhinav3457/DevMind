export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner: string;
  collaborators: string[];
  files: ProjectFile[];
  status: 'active' | 'archived' | 'deleted';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
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
    projects: number;
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
