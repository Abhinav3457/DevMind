import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Equal } from 'lucide-react';
import { AnimatedCounter } from './AnimatedCounter';

interface ComparisonMetric {
  label: string;
  currentValue: number;
  previousValue: number;
  format?: 'number' | 'percentage' | 'decimal';
  prefix?: string;
  suffix?: string;
}

interface ComparisonCardProps {
  title: string;
  icon?: React.ReactNode;
  metrics: ComparisonMetric[];
  color?: string;
  className?: string;
  delay?: number;
}

const colorMap: Record<string, { bg: string; border: string; icon: string }> = {
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-400' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'text-purple-400' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-400' },
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: 'text-rose-400' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: 'text-cyan-400' },
  indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', icon: 'text-indigo-400' },
};

function getChange(current: number, previous: number): { percent: number; trend: 'up' | 'down' | 'neutral' } {
  if (previous === 0) {
    return current === 0 ? { percent: 0, trend: 'neutral' } : { percent: 100, trend: 'up' };
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent > 0) return { percent, trend: 'up' };
  if (percent < 0) return { percent: Math.abs(percent), trend: 'down' };
  return { percent: 0, trend: 'neutral' };
}

function formatMetricValue(value: number, format?: 'number' | 'percentage' | 'decimal'): string {
  switch (format) {
    case 'percentage':
      return value.toFixed(1);
    case 'decimal':
      return value.toFixed(2);
    default:
      return value.toLocaleString();
  }
}

export function ComparisonCard({
  title,
  icon,
  metrics,
  color = 'blue',
  className = '',
  delay = 0,
}: ComparisonCardProps) {
  const colors = (colorMap[color] ?? colorMap.blue) as { bg: string; border: string; icon: string };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`rounded-2xl border border-gray-800/50 bg-gradient-to-br from-gray-900/80 to-gray-950/80 p-5 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        {icon && (
          <div className={`rounded-lg p-2 ${colors.bg}`}>
            {icon}
          </div>
        )}
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
      </div>

      {/* Metrics */}
      <div className="space-y-4">
        {metrics.map((metric, index) => {
          const { percent, trend } = getChange(metric.currentValue, metric.previousValue);
          const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Equal;
          const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-gray-500';
          const trendBg = trend === 'up' ? 'bg-emerald-500/10' : trend === 'down' ? 'bg-rose-500/10' : 'bg-gray-500/10';

          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.1 + index * 0.08 }}
              className="group rounded-xl border border-gray-800/30 bg-gray-900/30 p-4 transition-all hover:border-gray-700/50 hover:bg-gray-900/50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{metric.label}</span>
                <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${trendBg}`}>
                  <TrendIcon className={`h-3 w-3 ${trendColor}`} />
                  <span className={`text-[10px] font-semibold ${trendColor}`}>
                    {trend !== 'neutral' ? `${percent}%` : '\u2014'}
                  </span>
                </div>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold text-gray-100">
                  {metric.prefix}
                  <AnimatedCounter
                    value={metric.currentValue}
                    format={metric.format !== 'decimal'}
                    decimals={metric.format === 'decimal' ? 2 : metric.format === 'percentage' ? 1 : 0}
                    delay={delay + 0.2 + index * 0.08}
                  />
                  {metric.suffix}
                </span>
                <span className="text-xs text-gray-600">
                  vs {formatMetricValue(metric.previousValue, metric.format)} {metric.suffix}
                </span>
              </div>

              {/* Mini sparkline bar */}
              <div className="mt-3 h-1.5 rounded-full bg-gray-800/50 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    trend === 'up'
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      : trend === 'down'
                        ? 'bg-gradient-to-r from-rose-500 to-rose-400'
                        : 'bg-gradient-to-r from-gray-500 to-gray-400'
                  }`}
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(Math.abs(percent), 100)}%`,
                  }}
                  transition={{ duration: 1, delay: delay + 0.3 + index * 0.08, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
