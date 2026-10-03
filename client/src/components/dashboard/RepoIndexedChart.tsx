import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import type { ChartOptions, ScriptableContext, TooltipItem } from 'chart.js';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Github, ArrowRight } from 'lucide-react';
import type { ReposGranularity, ReposIndexedData } from '../../services/analytics';
import { useChartAccent, useChartSurface } from '../../hooks/useChartAccent';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const GRANULARITIES: ReposGranularity[] = ['daily', 'weekly', 'monthly'];

interface RepoIndexedChartProps {
  data?: ReposIndexedData;
  loading: boolean;
  error?: boolean;
  granularity: ReposGranularity;
  onGranularityChange: (granularity: ReposGranularity) => void;
}

/**
 * "Repositories indexed" per period, styled like the Problems Solved chart: a
 * smooth area line shows how many repositories were indexed on each date, so
 * the shape reads as a day-by-day activity wave.
 */
export function RepoIndexedChart({
  data,
  loading,
  error,
  granularity,
  onGranularityChange,
}: RepoIndexedChartProps) {
  const accent = useChartAccent();
  const surface = useChartSurface();
  const points = useMemo(() => data?.points ?? [], [data]);
  const total = data?.total ?? 0;
  const latest = data?.latest ?? null;

  const chartData = useMemo(() => {
    const BLUE = accent('blue');

    return {
      labels: points.map((point) => point.label),
      datasets: [
        {
          label: 'Indexed',
          data: points.map((point) => point.count),
          borderColor: BLUE,
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: points.length <= 2 ? 4 : 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: BLUE,
          pointHoverBorderColor: surface(950),
          pointHoverBorderWidth: 2,
          pointBackgroundColor: BLUE,
          fill: true,
          backgroundColor: (context: ScriptableContext<'line'>) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return accent('blue', 0.13);
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, accent('blue', 0.33));
            gradient.addColorStop(1, accent('blue', 0));
            return gradient;
          },
        },
      ],
    };
  }, [points, accent, surface]);

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: surface(400),
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 12,
            font: { size: 11 },
          },
        },
        tooltip: {
          backgroundColor: surface(900),
          titleColor: surface(100),
          bodyColor: surface(300),
          borderColor: surface(700),
          borderWidth: 1,
          padding: { top: 8, bottom: 8, left: 12, right: 12 },
          cornerRadius: 10,
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 12 },
          callbacks: {
            label: (item: TooltipItem<'line'>) => {
              const point = points[item.dataIndex];
              const running = point ? point.cumulative : 0;
              return ` Indexed: ${item.parsed.y ?? 0}${running > 0 ? ` · ${running} total` : ''}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: surface(400), font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 },
        },
        y: {
          beginAtZero: true,
          grid: { color: surface(800, 0.6) },
          border: { display: false },
          ticks: { color: surface(400), font: { size: 10 }, maxTicksLimit: 4, precision: 0 },
        },
      },
      animation: { duration: 900, easing: 'easeOutQuart' },
    }),
    [points, surface],
  );

  return (
    <div className="flex min-h-[360px] flex-col rounded-xl border border-surface-800 bg-surface-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
            <Github className="h-4 w-4 text-blue-400" />
          </div>
          <h2 className="text-sm font-semibold text-surface-200">Repositories Indexed</h2>
        </div>

        <div className="flex items-center rounded-lg border border-surface-700 bg-surface-800/60 p-0.5">
          {GRANULARITIES.map((option) => (
            <button
              key={option}
              onClick={() => onGranularityChange(option)}
              className={
                'rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ' +
                (granularity === option
                  ? 'bg-primary-500/20 text-primary-300'
                  : 'text-surface-400 hover:text-surface-200')
              }
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : error ? (
        <ChartMessage title="Couldn't load repository analytics" hint="Pull to refresh or try again in a moment." />
      ) : !data || total === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className="text-2xl font-bold tabular-nums text-surface-100">{total}</p>
              <p className="text-[11px] uppercase tracking-wider text-surface-400">Total indexed</p>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-surface-200">
                {latest ? latest.name : '—'}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-surface-400">
                {latest ? `Latest · ${formatDate(latest.indexedAt)}` : 'Latest index'}
              </p>
            </div>
          </div>

          <div className="mt-4 h-56">
            <Line data={chartData} options={options} />
          </div>
        </>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function ChartSkeleton() {
  return (
    <div className="mt-4 flex flex-1 flex-col">
      <div className="mb-4 flex gap-6">
        <div className="h-10 w-20 animate-pulse rounded-lg bg-surface-800" />
        <div className="h-10 w-28 animate-pulse rounded-lg bg-surface-800" />
      </div>
      <div className="h-56 animate-pulse rounded-xl bg-surface-800/70" />
    </div>
  );
}

function ChartMessage({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <p className="text-sm font-medium text-surface-300">{title}</p>
      <p className="mt-1 text-xs text-surface-400">{hint}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10">
        <Github className="h-6 w-6 text-blue-400" />
      </div>
      <p className="text-sm font-medium text-surface-300">No repositories indexed yet</p>
      <p className="mt-1 text-xs text-surface-400">Import a repository to start building your index.</p>
      <Link
        to="/github"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-surface-700 bg-surface-800/70 px-3 py-1.5 text-xs font-medium text-surface-200 transition-colors hover:border-blue-500/40 hover:text-white"
      >
        Import a repository <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </motion.div>
  );
}
