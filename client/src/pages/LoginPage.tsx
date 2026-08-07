import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { LogIn, Mail, Lock, Eye, EyeOff, Loader2, Code2, Bot, Bug, FileText, BarChart3 } from 'lucide-react';
import { login } from '../services/auth';
import { useAuthStore } from '../store';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required').min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const features = [
  { icon: Bot, title: 'AI Agent', desc: 'Autonomous coding tasks with intelligent planning' },
  { icon: Bug, title: 'Code Review', desc: 'Instant AI-powered feedback on quality and security' },
  { icon: FileText, title: 'Documentation', desc: 'Generate professional docs for your projects' },
  { icon: BarChart3, title: 'Analytics', desc: 'Deep insights into your codebase health' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const { user } = await login(data);
      setUser({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
      const from = (location.state as { from?: { pathname?: string; search?: string } })?.from;
      navigate(from?.pathname ? from.pathname + (from.search || '') : '/dashboard', { replace: true });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error?.response?.data?.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel — Feature Highlights (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface-900">
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
                <Code2 className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-surface-100">DevMind AI</span>
            </div>
          </motion.div>

          {/* Headline */}            <motion.h2
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl xl:text-4xl font-bold leading-tight text-surface-100"
          >
            AI-powered tools to supercharge your development workflow
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-4 max-w-md text-sm text-surface-400 leading-relaxed"
          >
            Import your repositories, get AI-powered code reviews, generate documentation,
            and let an autonomous agent handle complex tasks.
          </motion.p>

          {/* Feature List */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 space-y-4"
          >
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                className="flex items-start gap-4 rounded-xl border border-surface-700/50 bg-surface-800/30 p-4 backdrop-blur-sm"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                  <feature.icon className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-surface-100">{feature.title}</p>
                  <p className="mt-0.5 text-xs text-surface-400">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Social proof */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-8 text-xs text-surface-500"
          >
            Trusted by developers building with TypeScript, Python, Go, and more
          </motion.p>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex flex-1 items-center justify-center bg-surface-950 px-4 py-12 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile-only logo */}
          <div className="mb-8 text-center lg:hidden">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mb-4 flex justify-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-600">
                <Code2 className="h-8 w-8 text-white" />
              </div>
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-bold text-surface-100">Welcome Back</h1>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-surface-400">Sign in to your DevMind AI account</p>
          </div>

          {/* Desktop-only heading */}
          <div className="hidden lg:block mb-8">
            <h1 className="text-2xl font-bold text-surface-100">Sign in</h1>
            <p className="mt-1 text-sm text-surface-400">Enter your credentials to access your account</p>
          </div>

          {/* Login Form */}
          <div className="rounded-xl sm:rounded-2xl border border-surface-700 bg-surface-800/50 p-5 sm:p-8 backdrop-blur-xl">
            {serverError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
              >
                {serverError}
              </motion.div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              {/* Email */}
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-surface-200">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={"input-field pl-10 " + (errors.email ? '!border-red-500/50 !ring-red-500/20' : '')}
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-surface-200">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className={"input-field pl-10 pr-10 " + (errors.password ? '!border-red-500/50 !ring-red-500/20' : '')}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors p-1 rounded"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              <div className="flex justify-end">
                <Link to="/auth/forgot-password" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  Forgot password?
                </Link>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Register Link */}
            <p className="mt-6 text-center text-sm text-surface-400">
              Don't have an account?{' '}
              <Link to="/auth/register" state={location.state} className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
                Create one
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
