import apiClient from '../api/axios';
import { AnalyticsData } from '../types';

export async function fetchAnalytics(reportId?: string): Promise<AnalyticsData> {
  const params = reportId ? { reportId } : {};
  const response = await apiClient.get('/analytics', { params });
  return response.data.data;
}
