import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Github, FileCode, Bot, Activity, Shield, Check,
  Sparkles, Star, BookOpen, ArrowRight, ArrowUpToLine, GitMerge, Bug, Database, TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '../store';
import { fetchAnalytics } from '../services/analytics';
import type { AnalyticsData } from '../types';
import { AnimatedCounter } from '../components/dashboard/AnimatedCounter';

/* ── Pill badge ────────────────────────────────────────── */
function Pill({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: 'green' | 'amber' | 'purple' | 'cyan' }) {
  const tones: Record<string, string> = {
    green: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
    amber: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
    purple: 'border-purple-500/25 bg-purple-500/10 text-purple-400',
    cyan: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-400',
  };
  return (
    <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      <Icon className="h-3 w-3" />
      <span className="truncate">{label}</span>
    </div>
  );
}

/* ── Stat card ─────────────────────────────────────────── */
function StatCard({
  label,
  value,
  suffix,
  sub,
  icon: Icon,
  color,
  delay = 0,
}: {
  label: string;
  value: number;
  suffix?: string;
  sub: string;
  icon: LucideIcon;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="rounded-2xl border border-dash bg-dash-card p-5 shadow-xl shadow-black/20 transition-colors duration-200 hover:border-purple-500/30 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-xs font-semibold uppercase tracking-wider text-surface-400">{label}</p>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold tabular-nums text-surface-100 sm:text-4xl">
        <AnimatedCounter value={value} delay={delay} />
        {suffix && <span className="ml-1 text-lg font-semibold text-surface-400 sm:text-xl">{suffix}</span>}
      </p>
      <p className="mt-1.5 truncate text-xs text-surface-500">{sub}</p>
    </motion.div>
  );
}

/* ── Quality metric row ────────────────────────────────── */
function MetricRow({ icon: Icon, label, value, max, color, delay = 0 }: { icon: LucideIcon; label: string; value: number; max: number; color: string; delay?: number }) {
  const percent = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay, duration: 0.35 }}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-medium text-surface-300">
          <Icon className="h-3.5 w-3.5 text-surface-500" />
          {label}
        </span>
        <span className="text-xs font-semibold tabular-nums text-surface-100">
          {value.toLocaleString()}
          {max > 0 && <span className="text-surface-500">/{max}</span>}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, delay: 0.2 + delay, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

/* ── Mini stat tile (activity card) ────────────────────── */
function MiniStat({ icon: Icon, label, value, suffix, color, delay = 0 }: { icon: LucideIcon; label: string; value: number; suffix?: string; color: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-xl border border-white/5 bg-white/[0.03] p-3"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-surface-500">
        <Icon className={`h-3 w-3 ${color}`} />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums text-surface-100">
        {value.toLocaleString()}
        {suffix && <span className="text-sm font-medium text-surface-500">{suffix}</span>}
      </p>
    </motion.div>
  );
}

/* ── Skeletons (loading) ───────────────────────────────── */
function Skeleton({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0.4 }}
      animate={{ opacity: [0.4, 0.9, 0.4] }}
      transition={{ duration: 1.4, repeat: Infinity, delay }}
      className={`rounded-xl bg-white/5 ${className}`}
    />
  );
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetchAnalytics();
      setData(res);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Ctrl/Cmd + R refreshes dashboard stats (Ctrl+K is handled globally by the CommandPalette)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        setLoading(true);
        fetchStats();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchStats]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const overview = (data?.overview ?? {}) as AnalyticsData['overview'] & { stars?: number };
  const quality = data?.quality ?? { securityIssues: 0, bugCount: 0, reviewScore: 0, documentationCoverage: 0 };
  const activity = data?.activity;
  const healthScore = data?.repositoryHealth?.score ?? 0;

  const aiOps = overview.aiOperations ?? 0;
  const files = overview.totalFiles ?? 0;
  const chunks = overview.totalChunks ?? 0;
  const repos = overview.repositories ?? 0;
  const securityPercent = quality.securityIssues === 0 ? 100 : Math.max(0, 100 - quality.securityIssues * 15);

  const quickActions = [
    { icon: ArrowUpToLine, label: 'Import', to: '/github', primary: true },
    { icon: Bot, label: 'AI Chat', to: '/ai/chat', primary: false },
    { icon: GitMerge, label: 'Analytics', to: '/analytics', primary: false },
    { icon: Bug, label: 'Code Review', to: '/ai/code-review', primary: false },
  ];

  return (
    <div className="relative min-h-full">
      {/* Charcoal backdrop + diagonal texture */}
      <div className="pointer-events-none fixed inset-0 bg-dash" />
      <div className="pointer-events-none absolute inset-0 bg-diagonal-lines" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[40rem] max-w-full -translate-x-1/2 rounded-full bg-purple-600/10 blur-3xl" />

      <div className="relative z-10 flex w-full flex-col gap-6">
        {/* ── Header + Quick Actions ─────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="min-w-0">
            <p className="glow-text-purple text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">AI Workspace</p>
            <h1 className="mt-1.5 truncate text-3xl font-bold text-surface-100 sm:text-4xl">
              {greeting}, <span className="text-purple-400">{user?.name || 'Developer'}</span>
            </h1>
            <p className="mt-2 text-sm text-surface-400">A clean overview of your repositories, code quality, and AI activity.</p>
          </div>

          {/* Quick Actions in header */}
          <div className="flex flex-wrap items-center gap-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => navigate(action.to)}
                className={
                  'flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 active:scale-95 ' +
                  (action.primary
                    ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/30 hover:brightness-110'
                    : 'border border-white/5 bg-white/[0.03] text-surface-200 hover:border-purple-500/30 hover:bg-white/[0.07] hover:text-surface-100')
                }
              >
                <action.icon className={`h-3.5 w-3.5 ${action.primary ? 'text-white' : action.label === 'AI Chat' ? 'text-cyan-300' : 'text-amber-400'}`} />
                {action.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Content ────────────────────────────────────── */}
        {loading ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
              {[0, 0.06, 0.12, 0.18].map((d, i) => (
                <div key={i} className="rounded-2xl border border-dash bg-dash-card p-5 shadow-xl shadow-black/20 sm:p-6">
                  <Skeleton className="h-3 w-20" delay={d} />
                  <Skeleton className="mt-6 h-9 w-24" delay={d + 0.05} />
                  <Skeleton className="mt-4 h-3 w-28" delay={d + 0.1} />
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
              {[0.1, 0.2, 0.3].map((d, i) => (
                <div key={i} className="rounded-2xl border border-dash bg-dash-card p-5 shadow-xl shadow-black/20 sm:p-6">
                  <Skeleton className="h-4 w-36" delay={d} />
                  <Skeleton className="mt-5 h-2 w-full" delay={d + 0.05} />
                  <Skeleton className="mt-5 h-2 w-3/4" delay={d + 0.1} />
                  <Skeleton className="mt-5 h-2 w-1/2" delay={d + 0.15} />
                </div>
              ))}
            </div>
          </>
        ) : error || !data ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dash bg-dash-card px-4 py-20 text-center shadow-xl shadow-black/20">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10">
              <Activity className="h-7 w-7 text-rose-400" />
            </div>
            <p className="text-base font-semibold text-surface-100">Unable to load workspace overview</p>
            <p className="mt-1 text-sm text-surface-500">Please check your connection and try again</p>
            <button
              onClick={() => { setLoading(true); fetchStats(); }}
              className="mt-6 flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-500/30 transition-all hover:scale-105"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* ── Stat cards ─────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
              <StatCard label="Repositories" value={repos} icon={Github} color="bg-emerald-500/10 text-emerald-400" sub={repos > 0 ? 'Connected to GitHub' : 'Connect GitHub to begin'} delay={0.05} />
              <StatCard label="Files Indexed" value={files} icon={FileCode} color="bg-amber-500/10 text-amber-400" sub="Across all imported repos" delay={0.1} />
              <StatCard label="AI Operations" value={aiOps} icon={Bot} color="bg-cyan-500/10 text-cyan-400" sub="Chats, reviews & docs generated" delay={0.15} />
              <StatCard label="Repo Health" value={healthScore} suffix="/100" icon={Activity} color="bg-purple-500/10 text-purple-400" sub="Overall codebase health" delay={0.2} />
            </div>

            {/* ── Health · Quality · Activity ────────────── */}
            <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
              {/* Repository Health */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className="rounded-2xl border border-dash bg-dash-card p-5 shadow-xl shadow-black/20 sm:p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-surface-100">
                    <Activity className="h-4 w-4 text-purple-400" />
                    Repository Health
                  </h3>
                  <p className="text-3xl font-bold tabular-nums text-surface-100">
                    {healthScore}
                    <span className="text-base font-medium text-surface-500">/100</span>
                  </p>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${healthScore}%` }}
                    transition={{ duration: 1, delay: 0.35, ease: 'easeOut' }}
                  />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Pill icon={Check} label={repos > 0 ? 'Build: Passing' : 'Build: No repos yet'} tone="green" />
                  <Pill icon={Shield} label={quality.securityIssues === 0 ? 'Security: Clear' : `Security: ${quality.securityIssues} issue${quality.securityIssues === 1 ? '' : 's'}`} tone={quality.securityIssues === 0 ? 'green' : 'amber'} />
                  <Pill icon={Sparkles} label={`AI suggestions: ${aiOps.toLocaleString()}`} tone="purple" />
                </div>
                <Link
                  to="/analytics"
                  className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-purple-400 transition-colors hover:text-purple-300"
                >
                  View analytics <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>

              {/* Code Quality */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="rounded-2xl border border-dash bg-dash-card p-5 shadow-xl shadow-black/20 sm:p-6"
              >
                <h3 className="flex items-center gap-2 text-base font-semibold text-surface-100">
                  <Star className="h-4 w-4 text-amber-400" />
                  Code Quality
                </h3>
                <div className="mt-5 space-y-5">
                  <MetricRow icon={Star} label="Review Score" value={quality.reviewScore} max={100} color="bg-gradient-to-r from-purple-500 to-purple-400" delay={0.35} />
                  <MetricRow icon={BookOpen} label="Documentation" value={quality.documentationCoverage} max={100} color="bg-gradient-to-r from-cyan-500 to-cyan-400" delay={0.4} />
                  <MetricRow icon={Shield} label="Security" value={securityPercent} max={100} color="bg-gradient-to-r from-emerald-500 to-emerald-400" delay={0.45} />
                </div>
                <Link
                  to="/ai/code-review"
                  className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-purple-400 transition-colors hover:text-purple-300"
                >
                  Run a code review <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>

              {/* Workspace Activity */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.35 }}
                className="rounded-2xl border border-dash bg-dash-card p-5 shadow-xl shadow-black/20 sm:p-6"
              >
                <h3 className="flex items-center gap-2 text-base font-semibold text-surface-100">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  Workspace Activity
                </h3>
                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  <MiniStat icon={Bot} label="AI Queries" value={activity?.totalAiQueries ?? 0} color="text-cyan-400" delay={0.4} />
                  <MiniStat icon={Database} label="Chunks" value={chunks} color="text-purple-400" delay={0.45} />
                  <MiniStat icon={FileCode} label="Files" value={files} color="text-amber-400" delay={0.5} />
                  <MiniStat icon={Star} label="Avg Review" value={activity?.avgReviewScore ?? 0} suffix="/100" color="text-emerald-400" delay={0.55} />
                </div>
                <Link
                  to="/analytics"
                  className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-purple-400 transition-colors hover:text-purple-300"
                >
                  Explore insights <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
