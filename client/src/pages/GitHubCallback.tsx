import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../api/axios';
import toast from 'react-hot-toast';

export function GitHubCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Completing GitHub authorization...');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code || !state) {
        setStatus('error');
        setMessage('Missing authorization code or state parameter.');
        return;
      }

      try {
        await apiClient.post('/github/auth/callback', { code, state });
        setStatus('success');
        setMessage('GitHub account connected successfully! You can close this window.');
        toast.success('GitHub connected!');
        setTimeout(() => window.close(), 1500);
      } catch {
        setStatus('error');
        setMessage('Failed to connect GitHub account. Please try again.');
        toast.error('GitHub connection failed');
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950">
      <div className="w-full max-w-md rounded-xl border border-surface-700 bg-surface-900 p-8 text-center shadow-2xl">
        {status === 'processing' && (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary-500/30 border-t-primary-500" />
            <h2 className="text-lg font-semibold text-surface-100">{message}</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
              <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-surface-100">Success!</h2>
            <p className="mt-2 text-sm text-surface-300">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
              <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-surface-100">Connection Failed</h2>
            <p className="mt-2 text-sm text-surface-300">{message}</p>
            <button
              onClick={() => window.close()}
              className="mt-4 rounded-lg bg-surface-800 px-4 py-2 text-sm text-surface-200 transition-all hover:bg-surface-700"
            >
              Close Window
            </button>
          </>
        )}
      </div>
    </div>
  );
}
