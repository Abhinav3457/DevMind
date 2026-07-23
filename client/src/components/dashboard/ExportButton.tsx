import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileJson, FileText, Image, Table, ChevronDown } from 'lucide-react';

interface ExportButtonProps {
  onExport: (format: 'csv' | 'json' | 'png' | 'txt') => Promise<void> | void;
  className?: string;
}

export function ExportButton({ onExport, className = '' }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportedFormat, setExportedFormat] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const formats = [
    {
      id: 'csv' as const,
      label: 'CSV',
      icon: Table,
      description: 'Spreadsheet compatible',
    },
    {
      id: 'json' as const,
      label: 'JSON',
      icon: FileJson,
      description: 'Raw data format',
    },
    {
      id: 'png' as const,
      label: 'PNG',
      icon: Image,
      description: 'Screenshot image',
    },
    {
      id: 'txt' as const,
      label: 'Text',
      icon: FileText,
      description: 'Plain text report',
    },
  ];

  const handleExport = async (format: 'csv' | 'json' | 'png' | 'txt') => {
    setExporting(format);
    try {
      await onExport(format);
      setExportedFormat(format);
      setTimeout(() => setExportedFormat(null), 2000);
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500/10 to-blue-600/10 border border-blue-500/20 px-4 py-2.5 text-sm font-medium text-blue-400 transition-all hover:bg-blue-500/20 hover:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-48 rounded-2xl border border-surface-600/50 bg-surface-900/95 p-2 shadow-2xl backdrop-blur-xl"
            role="menu"
          >
            {formats.map((fmt) => {
              const Icon = fmt.icon;
              const isLoading = exporting === fmt.id;
              const isDone = exportedFormat === fmt.id;
              return (
                <button
                  key={fmt.id}
                  onClick={() => handleExport(fmt.id)}
                  disabled={!!exporting}
                  className="w-full rounded-lg px-3 py-2.5 flex items-center gap-3 text-sm text-surface-300 hover:text-surface-100 hover:bg-surface-800/50 transition-all disabled:opacity-50"
                  role="menuitem"
                >
                  <Icon className="h-4 w-4 text-surface-400 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <span className="font-medium">{fmt.label}</span>
                    <p className="text-[10px] text-surface-500">{fmt.description}</p>
                  </div>
                  {isLoading && (
                    <svg className="animate-spin h-4 w-4 text-blue-400" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  {isDone && (
                    <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
