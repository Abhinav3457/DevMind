import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface BarData {
  label: string;
  value: number;
  color?: string;
  secondaryValue?: number;
  tooltip?: string;
}

interface InteractiveBarChartProps {
  data: BarData[];
  height?: number;
  maxValue?: number;
  showGrid?: boolean;
  barRadius?: number;
  className?: string;
  animated?: boolean;
  onBarClick?: (item: BarData, index: number) => void;
}

const defaultColors = [
  'from-blue-500 to-blue-400',
  'from-emerald-500 to-emerald-400',
  'from-purple-500 to-purple-400',
  'from-amber-500 to-amber-400',
  'from-rose-500 to-rose-400',
  'from-cyan-500 to-cyan-400',
  'from-indigo-500 to-indigo-400',
  'from-pink-500 to-pink-400',
];

export function InteractiveBarChart({
  data,
  height = 220,
  maxValue,
  showGrid = true,
  barRadius = 4,
  className = '',
  animated = true,
  onBarClick,
}: InteractiveBarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  const gridLines = showGrid ? [0, 25, 50, 75, 100] : [];

  return (
    <div className={`relative ${className}`} ref={chartRef}>
      {/* Grid lines */}
      {showGrid && (
        <div className="absolute inset-0 flex flex-col-reverse justify-between pointer-events-none">
          {gridLines.map((line) => (
            <div key={line} className="flex items-center gap-2">
              <span className="text-[10px] text-surface-500 w-8 text-right font-medium">
                {Math.round((line / 100) * max)}
              </span>
              <div className="flex-1 border-t border-surface-700/30" />
            </div>
          ))}
        </div>
      )}

      {/* Bars */}
      <div
        className="flex items-end gap-2 pt-6 pb-1"
        style={{ height, marginLeft: showGrid ? 40 : 0 }}
      >
        {data.map((item, index) => {
          const percent = (item.value / max) * 100;
          const isActive = activeIndex === index;
          const color = item.color || defaultColors[index % defaultColors.length];

          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
              {/* Tooltip — clamped so edge bars never push it off-screen on small viewports */}
              {isActive && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute -top-8 z-20 max-w-[min(16rem,75vw)] whitespace-normal rounded-lg bg-surface-900/95 border border-surface-600/50 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-sm"
                  style={{ left: `clamp(8rem, ${(index / data.length) * 100}%, calc(100% - 8rem))`, transform: 'translateX(-50%)' }}
                >
                  <p className="font-medium text-surface-200">{item.tooltip || item.label}</p>
                  <p className="text-surface-300">{item.value.toLocaleString()}</p>
                  {item.secondaryValue !== undefined && (
                    <p className="text-surface-400">{item.secondaryValue.toLocaleString()}</p>
                  )}
                </motion.div>
              )}

              {/* Bar wrapper */}
              <div className="flex-1 flex items-end w-full">
                <motion.div
                  className={`w-full cursor-pointer rounded-t-sm bg-gradient-to-t ${color} transition-all duration-200`}
                  style={{ borderRadius: barRadius }}
                  initial={animated ? { height: 0 } : false}
                  animate={{
                    height: `${percent}%`,
                    opacity: 1,
                  }}
                  transition={{
                    duration: 0.8,
                    delay: index * 0.06,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  whileHover={{ scale: 1.08, opacity: 0.9 }}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={() => onBarClick?.(item, index)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.label}: ${item.value.toLocaleString()}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onBarClick?.(item, index);
                    }
                  }}
                />
              </div>

              {/* Label */}
              <span className="text-[10px] text-surface-400 truncate max-w-full text-center mt-1">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
