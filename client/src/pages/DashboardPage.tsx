import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Code2, GitBranch, Users, FileCode, ArrowRight, Clock, Activity } from 'lucide-react';
import { StatCard } from '../components/dashboard/StatCard';
import apiClient from '../api/axios';

interface AnalyticsOverview {
  projects: number;
  workspaces: number;
  repositories: number;
  indexedRepos: number;
  totalFiles: number;
  totalChunks: number;
  aiOperations: number;
}

interface DashboardStats {
  projects: number;
  workspaces: number;
  repositories: number;
  indexedFiles: number;
  recentActivity: { type: string; description: string; timestamp: string }[];
}

export function DashboardPage() {
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
          recentActivity: [],
        });
      } catch {
        setStats({ projects: 0, workspaces: 0, repositories: 0, indexedFiles: 0, recentActivity: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const quickActions = [
    { to: '/workspace', label: 'Create Workspace', icon: Users, color: 'blue' },
    { to: '/github', label: 'Import Repository', icon: GitBranch, color: 'purple' },
    { to: '/ai/chat', label: 'Ask AI', icon: Code2, color: 'green' },
    { to: '/ai/code-review', label: 'Review Code', icon: Activity, color: 'amber' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Overview of your development workspace</p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-800" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Projects" value={stats?.projects || 0} icon={Code2} color="blue" delay={0} />
          <StatCard title="Workspaces" value={stats?.workspaces || 0} icon={Users} color="purple" delay={0.1} />
          <StatCard title="Repositories" value={stats?.repositories || 0} icon={GitBranch} color="green" delay={0.2} />
          <StatCard title="Files Indexed" value={stats?.indexedFiles || 0} icon={FileCode} color="amber" delay={0.3} />
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-200">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, i) => (
            <Link key={action.label} to={action.to}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="group flex items-center justify-between rounded-xl border border-surface-800 bg-surface-900/50 p-4 backdrop-blur-sm transition-all hover:border-primary-500/30 hover:bg-surface-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className={
                    'flex h-10 w-10 items-center justify-center rounded-lg ' +
                    (action.color === 'blue' ? 'bg-blue-500/10 text-blue-400' :
                     action.color === 'purple' ? 'bg-purple-500/10 text-purple-400' :
                     action.color === 'green' ? 'bg-emerald-500/10 text-emerald-400' :
                     'bg-amber-500/10 text-amber-400')
                  }>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-gray-300 group-hover:text-gray-200">{action.label}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-600 transition-all group-hover:translate-x-0.5 group-hover:text-primary-400" />
              </motion.div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5 backdrop-blur-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-200">
          <Clock className="h-4 w-4 text-gray-500" />
          Recent Activity
        </h2>
        {stats?.recentActivity && stats.recentActivity.length > 0 ? (
          <div className="space-y-3">
            {stats.recentActivity.map((activity, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-surface-800/50 px-4 py-3">
                <Activity className="h-4 w-4 text-primary-400" />
                <p className="flex-1 text-sm text-gray-400">{activity.description}</p>
                <span className="text-xs text-gray-600">{new Date(activity.timestamp).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-12 text-center">
            <Activity className="mb-3 h-8 w-8 text-gray-700" />
            <p className="text-sm text-gray-500">No recent activity</p>
            <p className="text-xs text-gray-600">Start by creating a workspace or importing a repository</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
