import { motion } from 'framer-motion';

interface HealthScoreProps {
  score: number;
  level: 'excellent' | 'good' | 'fair' | 'poor';
  metrics: {
    indexed: { value: number; max: number };
    documented: { value: number; max: number };
    analyzed: { value: number; max: number };
    chunks: { value: number; max: number };
  };
}

const levelConfig = {
  excellent: { 
    color: 'text-emerald-400', 
    ring: 'stroke-emerald-400', 
    glow: 'drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]',
    bg: 'bg-emerald-500/10', 
    label: 'Excellent',
    gradient: 'from-emerald-500 to-emerald-400'
  },
  good: { 
    color: 'text-blue-400', 
    ring: 'stroke-blue-400', 
    glow: 'drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]',
    bg: 'bg-blue-500/10', 
    label: 'Good',
    gradient: 'from-blue-500 to-blue-400'
  },
  fair: { 
    color: 'text-amber-400', 
    ring: 'stroke-amber-400', 
    glow: 'drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]',
    bg: 'bg-amber-500/10', 
    label: 'Fair',
    gradient: 'from-amber-500 to-amber-400'
  },
  poor: { 
    color: 'text-rose-400', 
    ring: 'stroke-rose-400', 
    glow: 'drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]',
    bg: 'bg-rose-500/10', 
    label: 'Poor',
    gradient: 'from-rose-500 to-rose-400'
  },
};

const radius = 54;
const circumference = 2 * Math.PI * radius;

export function HealthScore({ score, level, metrics }: HealthScoreProps) {
  const config = levelConfig[level];
  const offset = circumference - (score / 100) * circumference;

  const bar = (label: string, value: number, max: number) => ({
    label,
    percent: max > 0 ? Math.round((value / max) * 100) : 0,
    value: value.toLocaleString(),
  });

  const bars = [
    bar('Files Indexed', metrics.indexed.value, metrics.indexed.max),
    bar('Documented', metrics.documented.value, metrics.documented.max),
    bar('Analyzed', metrics.analyzed.value, metrics.analyzed.max),
    bar('Chunks', metrics.chunks.value, metrics.chunks.max),
  ];

  return (
    <div className="space-y-6">
      {/* Score Circle Section */}
      <div className="flex items-center gap-6">
        <div className="relative flex h-32 w-32 items-center justify-center">
          {/* Background glow */}
          <div className={`absolute inset-0 rounded-full ${config.bg} blur-xl opacity-50`} />
          
          <svg className="absolute h-32 w-32 -rotate-90" viewBox="0 0 120 120">
            {/* Track */}
            <circle 
              cx="60" cy="60" r={radius} 
              fill="none" 
              stroke="url(#trackGradient)" 
              strokeWidth="10" 
            />
            {/* Progress */}
            <motion.circle
              cx="60" cy="60" r={radius}
              fill="none"
              stroke={`url(#progressGradient-${level})`}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.8, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={config.glow}
            />
            {/* Gradient definitions */}
            <defs>
              <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--surface-700)" />
                <stop offset="100%" stopColor="var(--surface-900)" />
              </linearGradient>
              <linearGradient id={`progressGradient-${level}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={level === 'excellent' ? '#34d399' : level === 'good' ? '#60a5fa' : level === 'fair' ? '#fbbf24' : '#fb7185'} />
                <stop offset="100%" stopColor={level === 'excellent' ? '#10b981' : level === 'good' ? '#3b82f6' : level === 'fair' ? '#f59e0b' : '#f43f5e'} />
              </linearGradient>
            </defs>
          </svg>
          
          <div className="text-center z-10">
            <motion.p 
              className={`text-3xl font-bold ${config.color}`}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              {score}
            </motion.p>
            <p className="text-[10px] font-medium text-surface-400">/ 100</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <p className="text-lg font-bold text-surface-100">Repository Health</p>
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${config.bg}`}>
            <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${config.gradient}`} />
            <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
          </div>
          <p className="text-xs text-surface-400 max-w-[200px] leading-relaxed">
            Based on indexing completeness and documentation coverage
          </p>
        </div>
      </div>

      {/* Metrics Bars */}
      <div className="space-y-4">
        {bars.map((bar, index) => (
          <motion.div 
            key={bar.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + index * 0.1 }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-surface-300">{bar.label}</span>
              <span className="text-xs font-semibold text-surface-200">
                {bar.value} <span className="text-surface-400">({bar.percent}%)</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-700/50 overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${
                  bar.percent > 70 ? 'from-emerald-500 to-emerald-400' : 
                  bar.percent > 40 ? 'from-blue-500 to-blue-400' : 
                  'from-amber-500 to-amber-400'
                }`}
                initial={{ width: 0 }}
                animate={{ width: bar.percent + '%' }}
                transition={{ duration: 1, delay: 0.8 + index * 0.1, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
