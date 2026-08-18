import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Tailwind gradient classes for the icon tile, e.g. "from-blue-500 to-purple-600" */
  gradient?: string;
  /** Optional right-aligned action controls (buttons, toggles, selects) */
  actions?: React.ReactNode;
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  gradient = 'from-blue-500 to-purple-600',
  actions,
}: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <div className="min-w-0 space-y-1 sm:space-y-2">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className={`flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg shadow-black/20`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <h1 className="truncate text-xl font-bold tracking-tight text-surface-100 sm:text-2xl">{title}</h1>
        </div>
        {description && (
          <p className="pl-[46px] text-xs text-surface-400 sm:pl-[52px] sm:text-sm">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>}
    </motion.div>
  );
}
