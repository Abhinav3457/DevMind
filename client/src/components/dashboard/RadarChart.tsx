import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

interface RadarChartProps {
  labels: string[];
  values: number[];
  color?: string;
  max?: number;
}

/** Spider/radar chart for the Code Quality card. */
export function RadarChart({ labels, values, color = '#a855f7', max = 100 }: RadarChartProps) {
  const data = {
    labels,
    datasets: [
      {
        label: 'Score',
        data: values,
        backgroundColor: `${color}33`,
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: color,
        pointBorderColor: 'rgb(var(--surface-900))',
        pointBorderWidth: 1.5,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
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
        callbacks: {
          label: (ctx: { parsed: { r: number }; label: string }) => `${ctx.label}: ${ctx.parsed.r.toFixed(0)}/${max}`,
        },
      },
    },
    scales: {
      r: {
        beginAtZero: true,
        suggestedMax: max,
        angleLines: { color: 'rgb(var(--surface-800))' },
        grid: { color: 'rgb(var(--surface-800))' },
        pointLabels: { color: 'rgb(var(--surface-400))', font: { size: 11 } },
        ticks: { display: false, stepSize: 25 },
      },
    },
    animation: { duration: 1000, easing: 'easeOutQuart' as const },
  };

  return <Radar data={data} options={options} />;
}
