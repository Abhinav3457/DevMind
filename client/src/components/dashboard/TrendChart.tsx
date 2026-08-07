import { useId } from 'react';

interface TrendPoint {
  label: string;
  value: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  height?: number;
}

/** Build a smooth cubic-bezier path through the given points. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  return points.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = arr[i - 1]!;
    const cp1x = prev.x + (p.x - prev.x) * 0.25;
    const cp1y = prev.y;
    const cp2x = p.x - (p.x - prev.x) * 0.25;
    const cp2y = p.y;
    return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p.x},${p.y}`;
  }, '');
}

export function TrendChart({ data, height = 200 }: TrendChartProps) {
  const gradientId = useId().replace(/:/g, '');

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-surface-500">
        No trend data available — index a repository first
      </div>
    );
  }

  // A single point has no line to draw — render it as a centered dot instead.
  if (data.length === 1) {
    const d = data[0]!;
    const H2 = Math.max(height, 160);
    const cx = 300;
    const cy = (H2 / 2) + 4;
    const value = Math.min(Math.max(d.value, 0), 100);
    return (
      <svg viewBox={`0 0 600 ${H2}`} className="w-full" role="img" aria-label="Code quality trend chart">
        <line x1="28" x2="572" y1={cy} y2={cy} stroke="rgb(var(--surface-700) / 0.5)" strokeDasharray="4 6" strokeWidth="1" />
        <circle cx={cx} cy={cy} r="5" fill="rgb(var(--surface-950))" stroke="#60a5fa" strokeWidth="2.5" />
        <text x={cx} y={cy - 14} textAnchor="middle" fontSize="12" fontWeight="600" fill="#60a5fa">
          {Math.round(value)}
        </text>
        <text x={cx} y={H2 - 10} textAnchor="middle" fontSize="10" fill="rgb(var(--surface-400))">
          {d.label}
        </text>
      </svg>
    );
  }

  const W = 600;
  const H = height;
  const padX = 28;
  const padTop = 22;
  const padBottom = 34;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const max = 100;

  const points = data.map((d, i) => ({
    x: padX + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
    y: padTop + innerH - (Math.min(Math.max(d.value, 0), max) / max) * innerH,
    ...d,
  }));

  const linePath = smoothPath(points);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const areaPath = `${linePath} L ${last.x} ${padTop + innerH} L ${first.x} ${padTop + innerH} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Code quality trend chart"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Horizontal gridlines */}
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const y = padTop + innerH - f * innerH;
        return (
          <g key={f}>
            <line
              x1={padX}
              x2={W - padX}
              y1={y}
              y2={y}
              stroke="rgb(var(--surface-700) / 0.5)"
              strokeDasharray="4 6"
              strokeWidth="1"
            />
            <text x={padX - 8} y={y + 3} textAnchor="end" fontSize="9" fill="rgb(var(--surface-500))">
              {Math.round(f * 100)}
            </text>
          </g>
        );
      })}

      {/* Area + line */}
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke="#60a5fa"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots + labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="rgb(var(--surface-950))" stroke="#60a5fa" strokeWidth="2" />
          <text x={p.x} y={H - 10} textAnchor="middle" fontSize="10" fill="rgb(var(--surface-400))">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
