import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Code2,
  User,
  AtSign,
  CheckCircle2,
  AlertTriangle,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { register as registerUser } from '../services/auth';
import { AuthCodeBackground } from '../components/auth/AuthBackground';
import { REGISTER_SNIPPETS } from '../components/auth/authSnippets';

const registerSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username cannot exceed 30 characters')
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        'Username can only contain letters, numbers, hyphens, and underscores',
      ),
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
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
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

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
  const strength = [
    password.length >= 8,
    password.length >= 12,
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const strengthColor =
    strength <= 1
      ? 'bg-red-500'
      : strength === 2
        ? 'bg-amber-500'
        : strength === 3
          ? 'bg-lime-500'
          : 'bg-emerald-500';
  const strengthLabel =
    strength === 0
      ? ''
      : strength <= 1
        ? 'Weak'
        : strength === 2
          ? 'Fair'
          : strength === 3
            ? 'Good'
            : 'Strong';
  const strengthTextColor =
    strength <= 1
      ? 'text-red-600'
      : strength === 2
        ? 'text-amber-600'
        : strength === 3
          ? 'text-lime-600'
          : 'text-emerald-600';

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
    `h-[38px] w-full rounded-lg border bg-surface-950 pl-9 ${paddingRight} text-[14px] text-surface-100 placeholder:text-surface-500 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
      hasError ? 'border-red-500/60' : 'border-surface-700/60 hover:border-surface-600'
    }`;

  const iconClass = 'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500';

  const labelClass = 'mb-1.5 block text-[13px] font-medium text-surface-400';

  if (isSuccess) {
    return (
      <div className="flex min-h-screen min-h-dvh items-center justify-center bg-surface-950 px-4 py-10">
        <AuthCodeBackground snippets={REGISTER_SNIPPETS} />
        <div className="relative z-10 w-full max-w-[360px]">
          <div className="mb-5 flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-800 bg-surface-900">
              <Code2 className="h-5 w-5 text-surface-300" aria-hidden="true" />
            </div>
          </div>
          <div className="rounded-xl border border-surface-800 bg-surface-900 px-5 py-8 text-center sm:px-6">
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
                <Check className="h-6 w-6 text-emerald-600" strokeWidth={2.5} />
              </div>
            </div>
            <h2 className="mb-2 text-lg font-semibold tracking-tight text-surface-100">
              Registration successful
            </h2>
            <p className="mb-5 text-[13px] leading-relaxed text-surface-400">
              Please check your email to verify your account. Redirecting to sign in...
            </p>
            <Link
              to="/auth/login"
              state={location.state}
              className="text-[13px] font-medium text-primary-400 transition-colors hover:text-primary-300"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-h-dvh items-center justify-center bg-surface-950 px-4 py-10">
      <AuthCodeBackground snippets={REGISTER_SNIPPETS} />
      <div className="relative z-10 w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-5 flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-800 bg-surface-900">
            <Code2 className="h-5 w-5 text-surface-300" aria-hidden="true" />
          </div>
        </div>

        {/* Register card */}
        <div className="rounded-xl border border-surface-800 bg-surface-900 px-5 py-6 sm:px-6">
          {/* Heading */}
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight text-surface-100">
              Create your account
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-surface-400">
              Join DevMind AI and start building with confidence
            </p>
          </div>

          {serverError && (
            <div
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-[13px] text-red-600"
              role="alert"
              aria-live="polite"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Name */}
            <div>
              <label htmlFor="name" className={labelClass}>
                Full Name
              </label>
              <div className="relative">
                <User className={iconClass} aria-hidden="true" />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="John Doe"
                  className={inputClass(!!errors.name)}
                  {...register('name')}
                />
              </div>
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className={labelClass}>
                Username
              </label>
              <div className="relative">
                <AtSign className={iconClass} aria-hidden="true" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="johndoe"
                  className={inputClass(!!errors.username)}
                  {...register('username')}
                />
              </div>
              {errors.username && (
                <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className={labelClass}>
                Email Address
              </label>
              <div className="relative">
                <Mail className={iconClass} aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={inputClass(!!errors.email)}
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className={labelClass}>
                Password
              </label>
              <div className="relative">
                <Lock className={iconClass} aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  onKeyUp={handleCapsLock}
                  onKeyDown={handleCapsLock}
                  className={inputClass(!!errors.password, 'pr-10')}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-surface-500 transition-colors hover:bg-surface-800 hover:text-surface-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
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
                            i <= strength ? strengthColor : 'bg-surface-800'
                          }`}
                        />
                      ))}
                    </div>
                    <span className={`text-[10px] font-medium ${strengthTextColor}`}>
                      {strengthLabel}
                    </span>
                  </div>
                </div>
              )}
              {capsLock && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  Caps Lock is on
                </p>
              )}
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className={labelClass}>
                Confirm Password
              </label>
              <div className="relative">
                <Lock className={iconClass} aria-hidden="true" />
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  className={inputClass(!!errors.confirmPassword, 'pr-10')}
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-surface-500 transition-colors hover:bg-surface-800 hover:text-surface-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  aria-expanded={showConfirm}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && !errors.confirmPassword && (
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Passwords match
                </p>
              )}
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary-500 text-sm font-medium text-white transition-colors hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating account...
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Security note */}
          <p className="mt-4 flex items-center justify-center gap-1.5 font-mono text-[10px] tracking-[0.04em] text-surface-500">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            hashed passwords &amp; jwt auth
          </p>

          {/* Login link */}
          <p className="mt-4 border-t border-surface-800 pt-4 text-center text-[13px] text-surface-400">
            Already have an account?{' '}
            <Link
              to="/auth/login"
              state={location.state}
              className="font-medium text-primary-400 transition-colors hover:text-primary-300"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
