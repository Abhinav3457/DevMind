import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  UserPlus, Mail, Lock, Eye, EyeOff, Loader2, Code2, User, AtSign,
  CheckCircle2, AlertTriangle, Check, ShieldCheck,
} from 'lucide-react';
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

/* ── Ambient animated orbs (shared auth-page styling) ── */
function AmbientOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-primary-600/20 blur-3xl animate-float-slow" />
      <div className="absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-purple-600/20 blur-3xl animate-float-slower" />
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
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

  const inputClass = (hasError: boolean) =>
    'w-full rounded-lg border bg-surface-800 py-2.5 pl-10 pr-4 text-sm text-surface-100 placeholder-surface-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
    (hasError ? 'border-red-500' : 'border-surface-600');

  const iconClass = (field: string) =>
    'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-200 ' +
    (focusedField === field ? 'text-blue-400' : 'text-surface-400');

  if (isSuccess) {
    return (
      <div className="relative flex min-h-screen min-h-dvh items-center justify-center overflow-hidden bg-surface-950 px-4">
        <AmbientOrbs />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="mb-6 flex justify-center"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
              <Check className="h-10 w-10 text-emerald-400" strokeWidth={3} />
            </div>
          </motion.div>
          <h2 className="mb-2 text-2xl font-bold text-surface-100">Registration successful</h2>
          <p className="mb-6 text-sm text-surface-400">
            Please check your email to verify your account. Redirecting to sign in...
          </p>
          <Link
            to="/auth/login"
            state={location.state}
            className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            Go to Sign In
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen min-h-dvh items-center justify-center overflow-hidden bg-surface-950 px-4 py-10">
      <AmbientOrbs />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mb-4 flex justify-center"
          >
            <motion.div
              whileHover={{ scale: 1.08, rotate: -4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30"
            >
              <Code2 className="h-8 w-8 text-white" />
            </motion.div>
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-bold text-surface-100">Create account</h1>
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-surface-400">Join DevMind AI and start building with confidence</p>
        </div>

        {/* Register Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          whileHover={{ y: -2 }}
          className="rounded-xl sm:rounded-2xl border border-surface-700 bg-surface-800/50 p-5 sm:p-8 backdrop-blur-xl shadow-2xl shadow-black/30"
        >
          {serverError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] }}
              transition={{ duration: 0.45 }}
              className="mb-6 flex items-start gap-2.5 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{serverError}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Name */}
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-surface-200">
                Full Name
              </label>
              <div className="relative">
                <User className={iconClass('name')} />
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
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-surface-200">
                Username
              </label>
              <div className="relative">
                <AtSign className={iconClass('username')} />
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
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-surface-200">
                Email Address
              </label>
              <div className="relative">
                <Mail className={iconClass('email')} />
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
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-surface-200">
                Password
              </label>
              <div className="relative">
                <Lock className={iconClass('password')} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  onKeyUp={handleCapsLock}
                  onKeyDown={handleCapsLock}
                  className={inputClass(!!errors.password) + ' pr-10'}
                  {...register('password')}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-surface-400 transition-colors hover:text-surface-200 hover:bg-surface-700/50"
                  tabIndex={-1}
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
                            i <= strength ? strengthColor : 'bg-surface-700'
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
                  <AlertTriangle className="h-3 w-3" />
                  Caps Lock is on
                </p>
              )}
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
                <Lock className={iconClass('confirm')} />
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  className={inputClass(!!errors.confirmPassword) + ' pr-10'}
                  {...register('confirmPassword')}
                  onFocus={() => setFocusedField('confirm')}
                  onBlur={() => setFocusedField(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-surface-400 transition-colors hover:text-surface-200 hover:bg-surface-700/50"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && !errors.confirmPassword && (
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
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
              whileTap={{ scale: 0.97 }}
              className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 hover:from-blue-500 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {/* Sheen sweep */}
              <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-white/20 blur-md transition-transform duration-700 ease-out group-hover:translate-x-[350%] group-disabled:translate-x-0" />
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {isSubmitting ? 'Creating account...' : 'Create Account'}
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
            Your data is protected with hashed passwords & JWT auth
          </motion.p>

          {/* Login Link */}
          <div className="relative mt-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-surface-700/70" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface-800/60 px-3 text-[11px] uppercase tracking-wider text-surface-500 backdrop-blur">
                Already have an account?
              </span>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-surface-400">
            <Link
              to="/auth/login"
              className="group/link font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span className="relative">
                Sign in
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-blue-400 transition-all duration-300 group-hover/link:w-full" />
              </span>
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
