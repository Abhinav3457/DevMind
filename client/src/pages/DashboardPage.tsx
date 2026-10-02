import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Github, FileCode, Bot, Activity, Sparkles, BookOpen, Database,
  TrendingUp, RefreshCw, Bug, FileText, Trophy, Brain, GitBranch,
  Star, ArrowRight, GitCommit,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '../store';
import { fetchAnalytics } from '../services/analytics';
import { onAnalyticsUpdate, connectSocket, disconnectSocket } from '../services/socket';
import type { AnalyticsData } from '../types';
import { Sparkline } from '../components/dashboard/Sparkline';
import { TrendLineChart } from '../components/dashboard/TrendLineChart';
import { BreakdownDoughnut } from '../components/dashboard/BreakdownDoughnut';
import type { DoughnutSlice } from '../components/dashboard/BreakdownDoughnut';
import { RadarChart } from '../components/dashboard/RadarChart';
import { InteractiveBarChart } from '../components/dashboard/InteractiveBarChart';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const OP_COLORS = ['#22d3ee', '#a855f7', '#f59e0b', '#10b981', '#6366f1', '#f43f5e'];

const humanizeOp = (type: string) =>
  type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">Workspace</p>
          <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-surface-50 sm:text-2xl">
            {greeting},{' '}
            <span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-400 bg-clip-text text-transparent">
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
    <div className="grid flex-shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
            className={`group relative flex h-full items-center gap-3 overflow-hidden rounded-2xl border border-surface-800 bg-surface-900 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-surface-600 ${action.glow}`}
          >
            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-transparent transition-colors ${action.accent}`}>
              <action.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-surface-200">{action.label}</p>
              <p className="flex items-center gap-1 truncate text-[11px] text-surface-500">
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

/* ── Chart card shell ──────────────────────────────────── */
function ChartCard({
  title, icon: Icon, accent, value, badge, children, className = '',
}: {
  title: string;
  icon: LucideIcon;
  accent: string;
  value?: string | number;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      variants={itemVariants}
      className={`flex min-h-0 flex-col rounded-2xl border border-surface-800 bg-surface-900 p-4 ${className}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${accent}`}>
            <Icon className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-surface-200">{title}</h2>
        </div>
        {value !== undefined && (
          <span className="text-xl font-bold tabular-nums leading-none text-surface-100">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
        )}
        {badge}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </motion.section>
  );
}

/* ── Sparkline tile ────────────────────────────────────── */
function SparkTile({ icon: Icon, label, value, data, color }: {
  icon: LucideIcon;
  label: string;
  value: number;
  data: number[];
  color: string;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-between rounded-xl border border-surface-800 bg-surface-950/40 p-3 transition-colors hover:border-surface-700">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-surface-500">
          <Icon className="h-3 w-3" style={{ color }} />
          <span className="truncate">{label}</span>
        </span>
        <span className="text-sm font-bold tabular-nums text-surface-100">{value.toLocaleString()}</span>
      </div>
      <div className="mt-2 h-8 w-full">
        <Sparkline data={data} color={color} />
      </div>
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
  const navigate = useNavigate();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

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
        fetchStats();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchStats]);

  const overview = data?.overview;
  const quality = data?.quality;
  const activity = data?.activity;
  const health = data?.repositoryHealth;
  const trend = data?.trend;

  const repos = overview?.repositories ?? 0;
  const files = overview?.totalFiles ?? 0;
  const chunks = overview?.totalChunks ?? 0;
  const indexedRepos = overview?.indexedRepos ?? 0;

  const days = trend?.days ?? [];
  const reviewScore = quality?.reviewScore ?? 0;
  const docCoverage = quality?.documentationCoverage ?? 0;
  const securityPercent = quality && quality.securityIssues === 0 ? 100 : Math.max(0, 100 - (quality?.securityIssues ?? 0) * 15);
  const stabilityPercent = Math.max(0, 100 - (quality?.bugCount ?? 0) * 10);
  const healthScore = health?.score ?? 0;
  const practiceTotal = (trend?.practice ?? []).reduce((a, b) => a + b, 0);
  const opsTotal = (data?.operationBreakdown ?? []).reduce((a, b) => a + b.count, 0);

  const actions = useMemo<ActionButton[]>(() => [
    { to: '/github', icon: Github, label: 'Import repository', status: repos > 0 ? `${repos} connected` : 'Get started', accent: 'bg-emerald-500/10 text-emerald-400', glow: 'hover:shadow-lg hover:shadow-emerald-500/10' },
    { to: '/ai/chat', icon: Brain, label: 'AI chat', status: `${indexedRepos} repos ready`, accent: 'bg-cyan-500/10 text-cyan-400', glow: 'hover:shadow-lg hover:shadow-cyan-500/10' },
    { to: '/ai/code-review', icon: Bug, label: 'Code review', status: reviewScore > 0 ? `Score ${reviewScore}/100` : 'Ready', accent: 'bg-amber-500/10 text-amber-400', glow: 'hover:shadow-lg hover:shadow-amber-500/10' },
    { to: '/ai/docs', icon: FileText, label: 'Generate docs', status: `${docCoverage}% documented`, accent: 'bg-purple-500/10 text-purple-400', glow: 'hover:shadow-lg hover:shadow-purple-500/10' },
    { to: '/practice', icon: Trophy, label: 'Practice arena', status: practiceTotal > 0 ? `${practiceTotal} solved` : 'Open arena', accent: 'bg-rose-500/10 text-rose-400', glow: 'hover:shadow-lg hover:shadow-rose-500/10' },
  ], [repos, indexedRepos, reviewScore, docCoverage, practiceTotal]);

  const fileBars = useMemo(() => {
    const langs = data?.languages ?? [];
    return langs.slice(0, 6).map((l) => ({ label: l.name, value: l.files, tooltip: `${l.name}: ${l.files.toLocaleString()} files` }));
  }, [data]);

  const opSlices = useMemo<DoughnutSlice[]>(() =>
    (data?.operationBreakdown ?? []).slice(0, 6).map((op, i) => ({
      label: humanizeOp(op.type),
      value: op.count,
      color: OP_COLORS[i % OP_COLORS.length] ?? '#22d3ee',
    })), [data]);

  const refreshLabel = updatedAt ? updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const name = user?.name || 'Developer';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-4 overflow-y-auto lg:overflow-hidden">

        <GlowHeader
          name={name}
          updatedLabel={refreshLabel}
          loading={loading}
          onRefresh={() => { setLoading(true); void fetchStats(); }}
        />

        {loading ? (
          <>
            <div className="grid flex-shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[60px]" delay={i * 0.05} />
              ))}
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className={`min-h-[160px] ${i === 4 ? 'lg:col-span-2' : ''}`} delay={0.2 + i * 0.05} />
              ))}
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
                onClick={() => { setLoading(true); void fetchStats(); }}
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

            {/* Distinct data cards */}
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-2">
              {/* Repositories — line chart */}
              <ChartCard
                title="Repositories"
                icon={GitBranch}
                accent="bg-cyan-500/10 text-cyan-400"
                value={repos}
              >
                <div className="flex h-full min-h-[120px] flex-col">
                  <p className="mb-1 text-[11px] text-surface-500">
                    {indexedRepos} indexed · last 14 days
                  </p>
                  <div className="min-h-0 flex-1">
                    <TrendLineChart labels={days} values={trend?.indexes ?? []} color="#22d3ee" label="Indexed" />
                  </div>
                </div>
              </ChartCard>

              {/* Files Indexed — bar chart */}
              <ChartCard
                title="Files Indexed"
                icon={FileCode}
                accent="bg-emerald-500/10 text-emerald-400"
                value={files}
              >
                <div className="flex h-full min-h-[120px] flex-col">
                  <p className="mb-1 text-[11px] text-surface-500">
                    {chunks.toLocaleString()} chunks · by language
                  </p>
                  <div className="min-h-0 flex-1">
                    {fileBars.length > 0 ? (
                      <InteractiveBarChart data={fileBars} height={140} showGrid={false} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-surface-500">
                        Index a repository to see files
                      </div>
                    )}
                  </div>
                </div>
              </ChartCard>

              {/* AI Operations — doughnut */}
              <ChartCard
                title="AI Operations"
                icon={Bot}
                accent="bg-amber-500/10 text-amber-400"
              >
                <div className="flex h-full min-h-[120px] items-center">
                  <BreakdownDoughnut slices={opSlices} centerValue={opsTotal} centerLabel="Ops" />
                </div>
              </ChartCard>

              {/* Code Quality — radar */}
              <ChartCard
                title="Code Quality"
                icon={Star}
                accent="bg-purple-500/10 text-purple-400"
              >
                <div className="flex h-full min-h-[160px] items-center justify-center">
                  <RadarChart
                    labels={['Code Review', 'Security', 'Documentation', 'Stability', 'Health']}
                    values={[reviewScore, securityPercent, docCoverage, stabilityPercent, healthScore]}
                    color="#a855f7"
                  />
                </div>
              </ChartCard>

              {/* Workspace Activity — sparklines */}
              <ChartCard
                title="Workspace Activity"
                icon={TrendingUp}
                accent="bg-blue-500/10 text-blue-400"
                className="lg:col-span-2"
                badge={
                  <Link to="/analytics" className="inline-flex items-center gap-1 text-xs font-medium text-primary-400 transition-colors hover:text-primary-300">
                    View analytics <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              >
                <div className="grid h-full min-h-[120px] grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <SparkTile icon={Bot} label="AI Queries" value={activity?.totalAiQueries ?? 0} data={trend?.operations ?? []} color="#22d3ee" />
                  <SparkTile icon={GitCommit} label="Indexes" value={indexedRepos} data={trend?.indexes ?? []} color="#10b981" />
                  <SparkTile icon={Star} label="Reviews" value={(trend?.reviews ?? []).reduce((a, b) => a + b, 0)} data={trend?.reviews ?? []} color="#f59e0b" />
                  <SparkTile icon={FileText} label="Docs" value={(trend?.documents ?? []).reduce((a, b) => a + b, 0)} data={trend?.documents ?? []} color="#a855f7" />
                </div>
              </ChartCard>
            </div>

            {/* Floating AI suggestions banner */}
            <motion.div
              variants={itemVariants}
              className="relative flex flex-shrink-0 flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-500/15 via-indigo-500/10 to-transparent px-5 py-3.5 shadow-lg shadow-purple-500/10"
            >
              <div className="pointer-events-none absolute -left-10 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-purple-500/20 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-purple-500/20">
                  <Sparkles className="h-4 w-4 text-purple-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-surface-100">AI Suggestions available</p>
                  <p className="truncate text-xs text-surface-400">
                    {opsTotal > 0
                      ? `${opsTotal.toLocaleString()} AI operations tracked across your workspace`
                      : 'Ask DevMind AI to review, document or explain your codebase'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/ai/chat')}
                className="relative inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-purple-500/25 transition-transform hover:scale-[1.03]"
              >
                <Brain className="h-4 w-4" /> Ask DevMind AI
              </button>
            </motion.div>
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
