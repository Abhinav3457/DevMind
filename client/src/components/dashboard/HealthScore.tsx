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
  excellent: { color: 'text-emerald-400', ring: 'stroke-emerald-400', label: 'Excellent' },
  good: { color: 'text-blue-400', ring: 'stroke-blue-400', label: 'Good' },
  fair: { color: 'text-amber-400', ring: 'stroke-amber-400', label: 'Fair' },
  poor: { color: 'text-rose-400', ring: 'stroke-rose-400', label: 'Poor' },
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
    <div className="w-full space-y-6">
      {/* Score circle */}
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-5 sm:text-left">
        <div className="relative flex h-24 w-24 flex-shrink-0 items-center justify-center sm:h-28 sm:w-28">
          <svg className="absolute h-24 w-24 -rotate-90 sm:h-28 sm:w-28" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="rgb(var(--surface-800))"
              strokeWidth="8"
            />
            <motion.circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              className={config.ring}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
          </svg>

          <div className="z-10 text-center">
            <motion.p
              className="text-2xl font-semibold tabular-nums text-surface-100 sm:text-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              {score}
            </motion.p>
            <p className="text-[10px] text-surface-500">/ 100</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className={`text-sm font-semibold ${config.color}`}>{config.label}</p>
          <p className="max-w-[220px] text-[11px] leading-relaxed text-surface-400">
            Derived from indexing completeness and documentation coverage
          </p>
        </div>
      </div>

      {/* Metric bars */}
      <div className="space-y-4">
        {bars.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 + index * 0.08 }}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] text-surface-400">{metric.label}</span>
              <span className="text-[11px] tabular-nums text-surface-300">
                {metric.value}
                <span className="ml-1 text-surface-500">({metric.percent}%)</span>
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-800">
              <motion.div
                className={`h-full rounded-full ${
                  metric.percent > 70
                    ? 'bg-emerald-500'
                    : metric.percent > 40
                      ? 'bg-blue-500'
                      : 'bg-amber-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: metric.percent + '%' }}
                transition={{ duration: 0.8, delay: 0.5 + index * 0.08, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
