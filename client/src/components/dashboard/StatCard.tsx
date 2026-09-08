import { motion } from 'framer-motion';
import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnimatedCounter } from './AnimatedCounter';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  delay?: number;
  previousValue?: number;
  onClick?: () => void;
  sparklineData?: number[];
}

const colorMap: Record<string, {    
  bg: string; 
  border: string; 
  icon: string; 
  text: string;
  ring: string;
  sparkline: string;
}> = {
  blue: { 
    bg: 'bg-blue-500/10', 
    border: 'border-blue-500/20 hover:border-blue-500/40', 
    icon: 'text-blue-400', 
    text: 'text-surface-100',
    ring: 'ring-blue-500/30',
    sparkline: '#3b82f6'
  },
  green: { 
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/20 hover:border-emerald-500/40', 
    icon: 'text-emerald-400', 
    text: 'text-surface-100',
    ring: 'ring-emerald-500/30',
    sparkline: '#10b981'
  },
  purple: { 
    bg: 'bg-purple-500/10', 
    border: 'border-purple-500/20 hover:border-purple-500/40', 
    icon: 'text-purple-400', 
    text: 'text-surface-100',
    ring: 'ring-purple-500/30',
    sparkline: '#a855f7'
  },
  amber: { 
    bg: 'bg-amber-500/10', 
    border: 'border-amber-500/20 hover:border-amber-500/40', 
    icon: 'text-amber-400', 
    text: 'text-surface-100',
    ring: 'ring-amber-500/30',
    sparkline: '#f59e0b'
  },
  rose: { 
    bg: 'bg-rose-500/10', 
    border: 'border-rose-500/20 hover:border-rose-500/40', 
    icon: 'text-rose-400', 
    text: 'text-surface-100',
    ring: 'ring-rose-500/30',
    sparkline: '#f43f5e'
  },
  cyan: { 
    bg: 'bg-cyan-500/10', 
    border: 'border-cyan-500/20 hover:border-cyan-500/40', 
    icon: 'text-cyan-400', 
    text: 'text-surface-100',
    ring: 'ring-cyan-500/30',
    sparkline: '#06b6d4'
  },
  indigo: { 
    bg: 'bg-indigo-500/10', 
    border: 'border-indigo-500/20 hover:border-indigo-500/40', 
    icon: 'text-indigo-400', 
    text: 'text-surface-100',
    ring: 'ring-indigo-500/30',
    sparkline: '#6366f1'
  },
};

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 24;
  const width = 60;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  
  return (
    <svg className="absolute bottom-2 right-2 opacity-60" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`sparkline-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={`glow-${color.replace('#', '')}`}>
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polygon 
        points={areaPoints} 
        fill={`url(#sparkline-${color.replace('#', '')})`} 
      />
      <polyline 
        points={points} 
        fill="none" 
        stroke={color} 
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#glow-${color.replace('#', '')})`}
      />
    </svg>
  );
}

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  subtitle, 
  trend, 
  trendValue, 
  delay = 0,
  previousValue,
  onClick,
  sparklineData,
}: StatCardProps) {
  const colors = (colorMap[color as keyof typeof colorMap] ?? colorMap.blue) as NonNullable<typeof colorMap[keyof typeof colorMap]>;
  const isNumber = typeof value === 'number';
  const changePercent = isNumber && previousValue !== undefined
    ? previousValue === 0 
      ? value > 0 ? 100 : 0
      : Math.round(((value - previousValue) / previousValue) * 100)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`group relative rounded-xl sm:rounded-2xl border ${colors.border} bg-surface-900 p-3 sm:p-5 transition-all duration-300 ${onClick ? 'cursor-pointer' : ''}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      aria-label={onClick ? `View details for ${title}` : undefined}
    >
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="space-y-1 sm:space-y-3">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-surface-400">{title}</p>
            <p className={`text-xl sm:text-3xl font-bold tracking-tight ${colors.text}`}>
              {isNumber ? (
                <AnimatedCounter value={value} delay={delay} />
              ) : (
                value
              )}
            </p>
            {subtitle && (
              <p className="text-xs text-surface-400">{subtitle}</p>
            )}
          </div>
          <motion.div 
            className={`rounded-lg sm:rounded-xl p-2 sm:p-3 ${colors.bg} ring-1 ${colors.ring} transition-all duration-300`}
            whileHover={{ scale: 1.15, rotate: 5 }}
          >
            <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${colors.icon}`} />
          </motion.div>
        </div>
        
        {(trend || changePercent !== null) && (
          <div className="mt-4 flex items-center gap-2 border-t border-surface-800 pt-3">
            {trend ? (
              <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 
                trend === 'down' ? 'bg-rose-500/10 text-rose-400' : 
                'bg-surface-500/10 text-surface-400'
              }`}>
                {trend === 'up' ? (
                  <TrendingUp className="h-3 w-3" />
                ) : trend === 'down' ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                <span>{trendValue || 'vs. previous period'}</span>
              </div>
            ) : changePercent !== null && (
              <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                changePercent > 0 ? 'bg-emerald-500/10 text-emerald-400' : 
                changePercent < 0 ? 'bg-rose-500/10 text-rose-400' : 
                'bg-surface-500/10 text-surface-400'
              }`}>
                {changePercent > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : changePercent < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                <span>{changePercent > 0 ? '+' : ''}{changePercent}% vs. previous</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mini sparkline (only when real data is provided) */}
      {sparklineData && sparklineData.length >= 2 && (
        <MiniSparkline data={sparklineData} color={colors.sparkline} />
      )}

    </motion.div>
  );
}
