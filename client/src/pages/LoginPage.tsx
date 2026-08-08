import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogIn, Mail, Lock, Eye, EyeOff, Loader2, Code2, Bug, FileText, BarChart3,
  Check, CheckCircle2, AlertCircle, Sparkles, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import { login } from '../services/auth';
import { useAuthStore } from '../store';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required').min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

type FeatureKey = 'review' | 'docs' | 'analytics';

const showcases: {
  key: FeatureKey;
  icon: typeof Bug;
  title: string;
  desc: string;
  cmd: string;
  out: string;
}[] = [
  {
    key: 'review',
    icon: Bug,
    title: 'Code Review',
    desc: 'Instant AI-powered feedback on quality, security, and performance across your pull requests.',
    cmd: 'devmind review --repo acme/app',
    out: '✓ 12 issues · score 87/100',
  },
  {
    key: 'docs',
    icon: FileText,
    title: 'Documentation',
    desc: 'Generate professional README, API, and architecture docs straight from your indexed codebase.',
    cmd: 'devmind docs generate --all',
    out: '✓ README.md · 2.1k words',
  },
  {
    key: 'analytics',
    icon: BarChart3,
    title: 'Analytics',
    desc: 'Deep insights into codebase health, activity, and quality — updated in real time.',
    cmd: 'devmind analyze --health',
    out: '✓ 3 repos · health 92',
  },
];

/* ── Typewriter hook for the terminal demo ────────────── */
function useTypewriter(text: string, speed = 28) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    if (!text) return;
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          window.clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);

  return text.slice(0, count);
}

function TerminalWindow({ script }: { script: string }) {
  const text = useTypewriter(script, 26);
  const done = text.length >= script.length && script.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-surface-700/60 bg-surface-950/80 shadow-2xl shadow-black/40 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 border-b border-surface-800 px-3.5 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        <span className="ml-2 font-mono text-[10px] tracking-wide text-surface-500">devmind — zsh</span>
      </div>
      <div className="min-h-[4.5rem] px-4 py-3.5 font-mono text-xs leading-relaxed text-emerald-400 whitespace-pre-wrap">
        {text}
        <span
          className={`ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 rounded-[2px] bg-emerald-400 ${
            done ? 'animate-caret-blink' : ''
          }`}
        />
      </div>
    </div>
  );
}

/* ── Ambient animated orbs ────────────────────────────── */
function AmbientOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary-600/20 blur-3xl animate-float-slow" />
      <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-purple-600/15 blur-3xl animate-float-slower" />
      <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl animate-float-slower" />
      <div className="bg-auth-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top_left,black_25%,transparent_75%)]" />
    </div>
  );
}

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
  const [activeIdx, setActiveIdx] = useState(0);
  const [remember, setRemember] = useState<boolean>(() => {
    try {
      return localStorage.getItem('devmind_remember') === '1';
    } catch {
      return false;
    }
  });

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

  // Auto-cycle the showcase on the left panel
  useEffect(() => {
    const id = window.setInterval(() => setActiveIdx((i) => (i + 1) % showcases.length), 4500);
    return () => window.clearInterval(id);
  }, []);

  const active = showcases[activeIdx] ?? showcases[0]!;

  const onSubmit = async (data: LoginFormData) => {
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

      // Persist email only when "remember me" is checked
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
    }
  };

  const handleCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState('CapsLock'));
  };

  return (
    <div className="relative flex min-h-screen min-h-dvh overflow-hidden bg-surface-950">
      {/* Mobile ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden lg:hidden">
        <div className="absolute -top-20 -right-24 h-72 w-72 rounded-full bg-primary-600/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl animate-float-slower" />
      </div>

      {/* ── Left Panel — Interactive Showcase (desktop) ── */}
      <div className="relative hidden lg:flex lg:w-1/2 overflow-hidden bg-surface-900">
        <AmbientOrbs />
        <div className="relative z-10 flex w-full flex-col justify-center px-12 xl:px-20">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.06, rotate: -3 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30"
              >
                <Code2 className="h-6 w-6 text-white" />
              </motion.div>
              <span className="text-xl font-bold text-surface-100">DevMind AI</span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl xl:text-4xl font-bold leading-tight text-surface-100"
          >
            AI-powered tools to elevate your{' '}
            <span className="text-gradient-brand">development workflow</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-4 max-w-md text-sm text-surface-400 leading-relaxed"
          >
            Import repositories, get AI code reviews, generate documentation, and explore
            deep analytics — all from one workspace.
          </motion.p>

          {/* Interactive terminal demo */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-8"
          >
            <TerminalWindow script={`$ ${active.cmd}\n${active.out}`} />
          </motion.div>

          {/* Feature cards — clickable, auto-highlighting */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-6 grid gap-2.5"
          >
            {showcases.map((feature, i) => {
              const isActive = i === activeIdx;
              return (
                <button
                  key={feature.key}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className={`flex w-full items-start gap-4 rounded-xl border p-3.5 text-left transition-all duration-300 ${
                    isActive
                      ? 'border-primary-500/40 bg-surface-800/70 shadow-lg shadow-primary-500/10'
                      : 'border-surface-700/50 bg-surface-800/30 opacity-60 hover:opacity-100 hover:border-surface-600/60'
                  }`}
                >
                  <motion.div
                    animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${
                      isActive ? 'bg-primary-500/20' : 'bg-blue-500/10'
                    }`}
                  >
                    <feature.icon className={`h-4.5 w-4.5 ${isActive ? 'text-primary-300' : 'text-blue-400'}`} />
                  </motion.div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-surface-100">{feature.title}</p>
                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.p
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden text-xs text-surface-400"
                        >
                          {feature.desc}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </button>
              );
            })}
          </motion.div>

          {/* Social proof */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-8 flex items-center gap-2 text-xs text-surface-500"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary-400" />
            Trusted by developers building with TypeScript, Python, Go, and beyond
          </motion.p>
        </div>
      </div>

      {/* ── Right Panel — Login Form ── */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-10 sm:py-12 lg:px-8">
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
              <motion.div
                whileHover={{ scale: 1.08, rotate: -4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-xl shadow-blue-500/30"
              >
                <Code2 className="h-8 w-8 text-white" />
              </motion.div>
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-bold text-surface-100">Welcome back</h1>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-surface-400">
              Sign in to continue to your DevMind AI workspace
            </p>
          </div>

          {/* Desktop-only heading */}
          <div className="hidden lg:block mb-8">
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-2 text-2xl font-bold text-surface-100"
            >
              Sign in
              <Sparkles className="h-5 w-5 text-primary-400" />
            </motion.h1>
            <p className="mt-1 text-sm text-surface-400">Enter your credentials to access your workspace</p>
          </div>

          {/* Login Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            whileHover={{ y: -2 }}
            className="rounded-xl sm:rounded-2xl border border-surface-700 bg-surface-800/50 p-5 sm:p-8 backdrop-blur-xl shadow-2xl shadow-black/30"
          >
            {serverError && (
              <motion.div
                key={shakeKey}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] }}
                transition={{ duration: 0.45 }}
                className="mb-6 flex items-start gap-2.5 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{serverError}</span>
              </motion.div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              {/* Email */}
              <div className="group">
                <label
                  htmlFor="email"
                  className={`mb-1.5 flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 ${
                    focusedField === 'email' ? 'text-primary-300' : 'text-surface-200'
                  }`}
                >
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className={`absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-200 ${
                      focusedField === 'email' ? 'text-primary-400' : 'text-surface-500'
                    }`}
                  />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={`input-field pl-10 pr-10 ${
                      errors.email ? '!border-red-500/50 !ring-red-500/20' : ''
                    }`}
                    {...register('email')}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                  />
                  {emailValue && !errors.email && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </motion.span>
                  )}
                  {errors.email && (
                    <AlertCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-400" />
                  )}
                </div>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-1.5 flex items-center gap-1 text-xs text-red-400"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {errors.email.message}
                  </motion.p>
                )}
              </div>

              {/* Password */}
              <div className="group">
                <label
                  htmlFor="password"
                  className={`mb-1.5 flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 ${
                    focusedField === 'password' ? 'text-primary-300' : 'text-surface-200'
                  }`}
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className={`absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-200 ${
                      focusedField === 'password' ? 'text-primary-400' : 'text-surface-500'
                    }`}
                  />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    onKeyUp={handleCapsLock}
                    onKeyDown={handleCapsLock}
                    className={`input-field pl-10 pr-11 ${
                      errors.password ? '!border-red-500/50 !ring-red-500/20' : ''
                    }`}
                    {...register('password')}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-surface-500 transition-colors duration-200 hover:text-surface-200 hover:bg-surface-700/50"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={showPassword ? 'hide' : 'show'}
                        initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.6, rotate: 30 }}
                        transition={{ duration: 0.15 }}
                        className="flex"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                </div>
                {capsLock && focusedField === 'password' && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-1.5 flex items-center gap-1 text-xs text-amber-400"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Caps Lock is on
                  </motion.p>
                )}
                {errors.password && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-1.5 flex items-center gap-1 text-xs text-red-400"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {errors.password.message}
                  </motion.p>
                )}
              </div>

              {/* Remember me + Forgot password */}
              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-surface-300">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span
                    className={`flex h-4.5 w-4.5 items-center justify-center rounded border transition-all duration-200 ${
                      remember
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-surface-600 bg-surface-800 peer-hover:border-surface-500'
                    }`}
                  >
                    <motion.span
                      initial={false}
                      animate={remember ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    >
                      <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
                    </motion.span>
                  </span>
                  Remember me
                </label>
                <Link
                  to="/auth/forgot-password"
                  className="group/link text-xs text-blue-400 transition-colors hover:text-blue-300"
                >
                  <span className="relative">
                    Forgot password?
                    <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-blue-400 transition-all duration-300 group-hover/link:w-full" />
                  </span>
                </Link>
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={status !== 'idle'}
                whileTap={{ scale: 0.97 }}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 hover:from-blue-500 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-80"
              >
                {/* Sheen sweep */}
                <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-white/20 blur-md transition-transform duration-700 ease-out group-hover:translate-x-[350%] group-disabled:translate-x-0" />

                {status === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : status === 'success' ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className="flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </motion.span>
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                {status === 'loading' ? 'Signing in...' : status === 'success' ? 'Welcome!' : 'Sign In'}
              </motion.button>
            </form>

            {/* Security note */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-surface-500"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/80" />
              Secured with JWT & rotating refresh tokens
            </motion.p>

            {/* Register Link */}
            <div className="relative mt-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-surface-700/70" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-surface-800/60 px-3 text-[11px] uppercase tracking-wider text-surface-500 backdrop-blur">
                  New to DevMind AI?
                </span>
              </div>
            </div>
            <p className="mt-4 text-center text-sm text-surface-400">
              <Link
                to="/auth/register"
                state={location.state}
                className="group/link font-medium text-blue-400 transition-colors hover:text-blue-300"
              >
                <span className="relative">
                  Create an account
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-blue-400 transition-all duration-300 group-hover/link:w-full" />
                </span>
              </Link>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
