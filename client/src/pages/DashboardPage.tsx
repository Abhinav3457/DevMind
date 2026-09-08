import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Github, FileCode, Bot, Activity, Shield, Check,
  Sparkles, Star, BookOpen, ArrowRight, Database, TrendingUp,
  RefreshCw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '../store';
import { fetchAnalytics } from '../services/analytics';
import { onAnalyticsUpdate, connectSocket, disconnectSocket } from '../services/socket';
import type { AnalyticsData } from '../types';
import { PageHeader } from '../components/layout/PageHeader';
import { StatCard } from '../components/dashboard/StatCard';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/* ── Pill badge ────────────────────────────────────────── */
function Pill({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: 'green' | 'amber' | 'purple' }) {
  const tones: Record<string, string> = {
    green: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    purple: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
  };
  return (
    <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      <Icon className="h-3 w-3" />
      <span className="truncate">{label}</span>
    </div>
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
      <div className="h-2 overflow-hidden rounded-full bg-surface-800">
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
      className="rounded-xl border border-surface-800 bg-surface-800 p-3"
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
      className={`rounded-xl bg-surface-800 ${className}`}
    />
  );
}

export function DashboardPage() {
  const { user } = useAuthStore();
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

  useEffect(() => {
    connectSocket();
    const unsubscribe = onAnalyticsUpdate((_update) => {
      fetchStats();
    });
    return () => {
      unsubscribe();
      disconnectSocket();
    };
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

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* ── Header + Quick Actions ─────────────────────── */}
        <div>
          <PageHeader
            icon={LayoutDashboard}
            title={`${greeting}, ${user?.name || 'Developer'}`}
            description="A clean overview of your repositories, code quality, and AI activity."
            gradient="from-blue-500 to-indigo-600"
          />
          <div className="mt-5 h-px bg-gradient-to-r from-transparent via-surface-700 to-transparent sm:mt-6" />
        </div>

        {/* ── Content ────────────────────────────────────── */}
        {loading ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {[0, 0.06, 0.12, 0.18].map((d, i) => (
                <div key={i} className="rounded-2xl border border-surface-800 bg-surface-900 p-4 sm:p-5">
                  <Skeleton className="h-3 w-20" delay={d} />
                  <Skeleton className="mt-6 h-8 w-24" delay={d + 0.05} />
                  <Skeleton className="mt-4 h-3 w-28" delay={d + 0.1} />
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
              {[0.1, 0.2, 0.3].map((d, i) => (
                <div key={i} className="rounded-2xl border border-surface-800 bg-surface-900 p-4 sm:p-6">
                  <Skeleton className="h-4 w-36" delay={d} />
                  <Skeleton className="mt-5 h-2 w-full" delay={d + 0.05} />
                  <Skeleton className="mt-5 h-2 w-3/4" delay={d + 0.1} />
                  <Skeleton className="mt-5 h-2 w-1/2" delay={d + 0.15} />
                </div>
              ))}
            </div>
          </>
        ) : error || !data ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10">
                <Activity className="h-8 w-8 text-rose-400" />
              </div>
              <p className="text-lg font-medium text-surface-200">Unable to load workspace overview</p>
              <p className="mt-1 text-sm text-surface-400">Please check your connection and try again</p>
              <button
                onClick={() => { setLoading(true); fetchStats(); }}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-black/25 transition-all hover:scale-105"
              >
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
            </motion.div>
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            {/* ── Stat cards ─────────────────────────────── */}
            <motion.div variants={itemVariants} className="mb-6 sm:mb-8">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <StatCard title="Repositories" value={repos} icon={Github} color="green" subtitle={repos > 0 ? 'Connected to GitHub' : 'Connect GitHub to begin'} delay={0.1} />
                <StatCard title="Files Indexed" value={files} icon={FileCode} color="cyan" subtitle="Across all imported repos" delay={0.15} />
                <StatCard title="AI Operations" value={aiOps} icon={Bot} color="amber" subtitle="Chats, reviews & docs generated" delay={0.2} />
                <StatCard title="Repo Health" value={`${healthScore}/100`} icon={Activity} color="purple" subtitle="Overall codebase health" delay={0.25} />
              </div>
            </motion.div>

            {/* ── Health · Quality · Activity ────────────── */}
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
              {/* Repository Health */}
              <motion.div variants={itemVariants} className="rounded-2xl border border-surface-800 bg-surface-900 p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-2 sm:mb-5">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                    <Activity className="h-4 w-4 text-purple-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-surface-200">Repository Health</h2>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-surface-400">Overall health score</p>
                  <p className="text-3xl font-bold tabular-nums text-surface-100">
                    {healthScore}
                    <span className="text-base font-medium text-surface-500">/100</span>
                  </p>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-800">
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
                  className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary-400 transition-colors hover:text-primary-300"
                >
                  View analytics <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>

              {/* Code Quality */}
              <motion.div variants={itemVariants} className="rounded-2xl border border-surface-800 bg-surface-900 p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-2 sm:mb-5">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                    <Star className="h-4 w-4 text-amber-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-surface-200">Code Quality</h2>
                </div>
                <div className="space-y-5">
                  <MetricRow icon={Star} label="Review Score" value={quality.reviewScore} max={100} color="bg-gradient-to-r from-purple-500 to-purple-400" delay={0.35} />
                  <MetricRow icon={BookOpen} label="Documentation" value={quality.documentationCoverage} max={100} color="bg-gradient-to-r from-cyan-500 to-cyan-400" delay={0.4} />
                  <MetricRow icon={Shield} label="Security" value={securityPercent} max={100} color="bg-gradient-to-r from-emerald-500 to-emerald-400" delay={0.45} />
                </div>
                <Link
                  to="/ai/code-review"
                  className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary-400 transition-colors hover:text-primary-300"
                >
                  Run a code review <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>

              {/* Workspace Activity */}
              <motion.div variants={itemVariants} className="rounded-2xl border border-surface-800 bg-surface-900 p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-2 sm:mb-5">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
                    <TrendingUp className="h-4 w-4 text-cyan-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-surface-200">Workspace Activity</h2>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <MiniStat icon={Bot} label="AI Queries" value={activity?.totalAiQueries ?? 0} color="text-cyan-400" delay={0.4} />
                  <MiniStat icon={Database} label="Chunks" value={chunks} color="text-purple-400" delay={0.45} />
                  <MiniStat icon={FileCode} label="Files" value={files} color="text-amber-400" delay={0.5} />
                  <MiniStat icon={Star} label="Avg Review" value={activity?.avgReviewScore ?? 0} suffix="/100" color="text-emerald-400" delay={0.55} />
                </div>
                <Link
                  to="/analytics"
                  className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary-400 transition-colors hover:text-primary-300"
                >
                  Explore insights <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}