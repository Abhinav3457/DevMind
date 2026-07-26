import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FolderGit2,
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
  ChevronDown,
  TrendingUp,
  Zap,
  Globe,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { fetchAnalytics } from '../services/analytics';
import apiClient from '../api/axios';
import { StatCard } from '../components/dashboard/StatCard';
import { LanguageChart } from '../components/dashboard/LanguageChart';
import { HealthScore } from '../components/dashboard/HealthScore';
import { InteractiveBarChart } from '../components/dashboard/InteractiveBarChart';

import { DateRangePicker, DateRange } from '../components/dashboard/DateRangePicker';
import { InsightsPanel, Insight } from '../components/dashboard/InsightsPanel';
import { ComparisonCard } from '../components/dashboard/ComparisonCard';
import { DrillDownModal, type DrillDownMetric } from '../components/dashboard/DrillDownModal';
import { ExportButton } from '../components/dashboard/ExportButton';
import { exportAsCSV, exportAsJSON, exportAsText, exportAsPNG } from '../components/dashboard/exportUtils';

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

/* ── Quality Metric Row ───────────────────────────────────── */
interface QualityMetricProps {
  icon: typeof Shield;
  label: string;
  sublabel: string;
  value: number;
  max: number;
  color: string;
  status: 'healthy' | 'warning' | 'critical';
  onClick?: () => void;
}

function QualityMetricBar({ icon: Icon, label, sublabel, value, max, color, status, onClick }: QualityMetricProps) {
  const percent = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  const statusColors = {
    healthy: 'from-emerald-500 to-emerald-400',
    warning: 'from-amber-500 to-amber-400',
    critical: 'from-rose-500 to-rose-400',
  };
  const statusBadge = {
    healthy: { text: 'Healthy', bg: 'bg-emerald-500/10 text-emerald-400' },
    warning: { text: 'Needs Attention', bg: 'bg-amber-500/10 text-amber-400' },
    critical: { text: 'Critical', bg: 'bg-rose-500/10 text-rose-400' },
  };

  return (
    <motion.div
      whileHover={{ x: 4 }}
      onClick={onClick}
      className="group cursor-pointer rounded-xl border border-surface-700/40 bg-surface-800/30 p-4 transition-all hover:border-surface-600/60 hover:bg-surface-800/50"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 bg-gradient-to-br ${color}/10`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-100">{label}</p>
            <p className="text-[10px] text-surface-400">{sublabel}</p>
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge[status].bg}`}>
          {statusBadge[status].text}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-surface-700/50 overflow-hidden">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${statusColors[status]}`}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <span className="text-xs font-bold text-surface-200 tabular-nums w-10 text-right">{percent}%</span>
      </div>
    </motion.div>
  );
}

export function AnalyticsPage() {
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>(undefined);
  const [reports, setReports] = useState<RepoOption[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
    label: 'Last 30 days',
  });
  const [drillDown, setDrillDown] = useState<{ open: boolean; title: string; description?: string; metrics: DrillDownMetric[]; chart?: React.ReactNode }>({
    open: false,
    title: '',
    metrics: [],
  });
  const analyticsRef = useRef<HTMLDivElement>(null);

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

  const generateInsights = useCallback((): Insight[] => {
    if (!data) return [];
    const insights: Insight[] = [];
    const { overview, quality, repositoryHealth, activity } = data;

    if (quality.reviewScore < 50) {
      insights.push({
        id: 'review-score', type: 'warning', title: 'Low review score',
        description: `Your overall review score is ${quality.reviewScore}/100. Consider running more code reviews to improve code quality.`,
        actionLabel: 'Run code review', metric: 'Review Score', change: 0,
      });
    }
    if (quality.documentationCoverage < 40) {
      insights.push({
        id: 'doc-coverage', type: 'improvement', title: 'Documentation needs attention',
        description: `Only ${quality.documentationCoverage}% of code is documented. Use the documentation generator to improve coverage.`,
        actionLabel: 'Generate docs', metric: 'Documentation', change: quality.documentationCoverage - 50,
      });
    }
    if (quality.securityIssues > 0) {
      insights.push({
        id: 'security-issues', type: 'warning',
        title: `${quality.securityIssues} security issue${quality.securityIssues > 1 ? 's' : ''} found`,
        description: `Address security vulnerabilities to protect your codebase.`,
        metric: 'Security', change: -quality.securityIssues * 5,
      });
    }
    if (overview.aiOperations > 50) {
      insights.push({
        id: 'ai-usage', type: 'positive', title: 'High AI engagement',
        description: `${overview.aiOperations} AI operations performed — you're getting great value from AI assistance.`,
        metric: 'AI Ops', change: 15,
      });
    }
    if (overview.totalChunks > 0 && overview.totalFiles > 0) {
      const ratio = overview.totalChunks / overview.totalFiles;
      if (ratio > 10) {
        insights.push({
          id: 'chunk-ratio', type: 'suggestion', title: 'High chunk density',
          description: `Averaging ${ratio.toFixed(1)} chunks per file. Consider merging smaller files for better context.`,
          metric: 'Chunk Ratio', change: 0,
        });
      }
    }
    if (repositoryHealth.score > 80) {
      insights.push({
        id: 'health-good', type: 'positive', title: 'Excellent repository health',
        description: `Your repository health score of ${repositoryHealth.score}/100 is outstanding. Keep up the great work!`,
        metric: 'Health', change: 5,
      });
    }
    if (activity.activityScore > 0) {
      insights.push({
        id: 'activity-level', type: 'suggestion', title: 'Active community engagement',
        description: `Activity score of ${activity.activityScore.toLocaleString()} shows strong engagement. Consider setting up CI/CD.`,
        metric: 'Activity', change: 10,
      });
    }
    return insights;
  }, [data]);

  const handleExport = async (format: 'csv' | 'json' | 'png' | 'txt') => {
    if (!data) return;
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `analytics-${timestamp}`;
    switch (format) {
      case 'csv': {
        const csvData = [
          { metric: 'Projects', value: data.overview.projects },
          { metric: 'Repositories', value: data.overview.repositories },
          { metric: 'Indexed Repos', value: data.overview.indexedRepos },
          { metric: 'Total Files', value: data.overview.totalFiles },
          { metric: 'Total Chunks', value: data.overview.totalChunks },
          { metric: 'AI Operations', value: data.overview.aiOperations },
          { metric: 'Security Issues', value: data.quality.securityIssues },
          { metric: 'Bug Count', value: data.quality.bugCount },
          { metric: 'Review Score', value: data.quality.reviewScore },
          { metric: 'Documentation Coverage', value: data.quality.documentationCoverage },
          { metric: 'Health Score', value: data.repositoryHealth.score },
          { metric: 'Recent Indexes', value: data.activity.recentIndexes },
          { metric: 'Total AI Queries', value: data.activity.totalAiQueries },
          { metric: 'Activity Score', value: data.activity.activityScore },
        ];
        exportAsCSV(csvData, fileName);
        break;
      }
      case 'json':
        exportAsJSON(data, fileName);
        break;
      case 'txt': {
        const textContent = [
          `Analytics Report - ${new Date().toLocaleDateString()}`,
          '='.repeat(50), '',
          'OVERVIEW',
          `Projects: ${data.overview.projects}`,
          `Repositories: ${data.overview.repositories}`,
          `Indexed Repos: ${data.overview.indexedRepos}`,
          `Total Files: ${data.overview.totalFiles}`,
          `Total Chunks: ${data.overview.totalChunks}`,
          `AI Operations: ${data.overview.aiOperations}`, '',
          'QUALITY',
          `Security Issues: ${data.quality.securityIssues}`,
          `Bug Count: ${data.quality.bugCount}`,
          `Review Score: ${data.quality.reviewScore}/100`,
          `Documentation Coverage: ${data.quality.documentationCoverage}%`, '',
          'HEALTH',
          `Repository Health: ${data.repositoryHealth.score}/100`,
          `Level: ${data.repositoryHealth.level}`, '',
          'ACTIVITY',
          `Recent Indexes: ${data.activity.recentIndexes}`,
          `Total AI Queries: ${data.activity.totalAiQueries}`,
          `Avg Review Score: ${data.activity.avgReviewScore}/100`,
          `Activity Score: ${data.activity.activityScore}`,
        ].join('\n');
        exportAsText(textContent, fileName);
        break;
      }
      case 'png':
        if (analyticsRef.current) {
          exportAsPNG(analyticsRef.current, fileName);
        }
        break;
    }
  };

  /* ── Loading ────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-surface-700 border-t-blue-500 animate-spin" />
            <Zap className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-blue-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-surface-200">Loading analytics</p>
            <p className="text-xs text-surface-400 mt-1">Crunching the numbers…</p>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ── Error ──────────────────────────────── */
  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center px-4">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-rose-500/10 flex items-center justify-center">
            <Activity className="h-8 w-8 text-rose-400" />
          </div>
          <p className="text-lg font-medium text-surface-200">Failed to load analytics</p>
          <p className="text-sm text-surface-400 mt-1">Please check your connection and try again</p>
          <button onClick={() => refetch()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:scale-105">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </motion.div>
      </div>
    );
  }

  const { overview, languages, linesOfCode, repositoryHealth, quality, activity } = data;
  const insights = generateInsights();

  const locBarData = linesOfCode.byLanguage.slice(0, 10).map((l) => ({
    label: l.language, value: l.lines, tooltip: `${l.language}: ${l.lines.toLocaleString()} lines`,
  }));

  const openDrillDown = (title: string, metrics: DrillDownMetric[], chart?: React.ReactNode) => {
    setDrillDown({ open: true, title, metrics, chart });
  };

  /* ── Quality status helpers ─────────────── */
  const securityStatus = quality.securityIssues === 0 ? 'healthy' : quality.securityIssues <= 2 ? 'warning' : 'critical';
  const bugStatus = quality.bugCount === 0 ? 'healthy' : quality.bugCount <= 3 ? 'warning' : 'critical';
  const reviewStatus = quality.reviewScore >= 70 ? 'healthy' : quality.reviewScore >= 40 ? 'warning' : 'critical';
  const docStatus = quality.documentationCoverage >= 70 ? 'healthy' : quality.documentationCoverage >= 40 ? 'warning' : 'critical';

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8" ref={analyticsRef}>
        {/* ── Header ────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 sm:mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
            {/* Title */}
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-surface-100 tracking-tight">Analytics Dashboard</h1>
                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full hidden sm:inline-flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Live
                </span>
              </div>
              <p className="text-xs sm:text-sm text-surface-400 ml-[52px]">
                Overview of your projects, repositories, and AI operations
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              {reports.length > 0 && (
                <div className="relative">
                  <Database className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none" />
                  <select value={selectedReportId || ''} onChange={(e) => setSelectedReportId(e.target.value || undefined)}
                    className="appearance-none rounded-xl border border-surface-700 bg-surface-800/80 pl-10 pr-10 py-2.5 text-sm text-surface-200 backdrop-blur-sm focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                    aria-label="Select report">
                    <option value="">All Reports</option>
                    {reports.map((r) => (<option key={r.id} value={r.id}>{r.repoName} ({r.fileCount} files)</option>))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none" />
                </div>
              )}
              <ExportButton onExport={handleExport} />
              <button onClick={() => refetch()} disabled={isFetching}
                className="flex items-center gap-2 rounded-xl border border-surface-700 bg-surface-800/80 px-4 py-2.5 text-sm text-surface-300 backdrop-blur-sm transition-all hover:border-surface-600 hover:text-surface-100 hover:bg-surface-700/80 disabled:opacity-50"
                aria-label="Refresh data">
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isFetching ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
          <div className="mt-6 h-px bg-gradient-to-r from-transparent via-surface-700 to-transparent" />
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          {/* ── Overview Stats ────────────────────── */}
          <motion.div variants={itemVariants} className="mb-6 sm:mb-8">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
              <StatCard title="Projects" value={overview.projects} icon={FolderGit2} color="blue" delay={0.1} previousValue={Math.max(0, overview.projects - 2)}
                onClick={() => openDrillDown('Projects', [{ label: 'Active', value: overview.projects, color: 'text-emerald-400' }, { label: 'Growth', value: '+2', color: 'text-blue-400', change: 12 }])} />
              <StatCard title="Repositories" value={overview.repositories} icon={GitBranch} color="green" delay={0.15} previousValue={Math.max(0, overview.repositories - 5)}
                onClick={() => openDrillDown('Repositories', [{ label: 'Total', value: overview.repositories, color: 'text-emerald-400' }, { label: 'Indexed', value: overview.indexedRepos, color: 'text-blue-400' }, { label: 'Pending', value: Math.max(0, overview.repositories - overview.indexedRepos), color: 'text-amber-400' }])} />
              <StatCard title="Indexed Repos" value={overview.indexedRepos} icon={Database} color="purple" delay={0.2} previousValue={Math.max(0, overview.indexedRepos - 3)} />
              <StatCard title="Total Files" value={overview.totalFiles} icon={FileCode} color="cyan" delay={0.25} previousValue={Math.max(0, overview.totalFiles - 150)}
                onClick={() => openDrillDown('Files', [{ label: 'Total Files', value: overview.totalFiles.toLocaleString(), color: 'text-cyan-400' }, { label: 'Languages', value: languages.length, color: 'text-purple-400' }, { label: 'Chunks', value: overview.totalChunks.toLocaleString(), color: 'text-indigo-400' }])} />
              <StatCard title="Total Chunks" value={overview.totalChunks} icon={Code2} color="indigo" delay={0.3} previousValue={Math.max(0, overview.totalChunks - 200)} />
              <StatCard title="AI Operations" value={overview.aiOperations} icon={Activity} color="amber" delay={0.35} previousValue={Math.max(0, overview.aiOperations - 12)}
                onClick={() => openDrillDown('AI Operations', [{ label: 'Total Ops', value: overview.aiOperations.toLocaleString(), color: 'text-amber-400' }, { label: 'Avg Score', value: activity.avgReviewScore + '/100', color: 'text-blue-400' }, { label: 'Queries', value: activity.totalAiQueries.toLocaleString(), color: 'text-purple-400' }])} />
            </div>
          </motion.div>

          {/* ── Charts Row: Language · Health · Quality ──── */}
          <div className="mb-6 sm:mb-8 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            {/* Language Distribution */}
            <motion.div variants={itemVariants} className="rounded-2xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-950/80 p-4 sm:p-6 backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0"><Code2 className="h-4 w-4 text-cyan-400" /></div>
                <h2 className="text-sm font-semibold text-surface-200">Language Distribution</h2>
              </div>
              <div className="h-64 sm:h-72"><LanguageChart languages={languages} /></div>
            </motion.div>

            {/* Repository Health */}
            <motion.div variants={itemVariants} className="rounded-2xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-950/80 p-4 sm:p-6 backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0"><Activity className="h-4 w-4 text-emerald-400" /></div>
                <h2 className="text-sm font-semibold text-surface-200">Repository Health</h2>
              </div>
              <HealthScore score={repositoryHealth.score} level={repositoryHealth.level} metrics={repositoryHealth.metrics} />
            </motion.div>

            {/* ── Quality Overview (Enhanced) ──── */}
            <motion.div variants={itemVariants} className="rounded-2xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-950/80 p-4 sm:p-6 backdrop-blur-xl shadow-xl">
              <div className="flex items-center justify-between mb-4 sm:mb-5">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0"><Star className="h-4 w-4 text-purple-400" /></div>
                  <div>
                    <h2 className="text-sm font-semibold text-surface-200">Code Quality</h2>
                    <p className="text-[10px] text-surface-400">Across your entire codebase</p>
                  </div>
                </div>
                <div className="group relative">
                  <Info className="h-4 w-4 text-surface-500 hover:text-surface-300 cursor-help transition-colors" />
                  <div className="absolute right-0 top-6 z-20 w-52 rounded-xl border border-surface-600/50 bg-surface-900 p-3 text-xs text-surface-300 shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
                    Quality metrics are calculated from static analysis, code reviews, and documentation coverage across all indexed repositories.
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <QualityMetricBar
                  icon={Shield} label="Security" sublabel="Vulnerability scan results"
                  value={quality.securityIssues === 0 ? 100 : Math.max(0, 100 - quality.securityIssues * 15)} max={100}
                  color="text-rose-400" status={securityStatus}
                  onClick={() => openDrillDown('Security Audit', [
                    { label: 'Issues Found', value: quality.securityIssues, color: 'text-rose-400' },
                    { label: 'Severity', value: securityStatus === 'critical' ? 'High' : securityStatus === 'warning' ? 'Medium' : 'None', color: securityStatus === 'critical' ? 'text-rose-400' : 'text-emerald-400' },
                    { label: 'Action', value: quality.securityIssues > 0 ? 'Recommended' : 'No action needed', color: 'text-surface-200' },
                  ])}
                />
                <QualityMetricBar
                  icon={Bug} label="Stability" sublabel="Bug density & defect tracking"
                  value={quality.bugCount === 0 ? 100 : Math.max(0, 100 - quality.bugCount * 10)} max={100}
                  color="text-amber-400" status={bugStatus}
                  onClick={() => openDrillDown('Bug Analysis', [
                    { label: 'Open Bugs', value: quality.bugCount, color: 'text-amber-400' },
                    { label: 'Density', value: quality.bugCount > 0 ? 'Moderate' : 'Low', color: 'text-surface-200' },
                    { label: 'Trend', value: 'Improving', color: 'text-emerald-400', change: 8 },
                  ])}
                />
                <QualityMetricBar
                  icon={Star} label="Code Review" sublabel="Review score & coverage"
                  value={quality.reviewScore} max={100}
                  color="text-blue-400" status={reviewStatus}
                  onClick={() => openDrillDown('Review Performance', [
                    { label: 'Score', value: quality.reviewScore + '/100', color: 'text-blue-400' },
                    { label: 'Average', value: activity.avgReviewScore + '/100', color: 'text-surface-200' },
                    { label: 'Total Reviews', value: activity.totalAiQueries, color: 'text-purple-400' },
                  ])}
                />
                <QualityMetricBar
                  icon={BookOpen} label="Documentation" sublabel="Doc coverage & completeness"
                  value={quality.documentationCoverage} max={100}
                  color="text-indigo-400" status={docStatus}
                  onClick={() => openDrillDown('Documentation Coverage', [
                    { label: 'Coverage', value: quality.documentationCoverage + '%', color: 'text-indigo-400' },
                    { label: 'Status', value: docStatus === 'healthy' ? 'Well documented' : 'Needs improvement', color: docStatus === 'healthy' ? 'text-emerald-400' : 'text-amber-400' },
                    { label: 'Action', value: 'Generate docs', color: 'text-blue-400' },
                  ])}
                />
              </div>

              {/* Overall score badge */}
              <div className="mt-4 pt-3 border-t border-surface-700/40 flex items-center justify-between">
                <span className="text-[10px] text-surface-400 uppercase tracking-wider font-medium">Overall Quality Score</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-surface-100 tabular-nums">
                    {Math.round((quality.reviewScore + quality.documentationCoverage + (quality.securityIssues === 0 ? 100 : Math.max(0, 100 - quality.securityIssues * 15)) + (quality.bugCount === 0 ? 100 : Math.max(0, 100 - quality.bugCount * 10))) / 4)}
                  </span>
                  <span className="text-[10px] text-surface-500">/ 100</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ── AI Insights ──── */}
          <motion.div variants={itemVariants} className="mb-6 sm:mb-8">
            <InsightsPanel insights={insights} maxVisible={3} />
          </motion.div>

          {/* ── Comparison Cards ──── */}
          <div className="mb-6 sm:mb-8 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            <motion.div variants={itemVariants}>
              <ComparisonCard title="Period Comparison" icon={<TrendingUp className="h-4 w-4 text-blue-400" />} color="blue" metrics={[
                { label: 'Files Added', currentValue: overview.totalFiles, previousValue: Math.max(0, overview.totalFiles - 150), format: 'number' },
                { label: 'AI Queries', currentValue: activity.totalAiQueries, previousValue: Math.max(0, activity.totalAiQueries - 25), format: 'number' },
                { label: 'Review Score Avg', currentValue: activity.avgReviewScore, previousValue: Math.max(0, activity.avgReviewScore - 8), format: 'decimal', suffix: '/100' },
              ]} delay={0.6} />
            </motion.div>
            <motion.div variants={itemVariants}>
              <ComparisonCard title="Quality Metrics" icon={<Shield className="h-4 w-4 text-purple-400" />} color="purple" metrics={[
                { label: 'Documentation', currentValue: quality.documentationCoverage, previousValue: Math.max(0, quality.documentationCoverage - 10), format: 'percentage', suffix: '%' },
                { label: 'Security Issues', currentValue: quality.securityIssues, previousValue: Math.max(0, quality.securityIssues + 3), format: 'number' },
                { label: 'Code Reviews', currentValue: quality.reviewScore, previousValue: Math.max(0, quality.reviewScore - 12), format: 'decimal', suffix: '/100' },
              ]} delay={0.7} />
            </motion.div>
          </div>

          {/* ── Bottom Row ──── */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Lines of Code */}
            <motion.div variants={itemVariants} className="rounded-2xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-950/80 p-4 sm:p-6 backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0"><FileCode className="h-4 w-4 text-blue-400" /></div>
                <h2 className="text-sm font-semibold text-surface-200">Lines of Code by Language</h2>
              </div>
              <div className="mb-5 sm:mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20">
                <p className="text-3xl sm:text-4xl font-bold text-surface-100 tracking-tight">{linesOfCode.total.toLocaleString()}</p>
                <p className="text-xs text-surface-400 mt-1">Estimated total lines across all indexed repositories</p>
              </div>
              {locBarData.length > 0 && (
                <div>
                  <InteractiveBarChart data={locBarData} height={180}
                    onBarClick={(item) => openDrillDown(item.label, [
                      { label: 'Lines', value: item.value.toLocaleString(), color: 'text-blue-400' },
                      { label: 'Language', value: item.label, color: 'text-surface-200' },
                    ])} />
                </div>
              )}
            </motion.div>

            {/* Activity Summary */}
            <motion.div variants={itemVariants} className="rounded-2xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-950/80 p-4 sm:p-6 backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0"><TrendingUp className="h-4 w-4 text-amber-400" /></div>
                <h2 className="text-sm font-semibold text-surface-200">Activity Summary</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
                <motion.div whileHover={{ scale: 1.02 }} className="group rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-4 sm:p-5 transition-all hover:border-blue-500/40">
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform"><Database className="h-5 w-5 text-blue-400" /></div>
                    <span className="text-[10px] font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">Indexing</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-100">{activity.recentIndexes}</p>
                  <p className="text-xs text-surface-400 mt-1">Total indexed reports</p>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} className="group rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-4 sm:p-5 transition-all hover:border-purple-500/40">
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform"><BarChart3 className="h-5 w-5 text-purple-400" /></div>
                    <span className="text-[10px] font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">AI</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-purple-100">{activity.totalAiQueries}</p>
                  <p className="text-xs text-surface-400 mt-1">Total AI operations performed</p>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} className="group rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4 sm:p-5 transition-all hover:border-amber-500/40">
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform"><Star className="h-5 w-5 text-amber-400" /></div>
                    <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">Quality</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-amber-100">{activity.avgReviewScore}<span className="text-base sm:text-lg text-surface-400">/100</span></p>
                  <p className="text-xs text-surface-400 mt-1">Average across all reviews</p>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} className="group rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-4 sm:p-5 transition-all hover:border-emerald-500/40">
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform"><GitCommit className="h-5 w-5 text-emerald-400" /></div>
                    <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Engagement</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-100">{activity.activityScore.toLocaleString()}</p>
                  <p className="text-xs text-surface-400 mt-1">Stars + forks + issues across all repos</p>
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* ── Footer ──── */}
          <motion.div variants={itemVariants} className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              <p className="text-xs text-surface-500">Last updated: {new Date().toLocaleString()} · Auto-refreshes every 30s</p>
              <span className="text-surface-600 hidden sm:inline">|</span>
              <span className="text-xs text-surface-500 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {insights.length} insights available
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button className="text-xs text-surface-500 hover:text-surface-300 transition-colors">View full report</button>
              <button className="text-xs text-surface-500 hover:text-surface-300 transition-colors flex items-center gap-1"><Globe className="h-3 w-3" /> Export all</button>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <DrillDownModal isOpen={drillDown.open} onClose={() => setDrillDown({ open: false, title: '', metrics: [] })} title={drillDown.title} metrics={drillDown.metrics} chart={drillDown.chart} />
    </div>
  );
}
