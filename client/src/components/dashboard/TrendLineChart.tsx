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
import type { ScriptableContext, TooltipItem } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

interface TrendLineChartProps {
  labels: string[];
  values: number[];
  color?: string;
  label?: string;
}

/** Compact filled line chart used for the Repositories trend card. */
export function TrendLineChart({ labels, values, color = '#22d3ee', label = 'Activity' }: TrendLineChartProps) {
  const data = {
    labels,
    datasets: [
      {
        label,
        data: values,
        borderColor: color,
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: 'rgb(var(--surface-950))',
        pointHoverBorderWidth: 2,
        fill: true,
        backgroundColor: (context: ScriptableContext<'line'>) => {
          const { ctx, chartArea } = context.chart;
          if (!chartArea) return `${color}22`;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, `${color}55`);
          gradient.addColorStop(1, `${color}00`);
          return gradient;
        },
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
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
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 12 },
        callbacks: {
          label: (item: TooltipItem<'line'>) => `${(item.parsed.y ?? 0).toLocaleString()}`,
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
    animation: { duration: 900, easing: 'easeOutQuart' as const },
  };

  return <Line data={data} options={options} />;
}
