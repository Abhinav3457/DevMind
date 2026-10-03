import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Legend,
  Tooltip,
} from 'chart.js';
import type { ChartOptions, ScriptableContext, TooltipItem } from 'chart.js';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Trophy, ArrowRight } from 'lucide-react';
import type { ProblemsGranularity, ProblemsSolvedData } from '../../services/analytics';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Legend, Tooltip);

const BLUE = '#3b82f6';
const EASY = '#10b981';
const MEDIUM = '#f59e0b';
const HARD = '#ef4444';

const GRANULARITIES: ProblemsGranularity[] = ['daily', 'weekly', 'monthly'];

interface ProblemsSolvedChartProps {
  data?: ProblemsSolvedData;
  loading: boolean;
  error?: boolean;
  granularity: ProblemsGranularity;
  onGranularityChange: (granularity: ProblemsGranularity) => void;
}

/**
 * "Problems solved" trend for the dashboard. A blue filled area tracks the
 * total per period, with thin per-difficulty lines overlaid.
 */
export function ProblemsSolvedChart({
  data,
  loading,
  error,
  granularity,
  onGranularityChange,
}: ProblemsSolvedChartProps) {
  const points = useMemo(() => data?.points ?? [], [data]);
  const total = data?.total ?? 0;
  const thisWeek = data?.thisWeek ?? 0;
  const byDifficulty = data?.byDifficulty ?? { easy: 0, medium: 0, hard: 0 };
  const hasWindowData = points.some((point) => point.total > 0);

  const chartData = useMemo(
    () => ({
      labels: points.map((point) => point.label),
      datasets: [
        {
          label: 'Easy',
          data: points.map((point) => point.easy),
          borderColor: EASY,
          backgroundColor: EASY,
          borderWidth: 1.5,
          tension: 0.35,
          pointRadius: points.length <= 2 ? 3 : 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Medium',
          data: points.map((point) => point.medium),
          borderColor: MEDIUM,
          backgroundColor: MEDIUM,
          borderWidth: 1.5,
          tension: 0.35,
          pointRadius: points.length <= 2 ? 3 : 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Hard',
          data: points.map((point) => point.hard),
          borderColor: HARD,
          backgroundColor: HARD,
          borderWidth: 1.5,
          tension: 0.35,
          pointRadius: points.length <= 2 ? 3 : 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Solved',
          data: points.map((point) => point.total),
          borderColor: BLUE,
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: points.length <= 2 ? 4 : 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: BLUE,
          pointHoverBorderColor: 'rgb(var(--surface-950))',
          pointHoverBorderWidth: 2,
          fill: true,
          backgroundColor: (context: ScriptableContext<'line'>) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return `${BLUE}22`;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, `${BLUE}55`);
            gradient.addColorStop(1, `${BLUE}00`);
            return gradient;
          },
        },
      ],
    }),
    [points],
  );

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
            color: 'rgb(var(--surface-400))',
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 12,
            font: { size: 11 },
          },
        },
        tooltip: {
          backgroundColor: 'rgb(var(--surface-900))',
          titleColor: 'rgb(var(--surface-100))',
          bodyColor: 'rgb(var(--surface-300))',
          borderColor: 'rgb(var(--surface-700))',
          borderWidth: 1,
          padding: { top: 8, bottom: 8, left: 12, right: 12 },
          cornerRadius: 10,
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 12 },
          callbacks: {
            label: (item: TooltipItem<'line'>) => ` ${item.dataset.label}: ${item.parsed.y ?? 0}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: 'rgb(var(--surface-500))', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgb(var(--surface-800) / 0.6)' },
          border: { display: false },
          ticks: { color: 'rgb(var(--surface-500))', font: { size: 10 }, maxTicksLimit: 4, precision: 0 },
        },
      },
      animation: { duration: 900, easing: 'easeOutQuart' },
    }),
    [],
  );

  return (
    <div className="flex min-h-[360px] flex-col rounded-xl border border-surface-800 bg-surface-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
            <Trophy className="h-4 w-4 text-blue-400" />
          </div>
          <h2 className="text-sm font-semibold text-surface-200">Problems Solved</h2>
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
        <ChartMessage title="Couldn't load practice analytics" hint="Pull to refresh or try again in a moment." />
      ) : !data || total === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className="text-2xl font-bold tabular-nums text-surface-100">{total}</p>
              <p className="text-[11px] uppercase tracking-wider text-surface-500">Total solved</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-blue-400">{thisWeek}</p>
              <p className="text-[11px] uppercase tracking-wider text-surface-500">This week</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-surface-400">
              <span><span className="text-emerald-400">{byDifficulty.easy}</span> easy</span>
              <span><span className="text-amber-400">{byDifficulty.medium}</span> medium</span>
              <span><span className="text-red-400">{byDifficulty.hard}</span> hard</span>
            </div>
          </div>

          {!hasWindowData ? (
            <ChartMessage
              title="No solves in this period"
              hint="Switch the range or solve a problem to see the trend."
            />
          ) : (
            <div className="mt-4 h-56">
              <Line data={chartData} options={options} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="mt-4 flex flex-1 flex-col">
      <div className="mb-4 flex gap-6">
        <div className="h-10 w-20 animate-pulse rounded-lg bg-surface-800" />
        <div className="h-10 w-20 animate-pulse rounded-lg bg-surface-800" />
      </div>
      <div className="h-56 animate-pulse rounded-xl bg-surface-800/70" />
    </div>
  );
}

function ChartMessage({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <p className="text-sm font-medium text-surface-300">{title}</p>
      <p className="mt-1 text-xs text-surface-500">{hint}</p>
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
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10">
        <Trophy className="h-6 w-6 text-rose-400" />
      </div>
      <p className="text-sm font-medium text-surface-300">No problems solved yet</p>
      <p className="mt-1 text-xs text-surface-500">Solve a challenge in the Practice Arena to see your progress here.</p>
      <Link
        to="/practice"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-surface-700 bg-surface-800/70 px-3 py-1.5 text-xs font-medium text-surface-200 transition-colors hover:border-blue-500/40 hover:text-white"
      >
        Try the Practice Arena <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </motion.div>
  );
}
