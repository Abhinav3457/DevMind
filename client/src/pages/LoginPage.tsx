import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  ArrowRight, Mail, Lock, Eye, EyeOff, Loader2, Code2,
  Check, CheckCircle2, AlertCircle, AlertTriangle,
} from 'lucide-react';
import { login } from '../services/auth';
import { useAuthStore } from '../store';
import { AuthCodeBackground, AuthVignette, CardGlow } from '../components/auth/AuthBackground';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required').min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [remember, setRemember] = useState<boolean>(() => {
    try {
      return localStorage.getItem('devmind_remember') === '1';
    } catch {
      return false;
    }
  });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: (() => {
        try {
          return localStorage.getItem('devmind_email') || '';
        } catch {
          return '';
        }
      })(),
      password: '',
    },
  });

  const emailValue = watch('email');

  const emailErrorId = 'email-error';
  const passwordErrorId = 'password-error';
  const serverErrorId = 'server-error';

  const focusFirstError = useCallback(() => {
    if (errors.email) {
      document.getElementById('email')?.focus();
    } else if (errors.password) {
      document.getElementById('password')?.focus();
    }
  }, [errors]);

  const onSubmit = useCallback(async (data: LoginFormData) => {
    setServerError(null);
    setStatus('loading');
    try {
      const { user } = await login(data);
      setUser({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
      setStatus('success');

      try {
        if (remember) {
          localStorage.setItem('devmind_email', data.email);
          localStorage.setItem('devmind_remember', '1');
        } else {
          localStorage.removeItem('devmind_email');
          localStorage.removeItem('devmind_remember');
        }
      } catch {
        /* storage unavailable — ignore */
      }

      await new Promise((r) => setTimeout(r, 650));
      const from = (location.state as { from?: { pathname?: string; search?: string } })?.from;
      navigate(from?.pathname ? from.pathname + (from.search || '') : '/dashboard', { replace: true });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error?.response?.data?.message || 'Unable to sign in. Please verify your credentials and try again.');
      setStatus('idle');
      setShakeKey((k) => k + 1);
      focusFirstError();
    }
  }, [setUser, remember, location, navigate, focusFirstError]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && status === 'idle') {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  }, [handleSubmit, onSubmit, status]);

  const handleCapsLock = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState('CapsLock'));
  }, []);

  return (
    <div className="relative min-h-screen min-h-dvh flex items-center justify-center bg-[#09090d] px-4 py-10 overflow-hidden">
      {/* Background: auto-typing code, behind everything */}
      <AuthCodeBackground prefersReducedMotion={prefersReducedMotion} />

      {/* Vignette: dim behind the card, bright near the screen edges */}
      <AuthVignette />

      {/* Card column */}
      <div className="relative z-10 w-full max-w-[360px]">
        {/* Soft glow behind the card */}
        <CardGlow prefersReducedMotion={prefersReducedMotion} />

        {/* Logo + tagline pill */}
        <div className="relative mb-5 flex flex-col items-center">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6]"
            style={{ boxShadow: '0 0 22px rgba(99,102,241,0.55)' }}
          >
            <Code2 className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <span className="mt-4 hidden rounded-full border border-[#1f3a52] bg-[rgba(14,165,233,0.08)] px-3 py-1 text-[11px] tracking-[0.12em] text-[#7dd3fc] sm:block">
            AI-POWERED CODE WORKSPACE
          </span>
        </div>

        {/* Sign-in card */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative rounded-[14px] border border-[#34344a] bg-[rgba(20,20,28,0.88)] px-[22px] py-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-[12px]"
        >
          {/* Accent line along the top edge */}
          <span
            className="absolute left-6 right-6 top-0 h-[1.5px]"
            aria-hidden="true"
            style={{
              background: 'linear-gradient(to right, transparent, #60a5fa 35%, #a78bfa 65%, transparent)',
            }}
          />

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold leading-tight tracking-tight text-white">
              Welcome{' '}
              <span className="bg-gradient-to-r from-[#60a5fa] to-[#c084fc] bg-clip-text text-transparent">
                back
              </span>
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[#7d7d7d]">
              Sign in to continue to your workspace
            </p>
          </div>

          {/* Server error */}
          {serverError && (
            <motion.div
              key={shakeKey}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: [0, -8, 8, -5, 5, 0] }}
              transition={{ duration: 0.4 }}
              className="mb-5 flex items-start gap-2.5 rounded-[9px] border border-red-500/25 bg-red-500/10 px-3.5 py-3 text-[13px] text-red-400"
              role="alert"
              aria-live="polite"
              id={serverErrorId}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{serverError}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-5" noValidate>
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className={`mb-2 block text-[13px] font-medium transition-colors duration-200 ${
                  focusedField === 'email' ? 'text-[#60a5fa]' : 'text-[#8b8ba0]'
                }`}
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-200 ${
                    focusedField === 'email' ? 'text-[#60a5fa]' : 'text-[#5a5a6a]'
                  }`}
                  aria-hidden="true"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  className={`h-[38px] w-full rounded-[9px] border bg-[#1a1a26] pl-9 pr-9 text-[14px] text-white placeholder-[#4f4f60] transition-all duration-200 focus:outline-none focus:ring-[3px] focus:ring-[rgba(59,130,246,0.18)] ${
                    errors.email
                      ? 'border-red-500/60'
                      : focusedField === 'email'
                        ? 'border-[#3b82f6]'
                        : 'border-[#34344a] hover:border-[#44445c]'
                  }`}
                  {...register('email')}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? emailErrorId : undefined}
                />
                {emailValue && !errors.email && (
                  <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" aria-hidden="true" />
                )}
                {errors.email && (
                  <AlertCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-400" aria-hidden="true" />
                )}
              </div>
              {errors.email && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 flex items-center gap-1.5 text-[13px] text-red-400"
                  id={emailErrorId}
                  role="alert"
                  aria-live="polite"
                >
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  {errors.email.message}
                </motion.p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className={`mb-2 block text-[13px] font-medium transition-colors duration-200 ${
                  focusedField === 'password' ? 'text-[#60a5fa]' : 'text-[#8b8ba0]'
                }`}
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-200 ${
                    focusedField === 'password' ? 'text-[#60a5fa]' : 'text-[#5a5a6a]'
                  }`}
                  aria-hidden="true"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  onKeyUp={handleCapsLock}
                  onKeyDown={handleCapsLock}
                  className={`h-[38px] w-full rounded-[9px] border bg-[#1a1a26] pl-9 pr-9 text-[14px] text-white placeholder-[#4f4f60] transition-all duration-200 focus:outline-none focus:ring-[3px] focus:ring-[rgba(59,130,246,0.18)] ${
                    errors.password
                      ? 'border-red-500/60'
                      : focusedField === 'password'
                        ? 'border-[#3b82f6]'
                        : 'border-[#34344a] hover:border-[#44445c]'
                  }`}
                  {...register('password')}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? passwordErrorId : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#5a5a6a] transition-colors duration-200 hover:text-white hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/30"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-expanded={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {capsLock && focusedField === 'password' && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 flex items-center gap-1.5 text-[13px] text-amber-400"
                  aria-live="polite"
                >
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  Caps Lock is on
                </motion.p>
              )}
              {errors.password && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 flex items-center gap-1.5 text-[13px] text-red-400"
                  id={passwordErrorId}
                  role="alert"
                  aria-live="polite"
                >
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  {errors.password.message}
                </motion.p>
              )}
            </div>

            {/* Remember me + Forgot password */}
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer select-none items-center gap-2.5 text-[13px] text-[#9a9a9a] transition-colors hover:text-[#c4c4c4]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  className={`relative h-5 w-9 rounded-full transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-[#3b82f6]/40 ${
                    remember ? 'bg-[#3b82f6]' : 'bg-[#34344a]'
                  }`}
                >
                  <motion.span
                    initial={false}
                    animate={{ x: remember ? 18 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
                  />
                </span>
                Remember me
              </label>
              <Link
                to="/auth/forgot-password"
                className="text-[13px] font-medium text-[#60a5fa] transition-colors hover:text-[#93c5fd]"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={status !== 'idle'}
              whileTap={{ scale: 0.985 }}
              whileHover={{ y: -1 }}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-[9px] bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-sm font-semibold tracking-tight text-white shadow-[0_6px_20px_rgba(99,102,241,0.4)] transition-[filter] duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#14141c]"
            >
              {status === 'loading' ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Signing in...
                </span>
              ) : status === 'success' ? (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="flex items-center justify-center gap-2"
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                  Welcome!
                </motion.span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign in
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
            </motion.button>
          </form>

          {/* Register link */}
          <p className="mt-6 border-t border-[#26263a] pt-5 text-center text-[13px] text-[#7d7d7d]">
            New here?{' '}
            <Link
              to="/auth/register"
              state={location.state}
              className="font-medium text-[#60a5fa] transition-colors hover:text-[#93c5fd]"
            >
              Create an account
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
