import { useId } from 'react';

interface SparklineProps {
  data: number[];
  color?: string;
  className?: string;
}

/**
 * Lightweight inline SVG sparkline. Uses a non-scaling stroke so it stays crisp
 * at any tile size and a per-instance gradient id to avoid SVG id collisions.
 */
export function Sparkline({ data, color = '#22d3ee', className = '' }: SparklineProps) {
  const rawId = useId();
  const gradId = `spark-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  if (!data || data.length < 2) {
    return <div className={`h-full w-full ${className}`} aria-hidden="true" />;
  }

  const width = 100;
  const height = 32;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 2 - ((val - min) / range) * (height - 6);
    return `${x},${y}`;
  });

  const line = points.join(' ');
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <svg
      className={`h-full w-full ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
