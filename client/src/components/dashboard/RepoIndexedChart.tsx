import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import type { ChartOptions, ScriptableContext, TooltipItem } from 'chart.js';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Github, ArrowRight } from 'lucide-react';
import type { ReposIndexedData } from '../../services/analytics';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const TEAL = '#2dd4bf';
const PURPLE = '#a855f7';

interface RepoIndexedChartProps {
  data?: ReposIndexedData;
  loading: boolean;
  error?: boolean;
}

/** "Repositories indexed" over time, drawn as gradient bars. */
export function RepoIndexedChart({ data, loading, error }: RepoIndexedChartProps) {
  const points = useMemo(() => data?.points ?? [], [data]);
  const total = data?.total ?? 0;
  const latest = data?.latest ?? null;

  const chartData = useMemo(
    () => ({
      labels: points.map((point) => point.label),
      datasets: [
        {
          label: 'Indexed',
          data: points.map((point) => point.count),
          borderRadius: 4,
          maxBarThickness: 42,
          backgroundColor: (context: ScriptableContext<'bar'>) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return `${TEAL}cc`;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, PURPLE);
            gradient.addColorStop(1, TEAL);
            return gradient;
          },
          hoverBackgroundColor: TEAL,
        },
      ],
    }),
    [points],
  );

  const options: ChartOptions<'bar'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgb(var(--surface-900))',
          titleColor: 'rgb(var(--surface-100))',
          bodyColor: 'rgb(var(--surface-300))',
          borderColor: 'rgb(var(--surface-700))',
          borderWidth: 1,
          padding: { top: 8, bottom: 8, left: 12, right: 12 },
          cornerRadius: 10,
          displayColors: false,
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 12 },
          callbacks: {
            label: (item: TooltipItem<'bar'>) => {
              const point = points[item.dataIndex];
              const running = point ? point.cumulative : 0;
              return `${item.parsed.y ?? 0} indexed · ${running} total`;
            },
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
    [points],
  );

  return (
    <div className="flex min-h-[360px] flex-col rounded-xl border border-surface-800 bg-surface-900 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
          <Github className="h-4 w-4 text-purple-400" />
        </div>
        <h2 className="text-sm font-semibold text-surface-200">Repositories Indexed</h2>
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
              <p className="text-[11px] uppercase tracking-wider text-surface-500">Total indexed</p>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-surface-200">
                {latest ? latest.name : '—'}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-surface-500">
                {latest ? `Latest · ${formatDate(latest.indexedAt)}` : 'Latest index'}
              </p>
            </div>
          </div>

          <div className="mt-4 h-56">
            <Bar data={chartData} options={options} />
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
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10">
        <Github className="h-6 w-6 text-purple-400" />
      </div>
      <p className="text-sm font-medium text-surface-300">No repositories indexed yet</p>
      <p className="mt-1 text-xs text-surface-500">Import a repository to start building your index.</p>
      <Link
        to="/github"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-surface-700 bg-surface-800/70 px-3 py-1.5 text-xs font-medium text-surface-200 transition-colors hover:border-purple-500/40 hover:text-white"
      >
        Import a repository <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </motion.div>
  );
}
