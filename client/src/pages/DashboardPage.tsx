import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Code2, GitBranch, FileCode, Clock, Activity,
  Sparkles, Github, Bot, Bug, FileText,
  TrendingUp, Zap, ChevronRight, Star,
  Database, ArrowRight, Check,
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

/* ── Mini Health Gauge ──────────────────────────────────── */
function MiniHealthGauge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return { stroke: '#34d399', text: 'text-emerald-400', label: 'Excellent', bg: 'bg-emerald-500/10' };
    if (s >= 60) return { stroke: '#60a5fa', text: 'text-blue-400', label: 'Good', bg: 'bg-blue-500/10' };
    if (s >= 40) return { stroke: '#fbbf24', text: 'text-amber-400', label: 'Fair', bg: 'bg-amber-500/10' };
    return { stroke: '#fb7185', text: 'text-rose-400', label: 'Poor', bg: 'bg-rose-500/10' };
  };
  const c = getColor(score);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16 flex-shrink-0">
        <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(var(--surface-700))" strokeWidth="5" />
          <motion.circle
            cx="32" cy="32" r={r}
            fill="none" stroke={c.stroke} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-sm font-bold ${c.text}`}>{score}</span>
        </div>
      </div>
      <div>
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${c.bg}`}>
          <div className={`h-1.5 w-1.5 rounded-full ${c.bg}`} style={{ backgroundColor: c.stroke }} />
          <span className={`text-[10px] font-semibold ${c.text}`}>{c.label}</span>
        </div>
        <p className="mt-1 text-[11px] text-surface-500">Codebase health</p>
      </div>
    </div>
  );
}

/* ── Onboarding Checklist ────────────────────────────────── */
function OnboardingChecklist({ stats }: { stats: DashboardStats }) {
  const steps = [
    { label: 'Connect GitHub', done: stats.repositories > 0, to: '/github', icon: Github },
    { label: 'Import a repository', done: stats.indexedRepos > 0, to: '/github', icon: Database },
    { label: 'Index your codebase', done: stats.indexedFiles > 0, to: '/github', icon: FileCode },
    { label: 'Run a code review', done: false, to: '/ai/code-review', icon: Bug },
  ];
  const completed = steps.filter(s => s.done).length;
  const allDone = completed === steps.length;

  if (allDone) return null;

  return (
    <motion.div variants={item} className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-surface-200">Get Started</h3>
        </div>
        <span className="text-[10px] font-medium text-surface-500">{completed}/{steps.length} completed</span>
      </div>
      {/* Progress bar */}
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
    </motion.div>
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
        {/* Decorative gradient blobs */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-blue-500/10 blur-3xl hidden md:block" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl hidden md:block" />

        <div className="relative z-10 flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-blue-400">
                {greeting}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-surface-100">
              Welcome back,{' '}
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent break-words">{user?.name || 'Developer'}</span>
            </h1>
            <p className="max-w-xl text-xs sm:text-sm text-surface-400">
              Here&apos;s an overview of your development activity. Import repositories,
              analyze your code, or ask the AI for help.
            </p>
          </div>

          {/* Quick summary chip */}
          <div className="flex shrink-0 items-center gap-3 rounded-xl sm:rounded-2xl border border-surface-700/50 bg-surface-800/50 px-3 sm:px-5 py-2 sm:py-3 backdrop-blur-sm self-start md:self-auto">
            <div className="flex -space-x-2">
              {[Code2, GitBranch, FileCode].map((Icon, i) => (
                <div key={i} className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 border-surface-800 bg-surface-700">
                  <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-surface-300" />
                </div>
              ))}
            </div>
            <div className="border-l border-surface-700 pl-2 sm:pl-3">
              <p className="text-[10px] sm:text-xs text-surface-400">
                <span className="font-semibold text-surface-200">{stats?.repositories || 0}</span> repositories
              </p>
            </div>
          </div>
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

      {/* ── Health Score + Onboarding ──────────────────────── */}
      {!loading && stats && (
        <motion.div variants={item} className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Health Score Card */}
          <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-surface-400" />
              <h3 className="text-sm font-semibold text-surface-200">Health Score</h3>
            </div>
            {stats.healthScore > 0 ? (
              <MiniHealthGauge score={stats.healthScore} />
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-surface-500">No health data yet</p>
                <Link to="/analytics" className="mt-2 inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors">
                  View Analytics <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>

          {/* Onboarding Checklist */}
          <OnboardingChecklist stats={stats} />

          {/* Quick Actions mini grid — fills remaining column */}
          <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-surface-400" />
              <h3 className="text-sm font-semibold text-surface-200">Quick Actions</h3>
            </div>
            <div className="space-y-1.5">
              {quickActions.slice(0, 4).map((action) => (
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

      {/* ── Lower section: Full Quick Actions + Activity ──── */}
      <motion.div variants={item} className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Full Quick Actions */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-surface-400" />
            <h2 className="text-[10px] sm:text-sm font-semibold uppercase tracking-wider text-surface-400">All Tools</h2>
          </div>

          <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action, i) => (
              <Link key={action.label} to={action.to}>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.04, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-surface-700/40 bg-surface-900/40 p-3 sm:p-4 backdrop-blur-sm transition-all duration-300 hover:border-surface-600/60 hover:bg-surface-800/40 hover:shadow-lg"
                >
                  {/* Hover accent bar */}
                  <div className="absolute inset-x-0 top-0 h-0.5 scale-x-0 bg-gradient-to-r from-blue-500 to-purple-500 transition-transform duration-300 group-hover:scale-x-100" />

                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className={
                        'flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-lg sm:rounded-xl transition-all duration-300 group-hover:scale-110 ' +
                        (action.color === 'blue' ? 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20' :
                         action.color === 'purple' ? 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20' :
                         action.color === 'green' ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20' :
                         action.color === 'amber' ? 'bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20' :
                         action.color === 'cyan' ? 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20' :
                         'bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20')
                      }>
                        <action.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-surface-200 transition-colors group-hover:text-surface-100 truncate">
                          {action.label}
                        </p>
                        <p className="mt-0.5 text-[10px] sm:text-xs text-surface-500 truncate">{action.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-3.5 w-3.5 sm:h-4 sm:w-4 text-surface-500 flex-shrink-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-surface-300" />
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
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
        </div>
      </motion.div>
    </motion.div>
  );
}
