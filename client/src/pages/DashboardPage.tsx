import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Github, Activity, RefreshCw, Bug, FileText, Trophy, Brain, Database, BookOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '../store';
import { fetchAnalytics } from '../services/analytics';
import type { ProblemsGranularity, ReposGranularity } from '../services/analytics';
import { useProblemsSolved, useReposIndexed } from '../hooks/useAnalyticsCharts';
import { ProblemsSolvedChart } from '../components/dashboard/ProblemsSolvedChart';
import { RepoIndexedChart } from '../components/dashboard/RepoIndexedChart';
import { onAnalyticsUpdate, connectSocket, disconnectSocket } from '../services/socket';
import type { AnalyticsData } from '../types';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

/* ── Aero-glow header ──────────────────────────────────── */
function GlowHeader({ name, updatedLabel, loading, onRefresh }: {
  name: string;
  updatedLabel: string | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <header className="relative flex-shrink-0 overflow-hidden rounded-2xl border border-surface-800 bg-surface-900 px-5 py-4">
      {/* Aero glow accents */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-400">Workspace</p>
          <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-surface-50 sm:text-2xl">
            {greeting},{' '}
            <span className="text-gradient-dashboard">
              {name}
            </span>
          </h1>
          <p className="mt-1 truncate text-xs text-surface-400">
            A live, continuous view of your repositories, code quality and AI activity.
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2.5">
          {updatedLabel && (
            <span className="hidden text-xs text-surface-500 sm:block">Updated {updatedLabel}</span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-surface-700 bg-surface-800/70 px-3.5 py-2 text-sm font-medium text-surface-300 backdrop-blur transition-colors hover:border-cyan-500/40 hover:text-surface-100 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/* ── Action button row ─────────────────────────────────── */
interface ActionButton {
  to: string;
  icon: LucideIcon;
  label: string;
  status: string;
  accent: string;
  glow: string;
}

function ActionRow({ actions }: { actions: ActionButton[] }) {
  return (
    <div className="grid flex-shrink-0 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {actions.map((action, i) => (
        <motion.div
          key={action.to}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 + i * 0.04, duration: 0.35 }}
          className="min-w-0"
        >
          <Link
            to={action.to}
            className={`group relative flex min-h-[68px] items-center gap-3 overflow-hidden rounded-2xl border border-surface-800 bg-surface-900 p-3 sm:p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-surface-600 ${action.glow}`}
          >
            <div className={`flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl border border-transparent transition-colors ${action.accent}`}>
              <action.icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-surface-200">{action.label}</p>
              <p className="flex items-center gap-1 truncate text-[11px] sm:text-xs text-surface-500">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400/80" />
                {action.status}
              </p>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Loading skeleton ──────────────────────────────────── */
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
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [practiceGranularity, setPracticeGranularity] = useState<ProblemsGranularity>('daily');
  const [repoGranularity, setRepoGranularity] = useState<ReposGranularity>('daily');

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetchAnalytics();
      setData(res);
      setError(false);
      setUpdatedAt(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    connectSocket();
    const unsubscribe = onAnalyticsUpdate(() => { fetchStats(); });
    return () => { unsubscribe(); disconnectSocket(); };
  }, [fetchStats]);

  // Ctrl/Cmd + R refreshes dashboard stats
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        setLoading(true);
        setRefreshKey((key) => key + 1);
        fetchStats();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchStats]);

  const overview = data?.overview;
  const quality = data?.quality;
  const trend = data?.trend;

  const repos = overview?.repositories ?? 0;
  const files = overview?.totalFiles ?? 0;
  const indexedRepos = overview?.indexedRepos ?? 0;

  const reviewScore = quality?.reviewScore ?? 0;
  const docCoverage = quality?.documentationCoverage ?? 0;
  const practiceTotal = (trend?.practice ?? []).reduce((a, b) => a + b, 0);

  // Chart data is fetched independently so the two cards can load in parallel.
  const problemsSolved = useProblemsSolved(practiceGranularity, refreshKey);
  const reposIndexed = useReposIndexed(repoGranularity, refreshKey);

  // Show the charts whenever the workspace holds any real data; otherwise fall
  // back to the original "import a repository" empty state.
  const hasAnyData =
    repos > 0 ||
    indexedRepos > 0 ||
    files > 0 ||
    practiceTotal > 0 ||
    (problemsSolved.data?.total ?? 0) > 0 ||
    (reposIndexed.data?.total ?? 0) > 0;

  const actions = useMemo<ActionButton[]>(() => [
    { to: '/github', icon: Github, label: 'Import repository', status: repos > 0 ? `${repos} connected` : 'Get started', accent: 'bg-emerald-500/10 text-emerald-400', glow: 'hover:shadow-lg hover:shadow-emerald-500/10' },
    { to: '/ai/chat', icon: Brain, label: 'AI chat', status: `${indexedRepos} repos ready`, accent: 'bg-cyan-500/10 text-cyan-400', glow: 'hover:shadow-lg hover:shadow-cyan-500/10' },
    { to: '/ai/code-review', icon: Bug, label: 'Code review', status: reviewScore > 0 ? `Score ${reviewScore}/100` : 'Ready', accent: 'bg-amber-500/10 text-amber-400', glow: 'hover:shadow-lg hover:shadow-amber-500/10' },
    { to: '/ai/docs', icon: FileText, label: 'Generate docs', status: `${docCoverage}% documented`, accent: 'bg-purple-500/10 text-purple-400', glow: 'hover:shadow-lg hover:shadow-purple-500/10' },
    { to: '/practice', icon: Trophy, label: 'Practice arena', status: practiceTotal > 0 ? `${practiceTotal} solved` : 'Open arena', accent: 'bg-rose-500/10 text-rose-400', glow: 'hover:shadow-lg hover:shadow-rose-500/10' },
  ], [repos, indexedRepos, reviewScore, docCoverage, practiceTotal]);

  const refreshLabel = updatedAt ? updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const name = user?.name || 'Developer';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-4 overflow-y-auto">

        <GlowHeader
          name={name}
          updatedLabel={refreshLabel}
          loading={loading}
          onRefresh={() => { setLoading(true); setRefreshKey((key) => key + 1); void fetchStats(); }}
        />

        {loading ? (
          <>
            <div className="grid flex-shrink-0 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[60px] sm:h-[68px]" delay={i * 0.05} />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Skeleton className="h-[360px] w-full" delay={0.2} />
              <Skeleton className="h-[360px] w-full" delay={0.25} />
            </div>
          </>
        ) : error || !data ? (
          <div className="flex flex-1 items-center justify-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10">
                <Activity className="h-8 w-8 text-rose-400" />
              </div>
              <p className="text-lg font-medium text-surface-200">Unable to load workspace overview</p>
              <p className="mt-1 text-sm text-surface-400">Please check your connection and try again</p>
              <button
                onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); void fetchStats(); }}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-black/25 transition-all hover:scale-105"
              >
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
            </motion.div>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex min-h-0 flex-1 flex-col gap-4"
          >
            <ActionRow actions={actions} />

            {hasAnyData ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ProblemsSolvedChart
                  data={problemsSolved.data}
                  loading={problemsSolved.isLoading}
                  error={problemsSolved.isError}
                  granularity={practiceGranularity}
                  onGranularityChange={setPracticeGranularity}
                />
                <RepoIndexedChart
                  data={reposIndexed.data}
                  loading={reposIndexed.isLoading}
                  error={reposIndexed.isError}
                  granularity={repoGranularity}
                  onGranularityChange={setRepoGranularity}
                />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <div className="text-center px-6">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500/10">
                    <Activity className="h-8 w-8 text-primary-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-surface-200">Dashboard</h2>
                  <p className="mt-2 text-sm text-surface-500 max-w-md">
                    Import a repository to see analytics, or use the quick actions above to get started.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Empty-workspace nudge — only shown once data has loaded and there is nothing yet */}
        {!loading && !error && data && repos === 0 && files === 0 && (
          <div className="flex flex-shrink-0 items-center gap-3 rounded-2xl border border-surface-800 bg-surface-900/60 px-4 py-3">
            <Database className="h-4 w-4 flex-shrink-0 text-cyan-400" />
            <p className="min-w-0 flex-1 truncate text-xs text-surface-400">
              Your workspace is empty — import a repository to populate every card with real data.
            </p>
            <Link to="/github" className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-cyan-400 hover:text-cyan-300">
              <BookOpen className="h-3.5 w-3.5" /> Import now
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
