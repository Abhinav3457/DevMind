import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Lock, Eye, EyeOff, Loader2, Code2, User, AtSign } from 'lucide-react';
import { register as registerUser } from '../services/auth';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required').min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', username: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      await registerUser({
        name: data.name,
        username: data.username,
        email: data.email,
        password: data.password,
      });
      setIsSuccess(true);
      setTimeout(() => navigate('/auth/login', { replace: true }), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error?.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center"
        >
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
              <UserPlus className="h-10 w-10 text-emerald-400" />
            </div>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-surface-100">Registration Successful!</h2>
          <p className="mb-6 text-sm text-surface-400">
            Please check your email to verify your account. Redirecting to login...
          </p>
          <Link
            to="/auth/login"
            className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            Go to Login
          </Link>
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
        {/* Logo */}
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
          <h1 className="text-3xl font-bold text-surface-100">Create Account</h1>
          <p className="mt-2 text-sm text-surface-400">Join DevMind AI and start building</p>
        </div>

        {/* Register Form */}
        <div className="rounded-2xl border border-surface-700 bg-surface-800/50 p-8 backdrop-blur-xl">
          {serverError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
            >
              {serverError}
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Name */}
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-surface-200">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="John Doe"
                  className={
                    'w-full rounded-lg border bg-surface-800 py-2.5 pl-10 pr-4 text-sm text-surface-100 placeholder-surface-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
                    (errors.name ? 'border-red-500' : 'border-surface-600')
                  }
                  {...register('name')}
                />
              </div>
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-surface-200">
                Username
              </label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="johndoe"
                  className={
                    'w-full rounded-lg border bg-surface-800 py-2.5 pl-10 pr-4 text-sm text-surface-100 placeholder-surface-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
                    (errors.username ? 'border-red-500' : 'border-surface-600')
                  }
                  {...register('username')}
                />
              </div>
              {errors.username && (
                <p className="mt-1 text-xs text-red-400">{errors.username.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-surface-200">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={
                    'w-full rounded-lg border bg-surface-800 py-2.5 pl-10 pr-4 text-sm text-surface-100 placeholder-surface-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
                    (errors.email ? 'border-red-500' : 'border-surface-600')
                  }
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-surface-200">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className={
                    'w-full rounded-lg border bg-surface-800 py-2.5 pl-10 pr-10 text-sm text-surface-100 placeholder-surface-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
                    (errors.password ? 'border-red-500' : 'border-surface-600')
                  }
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-surface-200">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  className={
                    'w-full rounded-lg border bg-surface-800 py-2.5 pl-10 pr-10 text-sm text-surface-100 placeholder-surface-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
                    (errors.confirmPassword ? 'border-red-500' : 'border-surface-600')
                  }
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:from-blue-500 hover:to-purple-500 hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          {/* Login Link */}
          <p className="mt-6 text-center text-sm text-surface-400">
            Already have an account?{' '}
            <Link
              to="/auth/login"
              className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
