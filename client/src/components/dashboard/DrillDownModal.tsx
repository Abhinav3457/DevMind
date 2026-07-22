import { motion, AnimatePresence } from 'framer-motion';
import { X, BarChart3, Download } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface DrillDownMetric {
  label: string;
  value: string | number;
  change?: number;
  color?: string;
}

interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  metrics: DrillDownMetric[];
  chart?: React.ReactNode;
  footer?: React.ReactNode;
}

export function DrillDownModal({
  isOpen,
  onClose,
  title,
  description,
  metrics,
  chart,
  footer,
}: DrillDownModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-700/50 bg-gray-900/95 p-6 shadow-2xl backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 h-8 w-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 transition-all"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-100">{title}</h2>
                {description && (
                  <p className="text-sm text-gray-500 mt-1">{description}</p>
                )}
              </div>
            </div>

            {/* Metrics grid */}
            {metrics.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {metrics.map((metric, index) => (
                  <motion.div
                    key={metric.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-4 text-center"
                  >
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{metric.label}</p>
                    <p className={`text-2xl font-bold ${metric.color || 'text-gray-100'}`}>{metric.value}</p>
                    {metric.change !== undefined && (
                      <p className={`text-xs mt-1 ${metric.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {metric.change >= 0 ? '+' : ''}{metric.change}% vs last period
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Chart area */}
            {chart && (
              <div className="mb-6">
                {chart}
              </div>
            )}

            {/* Footer */}
            {footer && (
              <div className="border-t border-gray-800/50 pt-4 mt-2">
                {footer}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-800/50">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-700/50 bg-gray-800/50 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-700/50 transition-all"
              >
                Close
              </button>
              <button className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all">
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
