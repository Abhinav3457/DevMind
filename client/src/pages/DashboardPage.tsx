import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileCode,
  Github, Bot, Bug, FileText,
  TrendingUp, Star,
  ArrowRight, Check,
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
}

const quickActions = [
  { to: '/github', label: 'Import Repository', icon: Github, color: 'purple' },
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
    <div className="rounded-xl border border-surface-700/40 bg-surface-900/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-surface-200">Getting Started</h3>
        <span className="text-[10px] text-surface-500">{completed}/{steps.length}</span>
      </div>
      <div className="h-1 rounded-full bg-surface-800 mb-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${(completed / steps.length) * 100}%` }}
        />
      </div>
      <div className="space-y-1">
        {steps.map((step) => (
          <Link
            key={step.label}
            to={step.to}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-surface-800/50 group"
          >
            <div className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors ${
              step.done
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                : 'border-surface-600 text-surface-500 group-hover:border-primary-500/50 group-hover:text-primary-400'
            }`}>
              {step.done && <Check className="h-2.5 w-2.5" />}
            </div>
            <span className={step.done ? 'text-surface-500 line-through' : 'text-surface-300'}>{step.label}</span>
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
        const res = await apiClient.get('/analytics');
        const overview: AnalyticsOverview = res.data.data?.overview || {};
        setStats({
          repositories: overview.repositories || 0,
          indexedRepos: overview.indexedRepos || 0,
          indexedFiles: overview.totalFiles || 0,
          healthScore: overview.healthScore || 0,
          aiOperations: overview.aiOperations || 0,
          stars: overview.stars || 0,
        });
      } catch {
        setStats({ repositories: 0, indexedRepos: 0, indexedFiles: 0, healthScore: 0, aiOperations: 0, stars: 0 });
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
          <StatCard title="Repositories" value={stats?.repositories || 0} icon={Github} color="green" delay={0} />
          <StatCard title="Files Indexed" value={stats?.indexedFiles || 0} icon={FileCode} color="amber" delay={0.05} />
          <StatCard title="AI Operations" value={stats?.aiOperations || 0} icon={Bot} color="cyan" delay={0.1} />
          <StatCard title="Stars" value={stats?.stars || 0} icon={Star} color="purple" delay={0.15} />
        </motion.div>
      )}

      {/* ── Onboarding + Quick Actions ─────────────────────── */}
      {!loading && stats && (
        <motion.div variants={item} className="grid gap-4 lg:grid-cols-3">
          <OnboardingChecklist stats={stats} />

          <div className="lg:col-span-2 rounded-xl border border-surface-700/40 bg-surface-900/40 p-4">
            <h3 className="text-sm font-semibold text-surface-200 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {quickActions.map((action, index) => (
                <Link
                  key={action.label}
                  to={action.to}
                  className={index === quickActions.length - 1 ? 'col-span-2' : undefined}
                >
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


    </motion.div>
  );
}
