import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileCode,
  Github, Bot, Bug, FileText,
  TrendingUp, Star, Sparkles, Activity,
} from 'lucide-react';
import { StatCard } from '../components/dashboard/StatCard';
import { TrendChart } from '../components/dashboard/TrendChart';
import { EfficiencyDonut } from '../components/dashboard/EfficiencyDonut';
import { PipelineActivity } from '../components/dashboard/PipelineActivity';
import { useAuthStore } from '../store';
import { fetchAnalytics } from '../services/analytics';
import { fetchAgentRuns } from '../services/agent';
import type { AnalyticsData, AgentRun } from '../types';

const quickActions = [
  { to: '/github', label: 'Import Repository', icon: Github, color: 'purple' },
  { to: '/ai/agent', label: 'AI Agent', icon: Bot, color: 'green' },
  { to: '/ai/chat', label: 'AI Chat', icon: Bot, color: 'cyan' },
  { to: '/ai/code-review', label: 'Code Review', icon: Bug, color: 'amber' },
  { to: '/ai/docs', label: 'Documentation', icon: FileText, color: 'cyan' },
  { to: '/analytics', label: 'Analytics', icon: TrendingUp, color: 'indigo' },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function DashboardPage() {
  const { user } = useAuthStore();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await fetchAnalytics();
        setAnalytics(data);
      } catch {
        setAnalytics(null);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();

    fetchAgentRuns()
      .then((list) => setRuns(list))
      .catch(() => { /* ignore */ })
      .finally(() => setLoadingRuns(false));
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const overview = analytics?.overview;
  const quality = analytics?.quality;
  const activity = analytics?.activity;

  // ── Code Quality Trend (real quality dimensions, normalized to 0-100) ──
  const trendData = useMemo(() => {
    if (!quality) return [];
    const security = quality.securityIssues === 0 ? 100 : Math.max(0, 100 - quality.securityIssues * 15);
    const stability = quality.bugCount === 0 ? 100 : Math.max(0, 100 - quality.bugCount * 10);
    return [
      { label: 'Security', value: security },
      { label: 'Stability', value: stability },
      { label: 'Review', value: quality.reviewScore },
      { label: 'Docs', value: quality.documentationCoverage },
    ];
  }, [quality]);

  // ── AI Efficiency donut (real activity mix) ──
  const donutSegments = useMemo(() => {
    if (!activity) return [];
    return [
      { label: 'AI Operations', value: activity.totalAiQueries, color: '#22d3ee' },
      { label: 'Indexing', value: activity.recentIndexes, color: '#3b82f6' },
      { label: 'Review Score', value: activity.avgReviewScore, color: '#a855f7' },
      { label: 'Engagement', value: activity.activityScore, color: '#64748b' },
    ];
  }, [activity]);

  // ── Dev Pipeline Activity (real proposed changes from agent runs) ──
  const suggestions = useMemo(() => {
    const out: { id: string; filePath: string; title: string; before: string; after: string }[] = [];
    for (const run of runs) {
      if (run.status !== 'completed' || !run.solution) continue;
      for (const [i, change] of run.solution.changes.slice(0, 2).entries()) {
        out.push({
          id: run.id + '-' + i + '-' + change.filePath,
          filePath: change.filePath,
          title: change.title,
          before: change.before,
          after: change.after,
        });
      }
      if (out.length >= 4) break;
    }
    return out;
  }, [runs]);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <motion.div variants={item}>
        <h1 className="text-xl sm:text-2xl font-bold text-gradient-brand">
          {greeting}, {user?.name || 'Developer'}
        </h1>
        <p className="mt-1 text-sm text-surface-400">
          A concise overview of your repositories, code quality, and AI activity.
        </p>
      </motion.div>

      {/* ── Stat Cards ─────────────────────────────────────── */}
      {loading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-800/50" />
          ))}
        </div>
      ) : (
        <motion.div variants={item} className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard title="Repositories" value={overview?.repositories || 0} icon={Github} color="green" delay={0} />
          <StatCard title="Files Indexed" value={overview?.totalFiles || 0} icon={FileCode} color="amber" delay={0.05} />
          <StatCard title="AI Operations" value={overview?.aiOperations || 0} icon={Bot} color="cyan" delay={0.1} />
          <StatCard title="Stars" value={activity?.activityScore || 0} icon={Star} color="purple" delay={0.15} />
        </motion.div>
      )}

      {/* ── Key Insights (left) + Quick Actions (right) ────── */}
      {!loading && (
        <motion.div variants={item} className="grid gap-4 lg:grid-cols-3">
          {/* Key Insights */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
                <Activity className="h-4 w-4 text-primary-400" />
              </div>
              <h2 className="text-sm font-semibold text-surface-200">Key Insights</h2>
            </div>

            {/* Code Quality Trend */}
            <div className="rounded-xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-surface-200">Code Quality Trend</h3>
                  <p className="text-[11px] text-surface-500">Security · Stability · Review · Documentation</p>
                </div>
                <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-medium text-blue-400">
                  <Sparkles className="h-3 w-3" /> Live
                </span>
              </div>
              <div className="rounded-lg bg-surface-950/40 p-3 sm:p-4">
                <TrendChart data={trendData} />
              </div>
            </div>

            {/* AI Efficiency */}
            <div className="rounded-xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-surface-200">AI Efficiency</h3>
                  <p className="text-[11px] text-surface-500">Distribution of AI operations across your pipeline</p>
                </div>
              </div>
              <EfficiencyDonut
                segments={donutSegments}
                centerLabel="AI Ops"
                centerValue={String(activity?.totalAiQueries ?? 0)}
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5 lg:self-start">
            <h2 className="mb-3 text-sm font-semibold text-surface-200">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {quickActions.map((action) => (
                <Link key={action.label} to={action.to}>
                  <div className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 transition-all duration-150 hover:bg-surface-800/60 hover:scale-[1.02] active:scale-[0.98]">
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
                      action.color === 'purple' ? 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20' :
                      action.color === 'green' ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20' :
                      action.color === 'cyan' ? 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20' :
                      action.color === 'amber' ? 'bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20' :
                      action.color === 'blue' ? 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20' :
                      'bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20'
                    }`}>
                      <action.icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium text-surface-300 group-hover:text-surface-100 transition-colors">{action.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Dev Pipeline Activity ──────────────────────────── */}
      {!loading && (
        <motion.div variants={item}>
          <PipelineActivity suggestions={suggestions} loading={loadingRuns} />
        </motion.div>
      )}
    </motion.div>
  );
}
