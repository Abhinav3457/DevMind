import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  GitBranch,
  FileCode,
  Code2,
  Activity,
  Database,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { fetchAnalytics } from '../services/analytics';
import apiClient from '../api/axios';
import { StatCard } from '../components/dashboard/StatCard';
import { LanguageChart } from '../components/dashboard/LanguageChart';
import { HealthScore } from '../components/dashboard/HealthScore';
import { InteractiveBarChart } from '../components/dashboard/InteractiveBarChart';
import { ActivityTrendChart } from '../components/dashboard/ActivityTrendChart';
import { OperationBreakdown } from '../components/dashboard/OperationBreakdown';

interface RepoOption {
  id: string;
  repoName: string;
  fileCount: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/** Flat, neutral shell shared by every analytics panel. */
const panel = 'rounded-xl border border-surface-800 bg-surface-900/60 p-4 sm:p-5';

/* ── Panel heading: muted icon + micro title over a hairline ── */
function PanelHeading({
  icon: Icon,
  title,
  action,
}: {
  icon: typeof Code2;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 border-b border-surface-800 pb-3 sm:mb-5">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 flex-shrink-0 text-surface-500" />
        <h2 className="truncate text-xs font-semibold uppercase tracking-wider text-surface-300">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

/* ── Loading skeleton ───────────────────────────────────── */
function AnalyticsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-1 sm:space-y-6">
      <div className="flex animate-pulse items-center gap-3">
        <div className="space-y-2">
          <div className="h-4 w-44 rounded bg-surface-800" />
          <div className="h-3 w-64 rounded bg-surface-800/70" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-surface-800 bg-surface-900/60 sm:h-28"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-xl border border-surface-800 bg-surface-900/60"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-xl border border-surface-800 bg-surface-900/60"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl border border-surface-800 bg-surface-900/60" />
      <p className="text-center text-xs text-surface-500">Compiling your workspace metrics…</p>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────── */
const sum = (values: number[]) => values.reduce((acc, n) => acc + n, 0);

type TrendPill = { trend: 'up' | 'down' | 'neutral'; trendValue: string };

/** Compares the last 7 days of a series against the 7 days before it. */
function weeklyTrend(series: number[]): TrendPill | undefined {
  const recent = sum(series.slice(-7));
  const prior = sum(series.slice(-14, -7));
  if (recent === 0 && prior === 0) return undefined;
  const pct = prior === 0 ? 100 : Math.round(((recent - prior) / prior) * 100);
  if (pct > 0) return { trend: 'up', trendValue: `+${pct}% this week` };
  if (pct < 0) return { trend: 'down', trendValue: `${pct}% this week` };
  return { trend: 'neutral', trendValue: 'Flat this week' };
}

export function AnalyticsPage() {
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>(undefined);
  const [reports, setReports] = useState<RepoOption[]>([]);

  useEffect(() => {
    apiClient
      .get('/ai/repo-intelligence/reports')
      .then((res) => {
        const list = res.data.data?.reports || [];
        setReports(list);
        if (list.length > 0 && !selectedReportId) {
          setSelectedReportId(list[0].id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['analytics', selectedReportId],
    queryFn: () => fetchAnalytics(selectedReportId),
    staleTime: 0,
    refetchInterval: 30000,
  });

  /* ── Loading ────────────────────────────── */
  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  /* ── Error ──────────────────────────────── */
  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 text-center"
        >
          <p className="text-sm font-medium text-surface-200">Unable to load analytics</p>
          <p className="mt-1 text-xs text-surface-400">
            Please check your connection and try again
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-lg border border-surface-700 px-4 py-2 text-xs font-medium text-surface-200 transition-colors hover:border-surface-600 hover:text-surface-100"
          >
            Retry
          </button>
        </motion.div>
      </div>
    );
  }

  const { overview, languages, linesOfCode, repositoryHealth, trend, operationBreakdown } = data;

  const locBarData = linesOfCode.byLanguage.slice(0, 10).map((l) => ({
    label: l.language,
    value: l.lines,
    tooltip: `${l.language}: ${l.lines.toLocaleString()} lines`,
  }));

  const updatedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const reportSelect = reports.length > 0 && (
    <div className="relative">
      <select
        value={selectedReportId || ''}
        onChange={(e) => setSelectedReportId(e.target.value || undefined)}
        className="max-w-[190px] cursor-pointer appearance-none rounded-lg border border-surface-700/60 bg-surface-900 py-1.5 pl-3 pr-7 text-xs text-surface-300 transition-colors focus:border-surface-600 focus:outline-none sm:max-w-[260px]"
        aria-label="Select report"
      >
        <option value="">All Reports</option>
        {reports.map((r) => (
          <option key={r.id} value={r.id} className="truncate">
            {r.repoName} ({r.fileCount} files)
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-surface-500" />
    </div>
  );

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto pb-1 sm:space-y-6">
        {/* ── Header ───────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex flex-wrap items-end justify-between gap-3 border-b border-surface-800 pb-4"
        >
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-surface-100 sm:text-2xl">
              Analytics Dashboard
            </h1>
            <p className="mt-1 text-xs text-surface-400">
              Insights across your repositories and AI operations
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {updatedLabel && (
              <span className="hidden text-[11px] text-surface-500 sm:inline">
                Updated {updatedLabel}
              </span>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-700/60 px-3 py-1.5 text-xs font-medium text-surface-300 transition-colors hover:border-surface-600 hover:text-surface-100 disabled:opacity-50"
              aria-label="Refresh data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Refreshing' : 'Refresh'}
            </button>
            {reportSelect}
          </div>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          {/* ── KPI row ─────────────────────────── */}
          <motion.div variants={itemVariants} className="mb-5 sm:mb-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
              <StatCard
                title="Repositories"
                value={overview.repositories}
                icon={GitBranch}
                delay={0.05}
              />
              <StatCard
                title="Indexed Repos"
                value={overview.indexedRepos}
                icon={Database}
                delay={0.1}
                sparklineData={trend.indexes}
                {...weeklyTrend(trend.indexes)}
              />
              <StatCard
                title="Total Files"
                value={overview.totalFiles}
                icon={FileCode}
                delay={0.15}
              />
              <StatCard
                title="Total Chunks"
                value={overview.totalChunks}
                icon={Code2}
                delay={0.2}
              />
              <StatCard
                title="AI Operations"
                value={overview.aiOperations}
                icon={Activity}
                delay={0.25}
                sparklineData={trend.operations}
                {...weeklyTrend(trend.operations)}
              />
            </div>
          </motion.div>

          {/* ── Trend + operation mix ───────────── */}
          <div className="mb-5 grid grid-cols-1 gap-4 sm:mb-6 sm:gap-6 lg:grid-cols-3">
            <motion.div variants={itemVariants} className={`${panel} min-h-[380px] lg:col-span-2`}>
              <ActivityTrendChart trend={trend} />
            </motion.div>
            <motion.div variants={itemVariants} className={`${panel} min-h-[380px]`}>
              <OperationBreakdown operationBreakdown={operationBreakdown} />
            </motion.div>
          </div>

          {/* ── Language · Health ───────────────── */}
          <div className="mb-5 grid grid-cols-1 gap-4 sm:mb-6 sm:gap-6 lg:grid-cols-2">
            <motion.div
              variants={itemVariants}
              className={`${panel} min-h-[300px] sm:min-h-[340px]`}
            >
              <PanelHeading icon={Code2} title="Language Distribution" />
              <div className="h-full min-h-[220px] sm:min-h-[260px]">
                <LanguageChart languages={languages} />
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className={`${panel} min-h-[300px] sm:min-h-[340px]`}
            >
              <PanelHeading icon={Activity} title="Repository Health" />
              <div className="flex h-full min-h-[220px] items-center justify-center sm:min-h-[260px]">
                <HealthScore
                  score={repositoryHealth.score}
                  level={repositoryHealth.level}
                  metrics={repositoryHealth.metrics}
                />
              </div>
            </motion.div>
          </div>

          {/* ── Lines of code ───────────────────── */}
          <motion.div variants={itemVariants} className={`${panel} min-h-[300px] sm:min-h-[360px]`}>
            <PanelHeading icon={FileCode} title="Lines of Code by Language" />
            <div className="mb-4 rounded-lg border border-surface-800 bg-surface-900/60 p-4 sm:mb-5">
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-surface-100">
                {linesOfCode.total.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-surface-400">
                Estimated across {languages.length} languages and {overview.indexedRepos} indexed
                repos
              </p>
            </div>
            {locBarData.length > 0 ? (
              <div className="h-[200px] sm:h-[240px]">
                <InteractiveBarChart data={locBarData} height={200} />
              </div>
            ) : (
              <div className="flex h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-surface-800 text-center sm:h-[240px]">
                <p className="text-xs text-surface-400">No code indexed yet</p>
                <p className="mt-1 text-[11px] text-surface-500">
                  Import a repository to estimate its lines of code.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
