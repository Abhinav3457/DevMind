import axios from 'axios';
import { AIHealthReport } from '../types';

// Uses a bare axios call (not apiClient) so background polling failures never
// trigger the global error toasts — the banner renders its own status instead.
// The endpoint is public, so no auth headers are needed. Pass refresh=true for
// a live probe (manual "Check" clicks); background polls reuse the server cache
// so they don't burn provider API quota.
export async function fetchAIHealth(refresh = false): Promise<AIHealthReport> {
  const baseURL = import.meta.env.VITE_API_URL || '/api/v1';
  const response = await axios.get(baseURL + '/ai/health', {
    params: refresh ? { refresh: '1' } : undefined,
    timeout: 30000,
  });
  return response.data.data as AIHealthReport;
}
