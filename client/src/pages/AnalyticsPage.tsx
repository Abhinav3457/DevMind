import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  GitBranch,
  FileCode,
  Code2,
  Shield,
  Bug,
  Star,
  BookOpen,
  Activity,
  Database,
  RefreshCw,
  GitCommit,
  BarChart3,
  TrendingUp,
  Zap,
  ChevronDown,
} from 'lucide-react';
import { fetchAnalytics } from '../services/analytics';
import apiClient from '../api/axios';
import { StatCard } from '../components/dashboard/StatCard';
import { LanguageChart } from '../components/dashboard/LanguageChart';
import { HealthScore } from '../components/dashboard/HealthScore';
import { InteractiveBarChart } from '../components/dashboard/InteractiveBarChart';

interface RepoOption {
  id: string;
  repoName: string;
  fileCount: number;
}

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

/* ── Simple Quality Metric Row ──────────────────────────── */
interface QualityMetricProps {
  icon: typeof Shield;
  label: string;
  value: number;
  max: number;
  color: string;
  status: 'healthy' | 'warning' | 'critical';
}

function QualityMetricBar({ icon: Icon, label, value, max, color, status }: QualityMetricProps) {
  const percent = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  const statusColors = {
    healthy: 'from-emerald-500 to-emerald-400',
    warning: 'from-amber-500 to-amber-400',
    critical: 'from-rose-500 to-rose-400',
  };
  const statusBadge = {
    healthy: { text: 'Healthy', bg: 'bg-emerald-500/10 text-emerald-400' },
    warning: { text: 'Attention', bg: 'bg-amber-500/10 text-amber-400' },
    critical: { text: 'Critical', bg: 'bg-rose-500/10 text-rose-400' },
  };

  return (
    <div className="rounded-xl border border-surface-700/40 bg-surface-800/30 p-4 transition-all hover:border-surface-600/60 hover:bg-surface-800/50">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`rounded-lg p-2 bg-gradient-to-br ${color}/10 flex-shrink-0`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <p className="truncate text-sm font-semibold text-surface-100">{label}</p>
        </div>
        <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge[status].bg}`}>
          {statusBadge[status].text}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-700/50">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${statusColors[status]}`}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <span className="w-10 text-right text-xs font-bold tabular-nums text-surface-200">{percent}%</span>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>(undefined);
  const [reports, setReports] = useState<RepoOption[]>([]);

  useEffect(() => {
    apiClient.get('/ai/repo-intelligence/reports').then(res => {
      const list = res.data.data?.reports || [];
      setReports(list);
      if (list.length > 0 && !selectedReportId) {
        setSelectedReportId(list[0].id);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['analytics', selectedReportId],
    queryFn: () => fetchAnalytics(selectedReportId),
    staleTime: 0,
    refetchInterval: 30000,
  });

  /* ── Loading ────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-surface-700 border-t-blue-500" />
            <Zap className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-blue-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-surface-200">Loading analytics</p>
            <p className="mt-1 text-xs text-surface-400">Crunching the numbers…</p>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ── Error ──────────────────────────────── */
  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10">
            <Activity className="h-8 w-8 text-rose-400" />
          </div>
          <p className="text-lg font-medium text-surface-200">Failed to load analytics</p>
          <p className="mt-1 text-sm text-surface-400">Please check your connection and try again</p>
          <button onClick={() => refetch()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-105 hover:shadow-blue-500/40">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </motion.div>
      </div>
    );
  }

  const { overview, languages, linesOfCode, repositoryHealth, quality, activity } = data;

  const locBarData = linesOfCode.byLanguage.slice(0, 10).map((l) => ({
    label: l.language, value: l.lines, tooltip: `${l.language}: ${l.lines.toLocaleString()} lines`,
  }));

  /* ── Quality status helpers ─────────────── */
  const securityStatus = quality.securityIssues === 0 ? 'healthy' : quality.securityIssues <= 2 ? 'warning' : 'critical';
  const bugStatus = quality.bugCount === 0 ? 'healthy' : quality.bugCount <= 3 ? 'warning' : 'critical';
  const reviewStatus = quality.reviewScore >= 70 ? 'healthy' : quality.reviewScore >= 40 ? 'warning' : 'critical';
  const docStatus = quality.documentationCoverage >= 70 ? 'healthy' : quality.documentationCoverage >= 40 ? 'warning' : 'critical';

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* ── Header ────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            {/* Title */}
            <div className="min-w-0 space-y-1 sm:space-y-2">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <h1 className="truncate text-xl font-bold tracking-tight text-surface-100 sm:text-2xl">Analytics Dashboard</h1>
              </div>
              <p className="pl-[46px] text-xs text-surface-400 sm:pl-[52px] sm:text-sm">
                Overview of your repositories and AI operations
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {reports.length > 0 && (
                <div className="relative">
                  <Database className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                  <select value={selectedReportId || ''} onChange={(e) => setSelectedReportId(e.target.value || undefined)}
                    className="max-w-[220px] cursor-pointer appearance-none rounded-xl border border-surface-700 bg-surface-800/80 py-2.5 pl-9 pr-8 text-xs text-surface-200 backdrop-blur-sm transition-all focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:max-w-[280px] sm:text-sm"
                    aria-label="Select report">
                    <option value="">All Reports</option>
                    {reports.map((r) => (<option key={r.id} value={r.id} className="truncate">{r.repoName} ({r.fileCount} files)</option>))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                </div>
              )}
              <button onClick={() => refetch()} disabled={isFetching}
                className="flex items-center gap-2 rounded-xl border border-surface-700 bg-surface-800/80 px-3 py-2.5 text-xs text-surface-300 backdrop-blur-sm transition-all hover:border-surface-600 hover:bg-surface-700/80 hover:text-surface-100 disabled:opacity-50 sm:px-4 sm:text-sm"
                aria-label="Refresh data">
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isFetching ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
          <div className="mt-5 h-px bg-gradient-to-r from-transparent via-surface-700 to-transparent sm:mt-6" />
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          {/* ── Overview Stats ────────────────────── */}
          <motion.div variants={itemVariants} className="mb-6 sm:mb-8">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
              <StatCard title="Repositories" value={overview.repositories} icon={GitBranch} color="green" delay={0.1} />
              <StatCard title="Indexed Repos" value={overview.indexedRepos} icon={Database} color="purple" delay={0.2} />
              <StatCard title="Total Files" value={overview.totalFiles} icon={FileCode} color="cyan" delay={0.25} />
              <StatCard title="Total Chunks" value={overview.totalChunks} icon={Code2} color="indigo" delay={0.3} />
              <StatCard title="AI Operations" value={overview.aiOperations} icon={Activity} color="amber" delay={0.35} />
            </div>
          </motion.div>

          {/* ── Charts Row: Language · Health · Quality ──── */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3 sm:mb-8">
            {/* Language Distribution */}
            <motion.div variants={itemVariants} className="rounded-2xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-950/80 p-4 backdrop-blur-xl shadow-xl sm:p-6">
              <div className="mb-4 flex items-center gap-2 sm:mb-5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-500/10"><Code2 className="h-4 w-4 text-cyan-400" /></div>
                <h2 className="text-sm font-semibold text-surface-200">Language Distribution</h2>
              </div>
              <div className="h-64 sm:h-72"><LanguageChart languages={languages} /></div>
            </motion.div>

            {/* Repository Health */}
            <motion.div variants={itemVariants} className="rounded-2xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-950/80 p-4 backdrop-blur-xl shadow-xl sm:p-6">
              <div className="mb-4 flex items-center gap-2 sm:mb-5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10"><Activity className="h-4 w-4 text-emerald-400" /></div>
                <h2 className="text-sm font-semibold text-surface-200">Repository Health</h2>
              </div>
              <HealthScore score={repositoryHealth.score} level={repositoryHealth.level} metrics={repositoryHealth.metrics} />
            </motion.div>

            {/* Code Quality */}
            <motion.div variants={itemVariants} className="rounded-2xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-950/80 p-4 backdrop-blur-xl shadow-xl sm:p-6">
              <div className="mb-4 flex items-center gap-2 sm:mb-5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500/10"><Star className="h-4 w-4 text-purple-400" /></div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-surface-200">Code Quality</h2>
                  <p className="truncate text-[10px] text-surface-400">Across your entire codebase</p>
                </div>
              </div>

              <div className="space-y-3">
                <QualityMetricBar
                  icon={Shield} label="Security" value={quality.securityIssues === 0 ? 100 : Math.max(0, 100 - quality.securityIssues * 15)} max={100}
                  color="text-rose-400" status={securityStatus}
                />
                <QualityMetricBar
                  icon={Bug} label="Stability" value={quality.bugCount === 0 ? 100 : Math.max(0, 100 - quality.bugCount * 10)} max={100}
                  color="text-amber-400" status={bugStatus}
                />
                <QualityMetricBar
                  icon={Star} label="Code Review" value={quality.reviewScore} max={100}
                  color="text-blue-400" status={reviewStatus}
                />
                <QualityMetricBar
                  icon={BookOpen} label="Documentation" value={quality.documentationCoverage} max={100}
                  color="text-indigo-400" status={docStatus}
                />
              </div>
            </motion.div>
          </div>

          {/* ── Bottom Row ──── */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Lines of Code */}
            <motion.div variants={itemVariants} className="rounded-2xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-950/80 p-4 backdrop-blur-xl shadow-xl sm:p-6">
              <div className="mb-4 flex items-center gap-2 sm:mb-5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10"><FileCode className="h-4 w-4 text-blue-400" /></div>
                <h2 className="text-sm font-semibold text-surface-200">Lines of Code by Language</h2>
              </div>
              <div className="mb-5 rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 p-4 sm:mb-6">
                <p className="text-2xl font-bold tracking-tight text-surface-100 sm:text-3xl">{linesOfCode.total.toLocaleString()}</p>
                <p className="mt-1 text-xs text-surface-400">Estimated total lines across all indexed repositories</p>
              </div>
              {locBarData.length > 0 && (
                <div>
                  <InteractiveBarChart data={locBarData} height={180} />
                </div>
              )}
            </motion.div>

            {/* Activity Summary */}
            <motion.div variants={itemVariants} className="rounded-2xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-950/80 p-4 backdrop-blur-xl shadow-xl sm:p-6">
              <div className="mb-4 flex items-center gap-2 sm:mb-5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10"><TrendingUp className="h-4 w-4 text-amber-400" /></div>
                <h2 className="text-sm font-semibold text-surface-200">Activity Summary</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="group rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-4 transition-all hover:border-blue-500/40">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20 transition-transform group-hover:scale-110 sm:h-10 sm:w-10"><Database className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" /></div>
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">Indexing</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-100 sm:text-3xl">{activity.recentIndexes}</p>
                  <p className="mt-1 text-xs text-surface-400">Total indexed reports</p>
                </div>
                <div className="group rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-4 transition-all hover:border-purple-500/40">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 transition-transform group-hover:scale-110 sm:h-10 sm:w-10"><BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" /></div>
                    <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400">AI</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-100 sm:text-3xl">{activity.totalAiQueries}</p>
                  <p className="mt-1 text-xs text-surface-400">Total AI operations performed</p>
                </div>
                <div className="group rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4 transition-all hover:border-amber-500/40">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 transition-transform group-hover:scale-110 sm:h-10 sm:w-10"><Star className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" /></div>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">Quality</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-100 sm:text-3xl">{activity.avgReviewScore}<span className="text-base text-surface-400 sm:text-lg">/100</span></p>
                  <p className="mt-1 text-xs text-surface-400">Average across all reviews</p>
                </div>
                <div className="group rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-4 transition-all hover:border-emerald-500/40">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 transition-transform group-hover:scale-110 sm:h-10 sm:w-10"><GitCommit className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" /></div>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Engagement</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-100 sm:text-3xl">{activity.activityScore.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-surface-400">Stars + forks + issues across all repos</p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
