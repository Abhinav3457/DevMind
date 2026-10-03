import apiClient from '../api/axios';
import { AnalyticsData } from '../types';

export async function fetchAnalytics(reportId?: string): Promise<AnalyticsData> {
  const params = reportId ? { reportId } : {};
  const response = await apiClient.get('/analytics', { params });
  return response.data.data;
}

export type ProblemsGranularity = 'daily' | 'weekly' | 'monthly';

export interface ProblemsSolvedPoint {
  label: string;
  date: string;
  total: number;
  easy: number;
  medium: number;
  hard: number;
}

export interface ProblemsSolvedData {
  granularity: ProblemsGranularity;
  total: number;
  thisWeek: number;
  byDifficulty: { easy: number; medium: number; hard: number };
  points: ProblemsSolvedPoint[];
}

export interface RepoIndexedPoint {
  label: string;
  date: string;
  count: number;
  cumulative: number;
}

export interface ReposIndexedData {
  total: number;
  latest: { name: string; fullName: string; indexedAt: string } | null;
  points: RepoIndexedPoint[];
}

export type ReposGranularity = 'daily' | 'weekly' | 'monthly';

export async function fetchProblemsSolved(
  granularity: ProblemsGranularity = 'daily',
): Promise<ProblemsSolvedData> {
  const response = await apiClient.get('/analytics/problems', { params: { granularity } });
  return response.data.data;
}

export async function fetchReposIndexed(
  granularity: ReposGranularity = 'daily',
): Promise<ReposIndexedData> {
  const response = await apiClient.get('/analytics/repos', { params: { granularity } });
  return response.data.data;
}
