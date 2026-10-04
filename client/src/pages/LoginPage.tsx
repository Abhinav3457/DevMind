import { useState, useCallback } from 'react';
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
  Check,
  AlertTriangle,
} from 'lucide-react';
import { login } from '../services/auth';
import { useAuthStore } from '../store';
import { AuthCodeBackground } from '../components/auth/AuthBackground';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const inputClass = (hasError: boolean, paddingRight = 'pr-4') =>
  `h-[38px] w-full rounded-lg border bg-surface-950 pl-9 ${paddingRight} text-[14px] text-surface-100 placeholder:text-surface-500 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
    hasError ? 'border-red-500/60' : 'border-surface-700/60 hover:border-surface-600'
  }`;

const iconClass = 'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500';

const labelClass = 'mb-1.5 block text-[13px] font-medium text-surface-400';

/* Browser autofill must not repaint the fields */
const PAGE_STYLE = `
  .dm-login input:-webkit-autofill,
  .dm-login input:-webkit-autofill:hover,
  .dm-login input:-webkit-autofill:focus,
  .dm-login input:-webkit-autofill:active {
    -webkit-box-shadow: inset 0 0 0 1000px rgb(var(--surface-950));
    box-shadow: inset 0 0 0 1000px rgb(var(--surface-950));
    -webkit-text-fill-color: rgb(var(--surface-100));
    caret-color: rgb(var(--surface-100));
  }
`;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
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

  const onSubmit = useCallback(
    async (data: LoginFormData) => {
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
        navigate(from?.pathname ? from.pathname + (from.search || '') : '/dashboard', {
          replace: true,
        });
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setServerError(
          error?.response?.data?.message ||
            'Unable to sign in. Please verify your credentials and try again.',
        );
        setStatus('idle');
        focusFirstError();
      }
    },
    [setUser, remember, location, navigate, focusFirstError],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLFormElement>) => {
      if (e.key !== 'Enter' || status !== 'idle') return;
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      e.preventDefault();
      handleSubmit(onSubmit)();
    },
    [handleSubmit, onSubmit, status],
  );

  const handleCapsLock = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState('CapsLock'));
  }, []);

  return (
    <div className="dm-login flex min-h-screen min-h-dvh items-center justify-center bg-surface-950 px-4 py-10">
      <style>{PAGE_STYLE}</style>

      <AuthCodeBackground />

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-5 flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-800 bg-surface-900">
            <Code2 className="h-5 w-5 text-surface-300" aria-hidden="true" />
          </div>
        </div>

        {/* Sign-in card */}
        <div className="rounded-xl border border-surface-800 bg-surface-900 px-5 py-6 sm:px-6">
          {/* Heading */}
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight text-surface-100">Welcome back</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-surface-400">
              Sign in to continue to your workspace
            </p>
          </div>

          {/* Server error */}
          {serverError && (
            <div
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-[13px] text-red-600"
              role="alert"
              aria-live="polite"
              id={serverErrorId}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{serverError}</span>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            onKeyDown={handleKeyDown}
            className="space-y-4"
            noValidate
          >
            {/* Email */}
            <div>
              <label htmlFor="email" className={labelClass}>
                Email
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
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? emailErrorId : undefined}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-600" id={emailErrorId} role="alert">
                  {errors.email.message}
                </p>
              )}
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
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  onKeyUp={handleCapsLock}
                  onKeyDown={handleCapsLock}
                  className={inputClass(!!errors.password, 'pr-10')}
                  {...register('password')}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? passwordErrorId : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-surface-500 transition-colors hover:bg-surface-800 hover:text-surface-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {capsLock && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-600" aria-live="polite">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  Caps Lock is on
                </p>
              )}
              {errors.password && (
                <p className="mt-1 text-xs text-red-600" id={passwordErrorId} role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember me + Forgot password */}
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer select-none items-center gap-2.5 text-[13px] text-surface-400 transition-colors hover:text-surface-200">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  className={`relative h-5 w-9 rounded-full transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/40 ${
                    remember ? 'bg-primary-500' : 'bg-surface-700'
                  }`}
                >
                  <span
                    className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      remember ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`}
                  />
                </span>
                Remember me
              </label>
              <Link
                to="/auth/forgot-password"
                className="text-[13px] font-medium text-primary-400 transition-colors hover:text-primary-300"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={status !== 'idle'}
              className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary-500 text-sm font-medium text-white transition-colors hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Signing in...
                </>
              ) : status === 'success' ? (
                <>
                  <Check className="h-4 w-4" strokeWidth={3} />
                  Welcome!
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Register link */}
          <p className="mt-4 border-t border-surface-800 pt-4 text-center text-[13px] text-surface-400">
            New here?{' '}
            <Link
              to="/auth/register"
              state={location.state}
              className="font-medium text-primary-400 transition-colors hover:text-primary-300"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
