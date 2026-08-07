import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Loader2, Code2, CheckCircle2, ArrowRight } from 'lucide-react';
import { resetPassword } from '../services/auth';

const resetSchema = z.object({
  password: z.string().min(1, 'Password is required').min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ResetFormData = z.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ResetFormData) => {
    if (!token) {
      setServerError('No reset token provided. The link may be invalid.');
      return;
    }
    setServerError(null);
    try {
      await resetPassword(token, data.password);
      setIsSuccess(true);
      setTimeout(() => navigate('/auth/login', { replace: true }), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error?.response?.data?.message || 'Unable to reset your password. The link may have expired.');
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
          <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-8 backdrop-blur-xl">
            <h2 className="text-xl font-semibold text-red-400">Invalid reset link</h2>
            <p className="mt-2 text-sm text-surface-400">No reset token was provided. The link may be invalid or expired.</p>
            <Link to="/auth/forgot-password" className="mt-6 inline-block text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
              Request a new reset link
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mb-4 flex justify-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25">
              <Code2 className="h-8 w-8 text-white" />
            </div>
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-bold text-surface-100">Set a new password</h1>
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-surface-400">Choose a strong password for your account</p>
        </div>

        <div className="rounded-xl sm:rounded-2xl border border-surface-700 bg-surface-800/50 p-5 sm:p-8 backdrop-blur-xl">
          {isSuccess ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-surface-100">Password updated</h2>
              <p className="mt-2 text-sm text-surface-400">Your password has been reset successfully. Redirecting to sign in...</p>
              <Link to="/auth/login" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-700">
                Go to Sign In <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          ) : (
            <>
              {serverError && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
                >
                  {serverError}
                </motion.div>
              )}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-surface-200">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters"
                      className={'w-full rounded-lg border bg-surface-800 py-2.5 pl-10 pr-10 text-sm text-surface-100 placeholder-surface-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ' + (errors.password ? 'border-red-500' : 'border-surface-600')}
                      {...register('password')} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 transition-colors" tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-surface-200">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input id="confirmPassword" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" placeholder="Re-enter your password"
                      className={'w-full rounded-lg border bg-surface-800 py-2.5 pl-10 pr-10 text-sm text-surface-100 placeholder-surface-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ' + (errors.confirmPassword ? 'border-red-500' : 'border-surface-600')}
                      {...register('confirmPassword')} />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 transition-colors" tabIndex={-1}>
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>}
                </div>
                <button type="submit" disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:from-blue-500 hover:to-purple-500 hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {isSubmitting ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
