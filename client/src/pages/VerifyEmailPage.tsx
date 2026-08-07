import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Code2, Mail, ArrowRight } from 'lucide-react';
import { verifyEmail } from '../services/auth';

type VerifyStatus = 'loading' | 'success' | 'error';

export function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<VerifyStatus>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token was provided.');
      return;
    }

    const handleVerification = async () => {
      try {
        await verifyEmail(token);
        setStatus('success');
        setMessage('Your email has been verified successfully.');
        setTimeout(() => navigate('/auth/login', { replace: true }), 3000);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setStatus('error');
        setMessage(error?.response?.data?.message || 'Verification failed. The link may have expired or already been used.');
      }
    };

    handleVerification();
  }, [token, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="mb-6 flex justify-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25">
            <Code2 className="h-8 w-8 text-white" />
          </div>
        </motion.div>

        <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-8 backdrop-blur-xl">
          {status === 'loading' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-surface-100">Verifying your email</h2>
              <p className="mt-2 text-sm text-surface-400">Please wait while we verify your email address...</p>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-surface-100">Email verified</h2>
              <p className="mt-2 text-sm text-surface-400">{message}</p>
              <p className="mt-1 text-xs text-surface-500">Redirecting to sign in...</p>
              <Link to="/auth/login" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-700">
                Go to Sign In <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-surface-100">Verification failed</h2>
              <p className="mt-2 text-sm text-surface-400">{message}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link to="/auth/login" className="rounded-lg border border-surface-600 px-4 py-2.5 text-sm text-surface-300 transition-all hover:bg-surface-800">
                  Go to Sign In
                </Link>
                <Link to="/auth/register" className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-700">
                  <Mail className="h-4 w-4" /> Register Again
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
