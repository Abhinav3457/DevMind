import { useMemo } from 'react';
import { PieChart } from 'lucide-react';
import type { AnalyticsData } from '../../types';
import { BreakdownDoughnut } from './BreakdownDoughnut';

interface TypeMeta {
  label: string;
  color: string;
}

/** Known activity log types → friendly label + brand color. */
const TYPE_META: Record<string, TypeMeta> = {
  repo_imported: { label: 'Repos imported', color: '#34d399' },
  repo_indexed: { label: 'Repos indexed', color: '#22d3ee' },
  review_completed: { label: 'Code reviews', color: '#fbbf24' },
  doc_generated: { label: 'Docs generated', color: '#c084fc' },
  practice_solved: { label: 'Problems solved', color: '#60a5fa' },
};

const FALLBACK: TypeMeta = { label: 'Other events', color: '#94a3b8' };

interface OperationBreakdownProps {
  operationBreakdown: AnalyticsData['operationBreakdown'];
}

/** Card body: lifetime mix of activity events as a doughnut + legend. */
export function OperationBreakdown({ operationBreakdown }: OperationBreakdownProps) {
  const slices = useMemo(
    () =>
      operationBreakdown
        .filter((entry) => entry.count > 0)
        .map((entry) => {
          const meta = TYPE_META[entry.type] ?? {
            ...FALLBACK,
            label: entry.type.replace(/_/g, ' '),
          };
          return { label: meta.label, value: entry.count, color: meta.color };
        })
        .sort((a, b) => b.value - a.value),
    [operationBreakdown],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-surface-800 pb-3 sm:mb-5">
        <div className="flex min-w-0 items-center gap-2">
          <PieChart className="h-4 w-4 flex-shrink-0 text-surface-500" />
          <h2 className="truncate text-xs font-semibold uppercase tracking-wider text-surface-300">
            Operation Mix
          </h2>
        </div>
        <span className="text-[11px] text-surface-500">All-time</span>
      </div>

      {slices.length > 0 ? (
        <div className="flex min-h-0 flex-1 items-center">
          <div className="w-full">
            <BreakdownDoughnut slices={slices} centerLabel="Events" />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-surface-800 px-4 py-10 text-center">
          <p className="text-xs font-medium text-surface-400">No operations recorded yet</p>
          <p className="mt-1 text-[11px] text-surface-500">
            Your event mix will appear once you start using the workspace.
          </p>
        </div>
      )}
    </div>
  );
}
