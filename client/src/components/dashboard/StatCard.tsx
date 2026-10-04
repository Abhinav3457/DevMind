import { motion } from 'framer-motion';
import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnimatedCounter } from './AnimatedCounter';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  delay?: number;
  previousValue?: number;
  onClick?: () => void;
  sparklineData?: number[];
}

const SPARKLINE = '#94a3b8';

function MiniSparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 24;
  const width = 60;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      className="absolute bottom-3 right-3 opacity-50"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="stat-sparkline-fill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={SPARKLINE} stopOpacity="0.25" />
          <stop offset="100%" stopColor={SPARKLINE} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#stat-sparkline-fill)" />
      <polyline
        points={points}
        fill="none"
        stroke={SPARKLINE}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  trendValue,
  delay = 0,
  previousValue,
  onClick,
  sparklineData,
}: StatCardProps) {
  const isNumber = typeof value === 'number';
  const changePercent =
    isNumber && previousValue !== undefined
      ? previousValue === 0
        ? value > 0
          ? 100
          : 0
        : Math.round(((value - previousValue) / previousValue) * 100)
      : null;

  const resolvedTrend =
    trend ??
    (changePercent !== null
      ? changePercent > 0
        ? 'up'
        : changePercent < 0
          ? 'down'
          : 'neutral'
      : null);
  const trendLabel =
    trendValue ??
    (changePercent !== null
      ? `${changePercent > 0 ? '+' : ''}${changePercent}% vs. previous`
      : null);

  const trendTone =
    resolvedTrend === 'up'
      ? 'text-emerald-400'
      : resolvedTrend === 'down'
        ? 'text-rose-400'
        : 'text-surface-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={onClick}
      className={`relative rounded-xl border border-surface-800 bg-surface-900/60 p-4 ${
        onClick ? 'cursor-pointer transition-colors hover:border-surface-700' : ''
      }`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={onClick ? `View details for ${title}` : undefined}
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-surface-500">
              {title}
            </p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-surface-100">
              {isNumber ? <AnimatedCounter value={value} delay={delay} /> : value}
            </p>
            {subtitle && <p className="truncate text-[11px] text-surface-400">{subtitle}</p>}
          </div>
          <Icon className="h-4 w-4 flex-shrink-0 text-surface-500" />
        </div>

        {resolvedTrend && trendLabel && (
          <div
            className={`mt-3 flex items-center gap-1.5 border-t border-surface-800 pt-2.5 text-[11px] font-medium ${trendTone}`}
          >
            {resolvedTrend === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : resolvedTrend === 'down' ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            <span>{trendLabel}</span>
          </div>
        )}
      </div>

      {sparklineData && sparklineData.length >= 2 && <MiniSparkline data={sparklineData} />}
    </motion.div>
  );
}
