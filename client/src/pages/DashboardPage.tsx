import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Code2, GitBranch, Users, FileCode,  Clock, Activity,
  Sparkles, Github, Bot, Bug, FileText,
  Star, TrendingUp, Zap, ChevronRight,
} from 'lucide-react';
import { StatCard } from '../components/dashboard/StatCard';
import { useAuthStore } from '../store';
import apiClient from '../api/axios';

interface AnalyticsOverview {
  projects: number;
  workspaces: number;
  repositories: number;
  indexedRepos: number;
  totalFiles: number;
  totalChunks: number;
  aiOperations: number;
  stars?: number;
  healthScore?: number;
}

interface DashboardStats {
  projects: number;
  workspaces: number;
  repositories: number;
  indexedFiles: number;
  healthScore: number;
  stars: number;
  recentActivity: { type: string; description: string; timestamp: string }[];
}

const quickActions = [
  { to: '/workspace', label: 'Create Workspace', icon: Users, color: 'blue', desc: 'Collaborate with your team' },
  { to: '/github', label: 'Import Repository', icon: Github, color: 'purple', desc: 'Analyze your codebase' },
  { to: '/ai/chat', label: 'AI Chat', icon: Bot, color: 'green', desc: 'Get coding assistance' },
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

export function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [analyticsRes, workspacesRes] = await Promise.all([
          apiClient.get('/analytics'),
          apiClient.get('/workspaces?limit=1'),
        ]);
        const overview: AnalyticsOverview = analyticsRes.data.data?.overview || {};
        setStats({
          projects: overview.projects || 0,
          workspaces: overview.workspaces || workspacesRes.data.meta?.pagination?.total || 0,
          repositories: overview.repositories || 0,
          indexedFiles: overview.totalFiles || 0,
          healthScore: overview.healthScore || 0,
          stars: overview.stars || 0,
          recentActivity: [],
        });
      } catch {
        setStats({ projects: 0, workspaces: 0, repositories: 0, indexedFiles: 0, healthScore: 0, stars: 0, recentActivity: [] });
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
      className="space-y-8"
    >
      {/* ── Hero / Welcome Section ─────────────────────────── */}
      <motion.div variants={item} className="relative overflow-hidden rounded-3xl border border-surface-700/30 bg-gradient-to-br from-surface-900/60 via-surface-900/30 to-surface-950/60 p-8">
        {/* Decorative gradient blobs */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                {greeting}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-surface-100 sm:text-4xl">
              Welcome back, <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{user?.name || 'Developer'}</span>
            </h1>
            <p className="max-w-xl text-sm text-surface-400">
              Here's an overview of your development workspace. Start by exploring your projects,
              importing repositories, or asking the AI for help.
            </p>
          </div>

          {/* Quick summary chip */}
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-surface-700/50 bg-surface-800/50 px-5 py-3 backdrop-blur-sm">
            <div className="flex -space-x-2">
              {[Code2, GitBranch, FileCode].map((Icon, i) => (
                <div key={i} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-800 bg-surface-700">
                  <Icon className="h-3.5 w-3.5 text-surface-300" />
                </div>
              ))}
            </div>
            <div className="border-l border-surface-700 pl-3">
              <p className="text-xs text-surface-400">
                <span className="font-semibold text-surface-200">{stats?.projects || 0}</span> projects
                {' · '}
                <span className="font-semibold text-surface-200">{stats?.repositories || 0}</span> repos
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Stat Cards ─────────────────────────────────────── */}
      {loading ? (
        <motion.div variants={item} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-surface-800/50" />
          ))}
        </motion.div>
      ) : (
        <motion.div variants={item} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Projects" value={stats?.projects || 0} icon={Code2} color="blue" delay={0} />
          <StatCard title="Workspaces" value={stats?.workspaces || 0} icon={Users} color="purple" delay={0.06} />
          <StatCard title="Repositories" value={stats?.repositories || 0} icon={Github} color="green" delay={0.12} />
          <StatCard title="Files Indexed" value={stats?.indexedFiles || 0} icon={FileCode} color="amber" delay={0.18} />
        </motion.div>
      )}

      {/* ── Lower section: Quick Actions + Activity ────────── */}
      <motion.div variants={item} className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-surface-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-surface-400">Quick Actions</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action, i) => (
              <Link key={action.label} to={action.to}>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.04, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="group relative overflow-hidden rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 backdrop-blur-sm transition-all duration-300 hover:border-surface-600/60 hover:bg-surface-800/40 hover:shadow-lg"
                >
                  {/* Hover accent bar */}
                  <div className="absolute inset-x-0 top-0 h-0.5 scale-x-0 bg-gradient-to-r from-blue-500 to-purple-500 transition-transform duration-300 group-hover:scale-x-100" />

                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={
                        'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 ' +
                        (action.color === 'blue' ? 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20' :
                         action.color === 'purple' ? 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20' :
                         action.color === 'green' ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20' :
                         action.color === 'amber' ? 'bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20' :
                         action.color === 'cyan' ? 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20' :
                         'bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20')
                      }>
                        <action.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-surface-200 transition-colors group-hover:text-surface-100">
                          {action.label}
                        </p>
                        <p className="mt-0.5 text-xs text-surface-500">{action.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 text-surface-500 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-surface-300" />
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-surface-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-surface-400">Activity</h2>
          </div>

          <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-5 backdrop-blur-sm">
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
                  Start by creating a workspace or importing a repository
                </p>
                <Link
                  to="/workspace"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-surface-800 px-4 py-2 text-xs font-medium text-surface-200 transition-all hover:bg-surface-700 hover:text-surface-100"
                >
                  <Star className="h-3.5 w-3.5" />
                  Create Workspace
                </Link>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
