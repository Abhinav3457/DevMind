import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';
import { motion } from 'framer-motion';

ChartJS.register(ArcElement, Tooltip);

export interface DoughnutSlice {
  label: string;
  value: number;
  color: string;
}

interface BreakdownDoughnutProps {
  slices: DoughnutSlice[];
  centerValue?: string | number;
  centerLabel?: string;
}

/** Generic doughnut with a custom legend and centered total. */
export function BreakdownDoughnut({ slices, centerValue, centerLabel }: BreakdownDoughnutProps) {
  const nonEmpty = slices.filter((s) => s.value > 0);
  const total = nonEmpty.reduce((sum, s) => sum + s.value, 0);

  if (nonEmpty.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <div className="h-14 w-14 rounded-full border-2 border-dashed border-surface-700" />
        <p className="text-xs text-surface-500">No operations recorded yet</p>
      </div>
    );
  }

  const data = {
    labels: nonEmpty.map((s) => s.label),
    datasets: [
      {
        data: nonEmpty.map((s) => s.value),
        backgroundColor: nonEmpty.map((s) => `${s.color}cc`),
        borderColor: 'rgb(var(--surface-900))',
        borderWidth: 3,
        hoverBackgroundColor: nonEmpty.map((s) => s.color),
        hoverBorderWidth: 0,
        hoverOffset: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgb(var(--surface-900))',
        titleColor: 'rgb(var(--surface-100))',
        bodyColor: 'rgb(var(--surface-300))',
        borderColor: 'rgb(var(--surface-700))',
        borderWidth: 1,
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        cornerRadius: 10,
        displayColors: true,
        boxPadding: 4,
        callbacks: {
          label: (ctx: { parsed: number; label: string }) => {
            const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
            return ` ${ctx.parsed.toLocaleString()} (${pct}%)`;
          },
        },
      },
    },
    animation: { animateRotate: true, animateScale: true, duration: 1000, easing: 'easeOutQuart' as const },
  };

  return (
    <div className="flex h-full items-center gap-4">
      <div className="relative h-32 w-32 flex-shrink-0">
        <Doughnut data={data} options={options} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums text-surface-100">
            {(centerValue ?? total).toLocaleString()}
          </span>
          {centerLabel && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-surface-500">{centerLabel}</span>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {nonEmpty.slice(0, 5).map((slice, i) => {
          const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          return (
            <motion.div
              key={slice.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.06 }}
              className="flex items-center gap-2"
            >
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
              <span className="min-w-0 flex-1 truncate text-xs capitalize text-surface-300">{slice.label}</span>
              <span className="text-xs font-semibold tabular-nums text-surface-200">{pct}%</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
