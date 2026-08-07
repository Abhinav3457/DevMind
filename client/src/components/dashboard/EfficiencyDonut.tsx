import { useId } from 'react';

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface EfficiencyDonutProps {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string;
}

export function EfficiencyDonut({ segments, centerLabel, centerValue }: EfficiencyDonutProps) {
  const gradId = useId().replace(/:/g, '');
  const total = segments.reduce((sum, s) => sum + Math.max(s.value, 0), 0);

  if (total <= 0 || segments.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-xs text-surface-500">
        No AI activity yet — run a code review or agent task
      </div>
    );
  }

  const size = 160;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const frac = Math.max(seg.value, 0) / total;
    const len = frac * c;
    const dash = `${len} ${c - len}`;
    const el = (
      <circle
        key={seg.label}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={seg.color}
        strokeWidth={stroke}
        strokeDasharray={dash}
        strokeDashoffset={-offset}
        strokeLinecap="butt"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    );
    offset += len;
    return { ...seg, el };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
      <div className="relative flex-shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel}>
          <defs>
            <filter id={gradId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="rgba(0,0,0,0.4)" />
            </filter>
          </defs>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgb(var(--surface-800))" strokeWidth={stroke} />
          <g filter={`url(#${gradId})`}>{arcs.map((a) => a.el)}</g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-surface-100">{centerValue}</span>
          <span className="text-[9px] font-medium uppercase tracking-wider text-surface-400">{centerLabel}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        {arcs.map((a) => (
          <div key={a.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
            <span className="text-xs text-surface-300">{a.label}</span>
            <span className="ml-auto text-xs font-medium tabular-nums text-surface-400">
              {Math.round((Math.max(a.value, 0) / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
