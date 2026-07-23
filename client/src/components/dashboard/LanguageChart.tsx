import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { motion } from 'framer-motion';

ChartJS.register(ArcElement, Tooltip, Legend);

interface LanguageData {
  name: string;
  files: number;
  percentage: number;
  color: string;
}

interface LanguageChartProps {
  languages: LanguageData[];
}

export function LanguageChart({ languages }: LanguageChartProps) {
  const topLanguages = languages.slice(0, 8);
  const others = languages.slice(8);
  const otherFiles = others.reduce((sum, l) => sum + l.files, 0);

  const labels = otherFiles > 0
    ? [...topLanguages.map((l) => l.name), 'Other']
    : topLanguages.map((l) => l.name);

  const data = {
    labels,
    datasets: [
      {
        data: otherFiles > 0
          ? [...topLanguages.map((l) => l.files), otherFiles]
          : topLanguages.map((l) => l.files),
        backgroundColor: otherFiles > 0
          ? [...topLanguages.map((l) => l.color + 'cc'), '#6b7280cc']
          : topLanguages.map((l) => l.color + 'cc'),
        borderWidth: 3,
        borderColor: 'var(--surface-950)',
        hoverBackgroundColor: otherFiles > 0
          ? [...topLanguages.map((l) => l.color), '#6b7280']
          : topLanguages.map((l) => l.color),
        hoverBorderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'var(--surface-900)',
        titleColor: 'var(--surface-100)',
        bodyColor: 'var(--surface-300)',
        borderColor: 'var(--surface-600)',
        borderWidth: 1,
        padding: { top: 12, bottom: 12, left: 16, right: 16 },
        cornerRadius: 12,
        titleFont: { size: 13, weight: 'bold' as const },
        bodyFont: { size: 12 },
        displayColors: true,
        boxPadding: 6,
        callbacks: {
          label: (context: { parsed: number; label: string }) => {
            const total = context.parsed;
            const langData = languages.find((l) => l.name === context.label);
            const pct = langData ? langData.percentage : Math.round((total / languages.reduce((s, l) => s + l.files, 0)) * 100);
            return ` ${total.toLocaleString()} files (${pct}%)`;
          },
        },
      },
    },
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 1200,
      easing: 'easeOutQuart' as const,
    },
  };

  if (languages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-surface-800/50 flex items-center justify-center">
            <svg className="h-6 w-6 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <p className="text-sm text-surface-400">No language data available</p>
          <p className="text-xs text-surface-500 mt-1">Index a repository to see language breakdown</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="relative h-48 w-48">
        <Doughnut data={data} options={options} />
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-surface-100">{topLanguages.length}</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-surface-400">Languages</span>
        </div>
      </div>
      
      {/* Custom Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {topLanguages.slice(0, 6).map((lang, index) => (
          <motion.div
            key={lang.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.05 }}
            className="flex items-center gap-2"
          >
            <span 
              className="h-2.5 w-2.5 rounded-full flex-shrink-0" 
              style={{ backgroundColor: lang.color }} 
            />
            <span className="text-xs text-surface-300 truncate">{lang.name}</span>
            <span className="text-xs font-medium text-surface-400">{lang.percentage}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
