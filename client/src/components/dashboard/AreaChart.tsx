import { useState, useId } from 'react';
import { motion } from 'framer-motion';

interface DataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface AreaChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  showDots?: boolean;
  showGrid?: boolean;
  fillOpacity?: number;
  className?: string;
  animated?: boolean;
  onPointClick?: (point: DataPoint, index: number) => void;
}

export function AreaChart({
  data,
  height = 200,
  color = 'rgb(59, 130, 246)',
  showDots = true,
  showGrid = true,
  fillOpacity = 0.3,
  className = '',
  animated = true,
  onPointClick,
}: AreaChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradientId = useId();

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-gray-500">No data available</p>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const width = 100;

  const getX = (i: number) => (i / (data.length - 1)) * width;
  const getY = (v: number) => ((max - v) / range) * 100;

  const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');
  const areaPoints = `0,100 ${points} ${getX(data.length - 1)},100`;

  const gridLines = showGrid
    ? Array.from({ length: 5 }, (_, i) => (i / 4) * 100)
    : [];

  return (
    <div className={`relative ${className}`}>
      {/* Grid */}
      {showGrid && (
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ height }}>
          {gridLines.map((line) => (
            <div key={line} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 w-8 text-right">
                {Math.round(max - (line / 100) * range)}
              </span>
              <div className="flex-1 border-t border-gray-800/30" />
            </div>
          ))}
        </div>
      )}

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${width} 100`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height, marginLeft: showGrid ? 40 : 0 }}
        role="img"
        aria-label="Area chart visualization"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <motion.polygon
          points={areaPoints}
          fill={`url(#${gradientId})`}
          initial={animated ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        {/* Line */}
        <motion.polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={animated ? { pathLength: 0, opacity: 0 } : false}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        />

        {/* Dots */}
        {showDots &&
          data.map((d, i) => (
            <motion.circle
              key={i}
              cx={getX(i)}
              cy={getY(d.value)}
              r={hoveredIndex === i ? 5 : 3}
              fill={color}
              stroke="#0f172a"
              strokeWidth="2"
              initial={animated ? { opacity: 0, scale: 0 } : false}
              animate={{
                opacity: 1,
                scale: hoveredIndex === i ? 1.3 : 1,
              }}
              transition={{ duration: 0.2 }}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => d && onPointClick?.(d, i)}
            />
          ))}
      </svg>

      {/* Labels */}
      <div
        className="flex justify-between mt-1"
        style={{ marginLeft: showGrid ? 40 : 0 }}
      >
        {data
          .filter((_, i) => i % Math.max(1, Math.floor(data.length / 8)) === 0 || i === data.length - 1)
          .map((d, i) => (
            <span key={i} className="text-[10px] text-gray-500 truncate">
              {d.label}
            </span>
          ))}
      </div>

      {/* Hover tooltip */}
      {hoveredIndex !== null && data[hoveredIndex] && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 rounded-lg bg-gray-900/95 border border-gray-700/50 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-sm pointer-events-none"
        >
          <p className="font-medium text-gray-200">{data[hoveredIndex].label}</p>
          <p className="text-gray-400">{data[hoveredIndex].value.toLocaleString()}</p>
          {data[hoveredIndex].secondaryValue !== undefined && (
            <p className="text-gray-500">{data[hoveredIndex].secondaryValue.toLocaleString()}</p>
          )}
        </motion.div>
      )}
    </div>
  );
}
