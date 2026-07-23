import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Sparkles,
  X,
  ArrowRight,
} from 'lucide-react';
import { useState } from 'react';

export interface Insight {
  id: string;
  type: 'improvement' | 'positive' | 'warning' | 'suggestion';
  title: string;
  description: string;
  action?: string;
  actionLabel?: string;
  onAction?: () => void;
  metric?: string;
  change?: number;
}

interface InsightsPanelProps {
  insights: Insight[];
  title?: string;
  maxVisible?: number;
  className?: string;
  onDismiss?: (id: string) => void;
}

const typeConfig = {
  improvement: {
    icon: TrendingUp,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    gradient: 'from-blue-500/10 via-transparent to-transparent',
    glow: 'shadow-blue-500/5',
  },
  positive: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    gradient: 'from-emerald-500/10 via-transparent to-transparent',
    glow: 'shadow-emerald-500/5',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    gradient: 'from-amber-500/10 via-transparent to-transparent',
    glow: 'shadow-amber-500/5',
  },
  suggestion: {
    icon: Lightbulb,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20 hover:border-purple-500/40',
    gradient: 'from-purple-500/10 via-transparent to-transparent',
    glow: 'shadow-purple-500/5',
  },
};

export function InsightsPanel({
  insights,
  title = 'AI Insights',
  maxVisible = 4,
  className = '',
  onDismiss,
}: InsightsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleInsights = insights
    .filter((i) => !dismissedIds.has(i.id))
    .slice(0, showAll ? undefined : maxVisible);

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
    onDismiss?.(id);
  };

  if (visibleInsights.length === 0) {
    return (
      <div className={`rounded-2xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-950/80 p-6 backdrop-blur-xl ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-blue-400" />
          </div>
          <h3 className="text-sm font-semibold text-surface-200">{title}</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Zap className="h-8 w-8 text-surface-600 mb-3" />
          <p className="text-sm text-surface-400">No insights yet</p>
          <p className="text-xs text-surface-500 mt-1">Insights will appear as data is analyzed</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-950/80 p-6 backdrop-blur-xl ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-blue-400" />
          </div>
          <h3 className="text-sm font-semibold text-surface-200">{title}</h3>
          <span className="text-[10px] font-medium text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full">
            {visibleInsights.length}
          </span>
        </div>
        {insights.length > maxVisible && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {showAll ? 'Show less' : `View all (${insights.length})`}
          </button>
        )}
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {visibleInsights.map((insight, index) => {
            const config = typeConfig[insight.type];
            const Icon = config.icon;
            const changeColor = insight.change
              ? insight.change > 0
                ? 'text-emerald-400'
                : 'text-rose-400'
              : 'text-surface-400';

            return (
              <motion.div
                key={insight.id}
                layout
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className={`group relative overflow-hidden rounded-xl border ${config.border} bg-gradient-to-r ${config.gradient} p-4 transition-all ${config.glow}`}
              >
                <button
                  onClick={() => handleDismiss(insight.id)}
                  className="absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-800/50"
                  aria-label="Dismiss insight"
                >
                  <X className="h-3 w-3 text-surface-400" />
                </button>

                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2 ${config.bg} flex-shrink-0`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-surface-200">{insight.title}</p>
                      {insight.change !== undefined && (
                        <span className={`flex items-center gap-0.5 text-xs font-medium ${changeColor}`}>
                          {insight.change > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {Math.abs(insight.change)}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-surface-400 mt-1 leading-relaxed">{insight.description}</p>
                    {insight.actionLabel && (
                      <button
                        onClick={insight.onAction}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {insight.actionLabel}
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
