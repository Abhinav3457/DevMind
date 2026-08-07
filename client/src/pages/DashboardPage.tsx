import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileCode, Clock, Activity,
  Github, Bot, Bug, FileText,
  TrendingUp, ChevronRight, Star,
  ArrowRight, Check, Zap as ZapIcon,
} from 'lucide-react';
import { StatCard } from '../components/dashboard/StatCard';
import { useAuthStore } from '../store';
import apiClient from '../api/axios';

interface AnalyticsOverview {
  repositories: number;
  indexedRepos: number;
  totalFiles: number;
  totalChunks: number;
  aiOperations: number;
  stars?: number;
  healthScore?: number;
}

interface DashboardStats {
  repositories: number;
  indexedRepos: number;
  indexedFiles: number;
  healthScore: number;
  aiOperations: number;
  stars: number;
  recentActivity: { type: string; description: string; timestamp: string }[];
}

const quickActions = [
  { to: '/github', label: 'Import Repository', icon: Github, color: 'purple', desc: 'Analyze your codebase' },
  { to: '/ai/agent', label: 'AI Agent', icon: Bot, color: 'green', desc: 'Autonomous coding tasks' },
  { to: '/ai/chat', label: 'AI Chat', icon: Bot, color: 'cyan', desc: 'Get coding assistance' },
  { to: '/ai/code-review', label: 'Code Review', icon: Bug, color: 'amber', desc: 'Review code quality' },
  { to: '/ai/docs', label: 'Documentation', icon: FileText, color: 'cyan', desc: 'Generate project docs' },
  { to: '/analytics', label: 'Analytics', icon: TrendingUp, color: 'indigo', desc: 'View detailed metrics' },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/* ── Onboarding Checklist ────────────────────────────────── */
function OnboardingChecklist({ stats }: { stats: DashboardStats }) {
  const steps = [
    { label: 'Connect GitHub', done: stats.repositories > 0, to: '/github' },
    { label: 'Import a repository', done: stats.indexedRepos > 0, to: '/github' },
    { label: 'Index your codebase', done: stats.indexedFiles > 0, to: '/github' },
    { label: 'Run a code review', done: false, to: '/ai/code-review' },
  ];
  const completed = steps.filter(s => s.done).length;
  if (completed === steps.length) return null;

  return (
    <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ZapIcon className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-surface-200">Get Started</h3>
        </div>
        <span className="text-[10px] font-medium text-surface-500">{completed}/{steps.length}</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-800 mb-3 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
          initial={{ width: 0 }}
          animate={{ width: `${(completed / steps.length) * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="space-y-1.5">
        {steps.map((step) => (
          <Link
            key={step.label}
            to={step.to}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-surface-800/50 group"
          >
            <div className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${
              step.done
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                : 'border-surface-600 text-surface-500 group-hover:border-primary-500/50 group-hover:text-primary-400'
            }`}>
              {step.done ? <Check className="h-3 w-3" /> : ''}
            </div>
            <span className={step.done ? 'text-surface-400 line-through' : 'text-surface-200'}>{step.label}</span>
            {!step.done && <ArrowRight className="ml-auto h-3 w-3 text-surface-600 group-hover:text-primary-400 transition-colors" />}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [analyticsRes, activityRes] = await Promise.all([
          apiClient.get('/analytics'),
          apiClient.get('/activity?limit=8'),
        ]);
        const overview: AnalyticsOverview = analyticsRes.data.data?.overview || {};
        const recentActivity = (activityRes.data.data?.activities || []).map(
          (a: { description: string; timestamp: string }) => ({
            type: 'event',
            description: a.description,
            timestamp: a.timestamp,
          }),
        );
        setStats({
          repositories: overview.repositories || 0,
          indexedRepos: overview.indexedRepos || 0,
          indexedFiles: overview.totalFiles || 0,
          healthScore: overview.healthScore || 0,
          aiOperations: overview.aiOperations || 0,
          stars: overview.stars || 0,
          recentActivity,
        });
      } catch {
        setStats({ repositories: 0, indexedRepos: 0, indexedFiles: 0, healthScore: 0, aiOperations: 0, stars: 0, recentActivity: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 sm:space-y-8"
    >
      {/* ── Hero / Welcome Section ─────────────────────────── */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-surface-700/30 bg-gradient-to-br from-surface-900/60 via-surface-900/30 to-surface-950/60 p-4 sm:p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-blue-500/10 blur-3xl hidden md:block" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl hidden md:block" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-blue-400">
              {greeting}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-surface-100">
            Welcome back,{' '}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent break-words">{user?.name || 'Developer'}</span>
          </h1>
          <p className="mt-2 max-w-xl text-xs sm:text-sm text-surface-400">
            Here&apos;s an overview of your development activity. Import repositories,
            analyze your code, or ask the AI for help.
          </p>
        </div>
      </motion.div>

      {/* ── Stat Cards ─────────────────────────────────────── */}
      {loading ? (
        <motion.div variants={item} className="grid gap-3 sm:gap-5 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 sm:h-36 animate-pulse rounded-xl sm:rounded-2xl bg-surface-800/50" />
          ))}
        </motion.div>
      ) : (
        <motion.div variants={item} className="grid gap-3 sm:gap-5 grid-cols-2 lg:grid-cols-4">
          <StatCard title="Repositories" value={stats?.repositories || 0} icon={Github} color="green" delay={0} />
          <StatCard title="Files Indexed" value={stats?.indexedFiles || 0} icon={FileCode} color="amber" delay={0.06} />
          <StatCard title="AI Operations" value={stats?.aiOperations || 0} icon={Bot} color="cyan" delay={0.12} />
          <StatCard title="Stars" value={stats?.stars || 0} icon={Star} color="purple" delay={0.18} />
        </motion.div>
      )}

      {/* ── Onboarding + Quick Actions ─────────────────────── */}
      {!loading && stats && (
        <motion.div variants={item} className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Onboarding Checklist */}
          <OnboardingChecklist stats={stats} />

          {/* Quick Actions */}
          <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <ZapIcon className="h-4 w-4 text-surface-400" />
              <h3 className="text-sm font-semibold text-surface-200">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {quickActions.map((action) => (
                <Link key={action.label} to={action.to}>
                  <div className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-800/50">
                    <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
                      action.color === 'purple' ? 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20' :
                      action.color === 'green' ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20' :
                      action.color === 'cyan' ? 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20' :
                      action.color === 'amber' ? 'bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20' :
                      action.color === 'blue' ? 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20' :
                      'bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20'
                    }`}>
                      <action.icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-medium text-surface-300 group-hover:text-surface-100 transition-colors">{action.label}</span>
                    <ChevronRight className="ml-auto h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Recent Activity ────────────────────────────────── */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-surface-400" />
            <h2 className="text-[10px] sm:text-sm font-semibold uppercase tracking-wider text-surface-400">Recent Activity</h2>
          </div>
          {stats && stats.recentActivity.length > 0 && (
            <Link to="/analytics" className="text-[10px] text-primary-400 hover:text-primary-300 transition-colors">View all</Link>
          )}
        </div>

        <div className="rounded-xl sm:rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5 backdrop-blur-sm">
          {stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <div className="space-y-1">
              {stats.recentActivity.map((activity, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-800/50"
                >
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-surface-800">
                    <Activity className="h-3.5 w-3.5 text-surface-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-surface-300 group-hover:text-surface-200">
                      {activity.description}
                    </p>
                    <p className="mt-0.5 text-xs text-surface-500">
                      {new Date(activity.timestamp).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-800/50">
                <Activity className="h-6 w-6 text-surface-500" />
              </div>
              <p className="text-sm font-medium text-surface-400">No recent activity</p>
              <p className="mt-1 max-w-[200px] text-xs text-surface-500">
                Start by importing a repository to see your activity here
              </p>
              <Link
                to="/github"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-primary-700 hover:shadow-lg hover:shadow-primary-500/20"
              >
                <Github className="h-3.5 w-3.5" />
                Import Repository
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
