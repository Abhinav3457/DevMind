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
}

const colorMap: Record<string, {    bg: string; 
  border: string; 
  icon: string; 
  text: string;
  gradient: string;
  glow: string;
  ring: string;
}> = {
  blue: { 
    bg: 'bg-blue-500/10', 
    border: 'border-blue-500/20 hover:border-blue-500/40', 
    icon: 'text-blue-400', 
    text: 'text-surface-100',
    gradient: 'from-blue-500/20 via-blue-500/5 to-transparent',
    glow: 'shadow-blue-500/10',
    ring: 'ring-blue-500/30'
  },
  green: { 
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/20 hover:border-emerald-500/40', 
    icon: 'text-emerald-400', 
    text: 'text-surface-100',
    gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
    glow: 'shadow-emerald-500/10',
    ring: 'ring-emerald-500/30'
  },
  purple: { 
    bg: 'bg-purple-500/10', 
    border: 'border-purple-500/20 hover:border-purple-500/40', 
    icon: 'text-purple-400', 
    text: 'text-surface-100',
    gradient: 'from-purple-500/20 via-purple-500/5 to-transparent',
    glow: 'shadow-purple-500/10',
    ring: 'ring-purple-500/30'
  },
  amber: { 
    bg: 'bg-amber-500/10', 
    border: 'border-amber-500/20 hover:border-amber-500/40', 
    icon: 'text-amber-400', 
    text: 'text-surface-100',
    gradient: 'from-amber-500/20 via-amber-500/5 to-transparent',
    glow: 'shadow-amber-500/10',
    ring: 'ring-amber-500/30'
  },
  rose: { 
    bg: 'bg-rose-500/10', 
    border: 'border-rose-500/20 hover:border-rose-500/40', 
    icon: 'text-rose-400', 
    text: 'text-surface-100',
    gradient: 'from-rose-500/20 via-rose-500/5 to-transparent',
    glow: 'shadow-rose-500/10',
    ring: 'ring-rose-500/30'
  },
  cyan: { 
    bg: 'bg-cyan-500/10', 
    border: 'border-cyan-500/20 hover:border-cyan-500/40', 
    icon: 'text-cyan-400', 
    text: 'text-surface-100',
    gradient: 'from-cyan-500/20 via-cyan-500/5 to-transparent',
    glow: 'shadow-cyan-500/10',
    ring: 'ring-cyan-500/30'
  },
  indigo: { 
    bg: 'bg-indigo-500/10', 
    border: 'border-indigo-500/20 hover:border-indigo-500/40', 
    icon: 'text-indigo-400', 
    text: 'text-surface-100',
    gradient: 'from-indigo-500/20 via-indigo-500/5 to-transparent',
    glow: 'shadow-indigo-500/10',
    ring: 'ring-indigo-500/30'
  },
};

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
      whileHover={{ scale: 1.02, y: -2 }}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl sm:rounded-2xl border ${colors.border} bg-gradient-to-br from-surface-900/80 to-surface-950/80 p-3 sm:p-5 shadow-lg backdrop-blur-xl transition-all duration-300 ${onClick ? 'cursor-pointer' : ''}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      aria-label={onClick ? `View details for ${title}` : undefined}
    >
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
      
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
          <div className={`rounded-lg sm:rounded-xl p-2 sm:p-3 ${colors.bg} ring-1 ${colors.ring} transition-all duration-300 group-hover:scale-110 group-hover:ring-2`}>
            <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${colors.icon}`} />
          </div>
        </div>
        
        {(trend || changePercent !== null) && (
          <div className="mt-4 flex items-center gap-2 border-t border-surface-700/50 pt-3">
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
                <span>{trendValue || 'vs last period'}</span>
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
                <span>{changePercent > 0 ? '+' : ''}{changePercent}% vs previous</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Decorative elements */}
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-surface-50/[0.02] transition-transform duration-500 group-hover:scale-150" />
      <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-surface-50/[0.02]" />
    </motion.div>
  );
}
