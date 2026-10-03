import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  ArrowRight, Mail, Lock, Eye, EyeOff, Loader2, Code2, User, AtSign,
  CheckCircle2, AlertTriangle, Check, ShieldCheck,
} from 'lucide-react';
import { register as registerUser } from '../services/auth';
import { AuthCodeBackground, AuthVignette, CardGlow } from '../components/auth/AuthBackground';
import { REGISTER_SNIPPETS } from '../components/auth/authSnippets';

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
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
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
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', username: '', email: '', password: '', confirmPassword: '' },
  });

  const password = watch('password');
  const confirmPassword = watch('confirmPassword');

  // Password strength 0-4
  const strength = [password.length >= 8, password.length >= 12, /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)]
    .filter(Boolean).length;

  const strengthColor =
    strength <= 1 ? 'bg-red-500' : strength === 2 ? 'bg-amber-500' : strength === 3 ? 'bg-lime-500' : 'bg-emerald-500';
  const strengthLabel =
    strength === 0 ? '' : strength <= 1 ? 'Weak' : strength === 2 ? 'Fair' : strength === 3 ? 'Good' : 'Strong';

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
      // Carry the intended destination (e.g. an invitation link) through to login
      setTimeout(() => navigate('/auth/login', { replace: true, state: location.state }), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error?.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  const handleCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState('CapsLock'));
  };

  const inputClass = (hasError: boolean, paddingRight = 'pr-4') =>
    `h-[38px] w-full rounded-[9px] border bg-[#1a1a26] pl-9 ${paddingRight} text-[14px] text-white placeholder-[#4f4f60] transition-all duration-200 focus:border-[#3b82f6] focus:outline-none focus:ring-[3px] focus:ring-[rgba(59,130,246,0.18)] ${
      hasError ? 'border-red-500/60' : 'border-[#34344a] hover:border-[#44445c]'
    }`;

  const iconClass = (field: string) =>
    'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-200 ' +
    (focusedField === field ? 'text-[#60a5fa]' : 'text-[#5a5a6a]');

  const labelClass = (field: string) =>
    `mb-1.5 block text-[13px] font-medium transition-colors duration-200 ${
      focusedField === field ? 'text-[#60a5fa]' : 'text-[#8b8ba0]'
    }`;

  if (isSuccess) {
    return (
      <div className="relative flex min-h-screen min-h-dvh items-center justify-center overflow-hidden bg-[#09090d] px-4 py-10">
        <AuthCodeBackground prefersReducedMotion={prefersReducedMotion} snippets={REGISTER_SNIPPETS} />
        <AuthVignette />
        <div className="relative z-10 w-full max-w-[360px]">
          <CardGlow prefersReducedMotion={prefersReducedMotion} />
          <div className="mb-5 flex justify-center">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6]"
              style={{ boxShadow: '0 0 22px rgba(99,102,241,0.55)' }}
            >
              <Code2 className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
          </div>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative rounded-[14px] border border-[#34344a] bg-[rgba(20,20,28,0.88)] px-[22px] py-6 text-center shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-[12px]"
          >
            <span
              className="absolute left-6 right-6 top-0 h-[1.5px]"
              aria-hidden="true"
              style={{
                background: 'linear-gradient(to right, transparent, #60a5fa 35%, #a78bfa 65%, transparent)',
              }}
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="mb-4 flex justify-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
                <Check className="h-7 w-7 text-emerald-400" strokeWidth={3} />
              </div>
            </motion.div>
            <h2 className="mb-2 text-xl font-semibold text-white">Registration successful</h2>
            <p className="mb-5 text-[13px] leading-relaxed text-[#7d7d7d]">
              Please check your email to verify your account. Redirecting to sign in...
            </p>
            <Link
              to="/auth/login"
              state={location.state}
              className="text-[13px] font-medium text-[#60a5fa] transition-colors hover:text-[#93c5fd]"
            >
              Go to Sign In
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen min-h-dvh items-center justify-center overflow-hidden bg-[#09090d] px-4 py-10">
      {/* Background: auto-typing code (signup-flavored snippets) */}
      <AuthCodeBackground prefersReducedMotion={prefersReducedMotion} snippets={REGISTER_SNIPPETS} />
      {/* Vignette: dim behind the card, bright near the screen edges */}
      <AuthVignette />

      <div className="relative z-10 w-full max-w-[400px]">
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

        {/* Register card */}
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
          <div className="mb-5">
            <h2 className="text-2xl font-semibold leading-tight tracking-tight text-white">
              Create your{' '}
              <span className="bg-gradient-to-r from-[#60a5fa] to-[#c084fc] bg-clip-text text-transparent">
                account
              </span>
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[#7d7d7d]">
              Join DevMind AI and start building with confidence
            </p>
          </div>

          {serverError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] }}
              transition={{ duration: 0.45 }}
              className="mb-5 flex items-start gap-2.5 rounded-[9px] border border-red-500/25 bg-red-500/10 px-3.5 py-3 text-[13px] text-red-400"
              role="alert"
              aria-live="polite"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{serverError}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Name */}
            <div>
              <label htmlFor="name" className={labelClass('name')}>
                Full Name
              </label>
              <div className="relative">
                <User className={iconClass('name')} aria-hidden="true" />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="John Doe"
                  className={inputClass(!!errors.name)}
                  {...register('name')}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className={labelClass('username')}>
                Username
              </label>
              <div className="relative">
                <AtSign className={iconClass('username')} aria-hidden="true" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="johndoe"
                  className={inputClass(!!errors.username)}
                  {...register('username')}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              {errors.username && (
                <p className="mt-1 text-xs text-red-400">{errors.username.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className={labelClass('email')}>
                Email Address
              </label>
              <div className="relative">
                <Mail className={iconClass('email')} aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={inputClass(!!errors.email)}
                  {...register('email')}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className={labelClass('password')}>
                Password
              </label>
              <div className="relative">
                <Lock className={iconClass('password')} aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  onKeyUp={handleCapsLock}
                  onKeyDown={handleCapsLock}
                  className={inputClass(!!errors.password, 'pr-10')}
                  {...register('password')}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#5a5a6a] transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/30"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-expanded={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Strength meter */}
              {password && (
                <div className="mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex flex-1 gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                            i <= strength ? strengthColor : 'bg-[#2a2a3a]'
                          }`}
                        />
                      ))}
                    </div>
                    <span className={`text-[10px] font-medium ${strengthColor.replace('bg-', 'text-')}`}>
                      {strengthLabel}
                    </span>
                  </div>
                </div>
              )}
              {capsLock && focusedField === 'password' && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-400">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  Caps Lock is on
                </p>
              )}
              {errors.password && (
                <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className={labelClass('confirm')}>
                Confirm Password
              </label>
              <div className="relative">
                <Lock className={iconClass('confirm')} aria-hidden="true" />
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  className={inputClass(!!errors.confirmPassword, 'pr-10')}
                  {...register('confirmPassword')}
                  onFocus={() => setFocusedField('confirm')}
                  onBlur={() => setFocusedField(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#5a5a6a] transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/30"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  aria-expanded={showConfirm}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && !errors.confirmPassword && (
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Passwords match
                </p>
              )}
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileTap={{ scale: 0.985 }}
              whileHover={{ y: -1 }}
              className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-[9px] bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-sm font-semibold tracking-tight text-white shadow-[0_6px_20px_rgba(99,102,241,0.4)] transition-[filter] duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#14141c]"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating account...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Create account
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
            </motion.button>
          </form>

          {/* Security note */}
          <p className="mt-4 flex items-center justify-center gap-1.5 font-mono text-[10px] tracking-[0.04em] text-[#4a5163]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" aria-hidden="true" />
            hashed passwords &amp; jwt auth
          </p>

          {/* Login link */}
          <p className="mt-4 border-t border-[#26263a] pt-4 text-center text-[13px] text-[#7d7d7d]">
            Already have an account?{' '}
            <Link
              to="/auth/login"
              state={location.state}
              className="font-medium text-[#60a5fa] transition-colors hover:text-[#93c5fd]"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
