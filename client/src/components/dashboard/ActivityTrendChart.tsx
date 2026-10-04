import { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import type { ChartOptions, ScriptableContext, TooltipItem } from 'chart.js';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import type { AnalyticsData } from '../../types';
import { useChartAccent, useChartSurface } from '../../hooks/useChartAccent';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

type SeriesKey = 'operations' | 'indexes' | 'reviews' | 'documents' | 'practice';

interface SeriesDef {
  key: SeriesKey;
  label: string;
  accent: 'blue' | 'cyan' | 'amber' | 'purple' | 'emerald';
  /** Static Tailwind class for the series dot (JIT can't see interpolated names). */
  dot: string;
  filled?: boolean;
}

const SERIES: SeriesDef[] = [
  { key: 'operations', label: 'All activity', accent: 'blue', dot: 'bg-blue-400', filled: true },
  { key: 'indexes', label: 'Indexes', accent: 'cyan', dot: 'bg-cyan-400' },
  { key: 'reviews', label: 'Reviews', accent: 'amber', dot: 'bg-amber-400' },
  { key: 'documents', label: 'Docs', accent: 'purple', dot: 'bg-purple-400' },
  { key: 'practice', label: 'Practice', accent: 'emerald', dot: 'bg-emerald-400' },
];

interface ActivityTrendChartProps {
  trend: AnalyticsData['trend'];
}

/**
 * 14-day multi-series activity trend. A filled "all activity" area anchors the
 * chart with thinner per-type lines layered on top; chips toggle each series.
 */
export function ActivityTrendChart({ trend }: ActivityTrendChartProps) {
  const accent = useChartAccent();
  const surface = useChartSurface();
  const [active, setActive] = useState<SeriesKey[]>(SERIES.map((s) => s.key));

  const hasData = useMemo(() => SERIES.some((s) => trend[s.key].some((v) => v > 0)), [trend]);

  const stats = useMemo(() => {
    const total = trend.operations.reduce((sum, n) => sum + n, 0);
    const activeDays = trend.operations.filter((n) => n > 0).length;
    const peak = Math.max(...trend.operations, 0);
    const peakIndex = trend.operations.indexOf(peak);
    return {
      total,
      activeDays,
      peak,
      peakLabel: peak > 0 ? trend.days[peakIndex] : 'N/A',
    };
  }, [trend]);

  const chartData = useMemo(() => {
    const activeDefs = SERIES.filter((s) => active.includes(s.key));

    return {
      labels: trend.days,
      datasets: activeDefs.map((def) => {
        const color = accent(def.accent);
        const values = trend[def.key];

        return {
          label: def.label,
          data: values,
          borderColor: color,
          backgroundColor: def.filled
            ? (context: ScriptableContext<'line'>) => {
                const { ctx, chartArea } = context.chart;
                if (!chartArea) return accent(def.accent, 0.08);
                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                gradient.addColorStop(0, accent(def.accent, 0.18));
                gradient.addColorStop(1, accent(def.accent, 0));
                return gradient;
              }
            : color,
          borderWidth: def.filled ? 1.5 : 1,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: color,
          pointHoverBorderColor: surface(950),
          pointHoverBorderWidth: 2,
          fill: Boolean(def.filled),
          order: def.filled ? SERIES.length : 1,
        };
      }),
    };
  }, [trend, active, accent, surface]);

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: surface(900),
          titleColor: surface(100),
          bodyColor: surface(300),
          borderColor: surface(700),
          borderWidth: 1,
          padding: { top: 8, bottom: 8, left: 12, right: 12 },
          cornerRadius: 8,
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 12 },
          boxPadding: 4,
          callbacks: {
            label: (item: TooltipItem<'line'>) => ` ${item.dataset.label}: ${item.parsed.y ?? 0}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: surface(400),
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 7,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: surface(800, 0.6) },
          border: { display: false },
          ticks: { color: surface(400), font: { size: 10 }, maxTicksLimit: 4, precision: 0 },
        },
      },
      animation: { duration: 700, easing: 'easeOutQuart' },
    }),
    [surface],
  );

  const toggle = (key: SeriesKey) => {
    setActive((prev) =>
      prev.includes(key)
        ? prev.length === 1
          ? prev
          : prev.filter((k) => k !== key)
        : [...prev, key],
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header: title + series toggles over a hairline */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-surface-800 pb-3 sm:mb-5">
        <div className="flex min-w-0 items-center gap-2">
          <Activity className="h-4 w-4 flex-shrink-0 text-surface-500" />
          <h2 className="truncate text-xs font-semibold uppercase tracking-wider text-surface-300">
            Activity Trend
          </h2>
          <span className="text-[11px] text-surface-500">14 days</span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {SERIES.map((def) => {
            const isActive = active.includes(def.key);
            return (
              <button
                key={def.key}
                onClick={() => toggle(def.key)}
                aria-pressed={isActive}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'border-surface-600 bg-surface-800 text-surface-200'
                    : 'border-surface-800 text-surface-500 hover:text-surface-300'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isActive ? def.dot : 'bg-surface-700'}`}
                />
                {def.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Headline stats */}
      <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="text-xl font-semibold tabular-nums text-surface-100">
            {stats.total.toLocaleString()}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-surface-500">Total events</p>
        </div>
        <div>
          <p className="text-xl font-semibold tabular-nums text-surface-100">{stats.activeDays}</p>
          <p className="text-[10px] uppercase tracking-wider text-surface-500">Active days</p>
        </div>
        <div>
          <p className="text-xl font-semibold tabular-nums text-surface-100">
            {stats.peak > 0 ? stats.peak : '—'}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-surface-500">
            Busiest day{stats.peak > 0 ? ` · ${stats.peakLabel}` : ''}
          </p>
        </div>
      </div>

      {/* Chart */}
      {hasData ? (
        <div className="h-56 min-h-0 flex-1 sm:h-64">
          <Line data={chartData} options={options} />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-surface-800 text-center sm:h-64"
        >
          <p className="text-xs font-medium text-surface-400">No activity in this period</p>
          <p className="mt-1 max-w-[260px] text-[11px] text-surface-500">
            Index a repository, run a review or generate docs to populate the trend.
          </p>
        </motion.div>
      )}
    </div>
  );
}
