import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import apiClient from '../api/axios';
import toast from 'react-hot-toast';

/**
 * Detects the server error about a GitHub account being already linked
 * to a different DevMind user and returns a user-friendly message.
 */
function formatConnectionError(serverMsg: string): string {
  const alreadyConnectedPattern = /already connected to another user/i;
  if (alreadyConnectedPattern.test(serverMsg)) {
    // Extract the GitHub username from the error message
    const loginMatch = serverMsg.match(/GitHub account "([^"]+)"/);
    const login = loginMatch ? loginMatch[1] : 'this GitHub account';
    return `"${login}" is already signed in to another DevMind account. Please disconnect GitHub from that account's settings first, then try connecting again.`;
  }
  return serverMsg;
}

export function GitHubCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Completing GitHub authorization...');
  // Prevent double execution caused by React StrictMode (mounts twice in dev)
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;

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
        setMessage('GitHub account connected successfully. You can close this window.');
        toast.success('GitHub connected.');
        setTimeout(() => window.close(), 1500);
      } catch (err: unknown) {
        const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        const friendlyMsg = serverMsg ? formatConnectionError(serverMsg) : 'Failed to connect GitHub account. Please try again.';
        setStatus('error');
        setMessage(friendlyMsg);
        if (serverMsg) {
          toast.error(friendlyMsg);
        } else {
          toast.error('GitHub connection failed');
        }
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950">
      <div className="w-full max-w-md rounded-xl border border-surface-700 bg-surface-900 p-8 text-center shadow-2xl">
        {status === 'processing' && (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary-400" />
            <h2 className="text-lg font-semibold text-surface-100">{message}</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-surface-100">Success!</h2>
            <p className="mt-2 text-sm text-surface-300">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-surface-100">Connection failed</h2>
            <p className="mt-3 text-sm text-surface-300 leading-relaxed">{message}</p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={() => window.close()}
                className="rounded-lg bg-surface-800 px-5 py-2.5 text-sm font-medium text-surface-200 transition-all hover:bg-surface-700"
              >
                Close Window
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
