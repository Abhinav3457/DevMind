export interface ApiHealth {
  success: boolean;
  message: string;
  timestamp?: string;
  uptime?: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export async function checkApiHealth(signal?: AbortSignal): Promise<ApiHealth> {
  const response = await fetch(`${API_BASE_URL}/health`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`API health check failed with ${response.status}`);
  }

  return response.json();
}
