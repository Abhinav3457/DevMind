import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar } from 'lucide-react';

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: { label: string; getRange: () => DateRange }[];
  className?: string;
}

const defaultPresets = [
  {
    label: 'Last 7 days',
    getRange: () => ({
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
      label: 'Last 7 days',
    }),
  },
  {
    label: 'Last 30 days',
    getRange: () => ({
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
      label: 'Last 30 days',
    }),
  },
  {
    label: 'Last 90 days',
    getRange: () => ({
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      end: new Date(),
      label: 'Last 90 days',
    }),
  },
  {
    label: 'This year',
    getRange: () => ({
      start: new Date(new Date().getFullYear(), 0, 1),
      end: new Date(),
      label: 'This year',
    }),
  },
  {
    label: 'All time',
    getRange: () => ({
      start: new Date(2020, 0, 1),
      end: new Date(),
      label: 'All time',
    }),
  },
];

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function DateRangePicker({
  value,
  onChange,
  presets = defaultPresets,
  className = '',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl border border-surface-700/80 bg-surface-800/80 px-4 py-2.5 text-sm text-surface-200 backdrop-blur-sm transition-all hover:border-surface-600 hover:text-surface-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Select date range"
      >
        <Calendar className="h-4 w-4 text-surface-400" />
        <span className="hidden sm:inline">{value.label}</span>
        <span className="sm:hidden">{formatDate(value.start)} - {formatDate(value.end)}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-surface-600/50 bg-surface-900/95 p-2 shadow-2xl backdrop-blur-xl"
            role="listbox"
            aria-label="Date range presets"
          >
            <div className="space-y-1">
              {presets.map((preset) => {
                const range = preset.getRange();
                const isActive = range.label === value.label;
                return (
                  <button
                    key={preset.label}
                    onClick={() => {
                      onChange(range);
                      setIsOpen(false);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-all ${
                      isActive
                        ? 'bg-blue-500/10 text-blue-400 font-medium'
                        : 'text-surface-300 hover:bg-surface-800/50 hover:text-surface-100'
                    }`}
                    role="option"
                    aria-selected={isActive}
                  >
                    <span>{preset.label}</span>
                    <span className="ml-2 text-[10px] text-surface-500">
                      {formatDate(range.start)} - {formatDate(range.end)}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
