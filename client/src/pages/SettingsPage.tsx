import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Settings, Palette, User, ShieldCheck, Sun, Moon, Check, Monitor,
  Lock, Eye, EyeOff, Loader2, AtSign, KeyRound,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { useAuthStore, useUIStore } from '../store';
import { changePassword } from '../services/auth';

const themeOptions = [
  {
    value: 'dark' as const,
    label: 'Dark',
    description: 'Easy on the eyes in low light',
    icon: Moon,
    shell: 'bg-surface-950',
    edge: 'border-surface-800',
    line: 'bg-surface-600',
    accent: 'from-purple-500 to-blue-500',
  },
  {
    value: 'light' as const,
    label: 'Light',
    description: 'Bright and high contrast',
    icon: Sun,
    shell: 'bg-surface-50',
    edge: 'border-surface-200',
    line: 'bg-surface-300',
    accent: 'from-amber-400 to-orange-500',
  },
];

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

const inputClass = (hasError?: boolean) =>
  'h-[38px] w-full rounded-lg border bg-surface-950 pl-9 pr-10 text-sm text-surface-100 ' +
  'placeholder:text-surface-500 transition-colors focus:border-primary-500 focus:outline-none ' +
  'focus:ring-2 focus:ring-primary-500/20 ' +
  (hasError ? 'border-red-500/60' : 'border-surface-700/60 hover:border-surface-600');

function PasswordField({
  id,
  label,
  placeholder,
  error,
  registration,
}: {
  id: string;
  label: string;
  placeholder: string;
  error?: string;
  registration: UseFormRegisterReturn;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-surface-400">
        {label}
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete="new-password"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={inputClass(!!error)}
          {...registration}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-surface-500 transition-colors hover:bg-surface-800 hover:text-surface-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  gradient,
  className,
  footer,
  children,
}: {
  icon: typeof Palette;
  title: string;
  description: string;
  gradient: string;
  className?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-2xl border border-surface-700/70 bg-surface-900 ${className || ''}`}
    >
      <div className="flex items-center gap-3 border-b border-surface-700/60 bg-gradient-to-b from-surface-800/70 to-surface-900 px-4 py-3.5 sm:px-5">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg shadow-black/20`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-surface-50">{title}</h2>
          <p className="mt-0.5 truncate text-xs text-surface-400">{description}</p>
        </div>
      </div>
      <div className="flex-1 p-4 sm:p-5">{children}</div>
      {footer && (
        <div className="flex items-start gap-2 border-t border-surface-700/60 bg-surface-950/40 px-4 py-3 text-[11px] leading-relaxed text-surface-500 sm:px-5">
          {footer}
        </div>
      )}
    </section>
  );
}

function ThemePreview({ option }: { option: (typeof themeOptions)[number] }) {
  return (
    <div className={`relative h-24 w-full overflow-hidden rounded-lg border ${option.shell} ${option.edge}`}>
      <div className={`h-1 w-full bg-gradient-to-r ${option.accent} opacity-80`} />
      <div className={`flex h-4 items-center gap-1 border-b px-1.5 ${option.edge}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${option.line}`} />
        <span className={`h-1.5 w-1.5 rounded-full ${option.line}`} />
        <span className={`h-1.5 w-1.5 rounded-full ${option.line}`} />
      </div>
      <div className="flex h-[calc(100%-2.25rem)]">
        <div className={`w-1/4 space-y-1.5 border-r p-1.5 ${option.edge}`}>
          <div className={`h-1 w-3/4 rounded ${option.line}`} />
          <div className={`h-1 w-1/2 rounded ${option.line}`} />
          <div className={`h-1 w-2/3 rounded ${option.line}`} />
        </div>
        <div className="flex-1 space-y-1.5 p-1.5">
          <div className={`h-1.5 w-1/3 rounded ${option.line}`} />
          <div className={`h-1 w-full rounded ${option.line}`} />
          <div className={`h-1 w-2/3 rounded ${option.line}`} />
          <div className={`mt-2 h-4 w-16 rounded bg-gradient-to-r ${option.accent} opacity-70`} />
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { theme, setTheme } = useUIStore();
  const { user } = useAuthStore();
  const [savingPassword, setSavingPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onTouched',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmitPassword = async (data: ChangePasswordForm) => {
    if (savingPassword) return;
    setSavingPassword(true);
    try {
      await changePassword(data.currentPassword, data.newPassword);
      toast.success('Password updated successfully');
      reset();
    } catch {
      /* server/interceptor already surfaced the error */
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = (user?.name || 'Developer')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const detailRows = [
    { label: 'Full name', value: user?.name || 'Developer', icon: User },
    { label: 'Email address', value: user?.email || '—', icon: AtSign },
    { label: 'Role', value: user?.role ? (user.role === 'admin' ? 'Administrator' : 'Member') : 'Member', icon: ShieldCheck },
    { label: 'Account ID', value: user?.id || '—', icon: KeyRound },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full min-h-0 flex-col gap-4 overflow-x-hidden overflow-y-auto pb-1 sm:gap-6"
    >
      <PageHeader
        icon={Settings}
        title="Settings"
        description="Tune the look of DevMind AI and manage your account"
        gradient="from-slate-500 to-slate-700"
        actions={
          <div className="flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-xs font-medium text-surface-300">
            {theme === 'dark' ? <Moon className="h-3.5 w-3.5 text-purple-400" /> : <Sun className="h-3.5 w-3.5 text-amber-400" />}
            {theme === 'dark' ? 'Dark mode' : 'Light mode'}
          </div>
        }
      />

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SectionCard
          icon={Palette}
          title="Theme"
          description="Applied instantly, no reload"
          gradient="from-pink-500 to-rose-500"
          footer={
            <>
              <Monitor className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Remembered on this browser for your next visit.</span>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {themeOptions.map((option) => {
              const active = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  aria-pressed={active}
                  className={
                    'group relative flex flex-col gap-3 rounded-xl border p-3 text-left transition-all duration-150 hover:-translate-y-0.5 ' +
                    (active
                      ? 'border-primary-500 bg-primary-500/10 ring-1 ring-primary-500/40'
                      : 'border-surface-700/70 bg-surface-950/40 hover:border-surface-600 hover:bg-surface-800/60')
                  }
                >
                  <ThemePreview option={option} />

                  <div className="flex items-center gap-2.5">
                    <span
                      className={
                        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors ' +
                        (active ? 'bg-primary-500/20 text-primary-300' : 'bg-surface-800 text-surface-400')
                      }
                    >
                      <option.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className={'text-sm font-medium ' + (active ? 'text-surface-50' : 'text-surface-200')}>
                        {option.label}
                      </p>
                      <p className="truncate text-xs text-surface-400">{option.description}</p>
                    </div>
                  </div>

                  <span
                    className={
                      'absolute right-2.5 top-3.5 flex h-5 w-5 items-center justify-center rounded-full transition-all ' +
                      (active
                        ? 'bg-primary-500 text-white'
                        : 'border border-surface-600 bg-surface-900 text-transparent opacity-0 group-hover:opacity-100')
                    }
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          icon={User}
          title="Profile"
          description="Details registered with DevMind AI"
          gradient="from-indigo-500 to-blue-600"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 text-lg font-bold text-white shadow-lg shadow-primary-500/20">
                {initials || 'D'}
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-surface-900">
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </span>
            </div>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-surface-50 sm:text-base">
                <span className="truncate">{user?.name || 'Developer'}</span>
                {user?.role === 'admin' && (
                  <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-300">
                    Admin
                  </span>
                )}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-surface-400 sm:text-sm">
                <AtSign className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{user?.email || 'No email on file'}</span>
              </p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {detailRows.map((row) => (
              <div
                key={row.label}
                className="rounded-xl border border-surface-700/60 bg-surface-950/40 px-3.5 py-3 transition-colors hover:border-surface-600"
              >
                <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-surface-500">
                  <row.icon className="h-3 w-3" />
                  {row.label}
                </dt>
                <dd className="mt-1 truncate text-sm font-medium text-surface-200" title={row.value}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </SectionCard>

        <SectionCard
          icon={ShieldCheck}
          title="Security"
          description="Update your sign-in password"
          gradient="from-emerald-500 to-teal-600"
          className="md:col-span-2 xl:col-span-1"
          footer={
            <>
              <KeyRound className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Changing your password signs you out of other devices. Current sessions stay active until their
                access token expires.
              </span>
            </>
          }
        >
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1"
            onSubmit={(event) => {
              void handleSubmit(onSubmitPassword)(event);
            }}
            noValidate
          >
            <PasswordField
              id="currentPassword"
              label="Current password"
              placeholder="Enter current password"
              error={errors.currentPassword?.message}
              registration={register('currentPassword')}
            />
            <PasswordField
              id="newPassword"
              label="New password"
              placeholder="At least 8 characters"
              error={errors.newPassword?.message}
              registration={register('newPassword')}
            />
            <PasswordField
              id="confirmPassword"
              label="Confirm new password"
              placeholder="Re-enter new password"
              error={errors.confirmPassword?.message}
              registration={register('confirmPassword')}
            />

            <div className="flex justify-end sm:col-span-2 xl:col-span-1">
              <button
                type="submit"
                disabled={savingPassword}
                className="flex h-[38px] items-center gap-2 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {savingPassword ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>
    </motion.div>
  );
}
