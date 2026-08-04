import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, Loader2, RefreshCw, Settings2, XCircle,
} from 'lucide-react';
import { fetchAIHealth } from '../../services/aiHealth';
import { AIHealthReport, AIProviderHealth } from '../../types';

const POLL_INTERVAL_MS = 120000;

function ProviderChip(provider: AIProviderHealth) {
  const dotClass = !provider.configured
    ? 'bg-surface-600'
    : provider.available
      ? 'bg-emerald-400'
      : 'bg-red-400';
  const name = provider.provider === 'gemini' ? 'Gemini' : 'Groq';
  const label = !provider.configured
    ? 'not configured'
    : provider.available
      ? provider.latencyMs !== null
        ? (provider.latencyMs / 1000).toFixed(1) + 's'
        : 'ok'
      : 'unavailable';
  const labelClass = !provider.configured
    ? 'text-surface-500'
    : provider.available
      ? 'text-emerald-400/90'
      : 'text-red-400/90';

  return (
    <span
      title={provider.error ? provider.error : undefined}
      className="inline-flex items-center gap-1.5 rounded-full border border-surface-700 bg-surface-800/70 px-2 py-0.5 text-[10px] font-medium text-surface-300"
    >
      <span className={'h-1.5 w-1.5 rounded-full flex-shrink-0 ' + dotClass} />
      {name}
      <span className={'font-normal ' + labelClass}>&middot; {label}</span>
    </span>
  );
}

/**
 * Polls GET /api/v1/ai/health and shows whether the AI providers are
 * reachable, so users can see failures before running code reviews.
 */
export function AIProviderBanner() {
  const [report, setReport] = useState<AIHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const inFlight = useRef(false);

  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      setReport(await fetchAIHealth());
      setFetchFailed(false);
    } catch {
      setFetchFailed(true);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  // Refresh immediately when the tab becomes visible again, and pause the
  // interval while hidden so an open-but-unfocused tab never burns API quota.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  useEffect(() => {
    check();
    const interval = setInterval(() => {
      if (!document.hidden) void check();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [check]);

  // First check failed entirely — can't even ask. (If we already have a
  // report, keep showing the last-known-good state instead of flipping the
  // whole banner on a transient blip.)
  if (fetchFailed && !report) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-700/40 bg-amber-900/10 px-3 sm:px-4 py-2.5"
      >
        <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
        <p className="min-w-0 flex-1 text-xs text-amber-200">
          Could not reach the AI health service — the server may be offline.
        </p>
        <button
          onClick={check}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg border border-surface-700 bg-surface-800/70 px-2 py-1 text-[10px] font-medium text-surface-300 transition-colors hover:text-surface-100 disabled:opacity-50"
        >
          <RefreshCw className={'h-3 w-3 ' + (loading ? 'animate-spin' : '')} />
          Retry
        </button>
      </motion.div>
    );
  }

  // First check still in flight.
  if (!report) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-surface-700/50 bg-surface-900/40 px-3 sm:px-4 py-2.5 text-xs text-surface-400">
        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
        Checking AI providers...
      </div>
    );
  }

  const isAll = report.overall === 'all';
  const isPartial = report.overall === 'partial';
  const isNone = report.overall === 'none';

  let icon;
  let borderClass;
  let messageClass;
  let message;
  if (isAll) {
    icon = <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />;
    borderClass = 'border-emerald-700/40 bg-emerald-900/10';
    messageClass = 'text-surface-300';
    message = 'All AI providers operational — code review, chat, and docs are ready.';
  } else if (isPartial) {
    icon = <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />;
    borderClass = 'border-amber-700/40 bg-amber-900/10';
    messageClass = 'text-amber-200';
    message = 'Some AI providers are unavailable — reviews will fall back to what is reachable.';
  } else if (isNone) {
    icon = <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />;
    borderClass = 'border-red-700/40 bg-red-900/10';
    messageClass = 'text-red-200';
    message = 'AI providers are unreachable right now — AI features may fail. Try again shortly.';
  } else {
    icon = <Settings2 className="h-4 w-4 text-surface-400 flex-shrink-0" />;
    borderClass = 'border-surface-700 bg-surface-900/40';
    messageClass = 'text-surface-400';
    message = 'No AI provider is configured. Set GEMINI_API_KEY or GROQ_API_KEY on the server.';
  }

  const lastChecked = new Date(report.checkedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 sm:px-4 py-2.5 ' + borderClass}
    >
      {icon}
      <p className={'min-w-0 flex-1 text-xs ' + messageClass}>
        {message}
        {fetchFailed && (
          <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-amber-400/90">
            <AlertTriangle className="h-3 w-3" /> Couldn&apos;t refresh — showing last check.
          </span>
        )}
      </p>
      <div className="flex items-center gap-1.5">
        {report.providers.map((p) => <ProviderChip key={p.provider} {...p} />)}
      </div>
      <span className="hidden lg:inline text-[10px] text-surface-500">updated {lastChecked}</span>
      <button
        onClick={check}
        disabled={loading}
        title="Check again"
        aria-label="Re-check AI providers"
        className="flex items-center gap-1 rounded-lg border border-surface-700 bg-surface-800/70 px-2 py-1 text-[10px] font-medium text-surface-300 transition-colors hover:text-surface-100 hover:border-surface-600 disabled:opacity-50"
      >
        <RefreshCw className={'h-3 w-3 ' + (loading ? 'animate-spin' : '')} />
        <span className="hidden sm:inline">Check</span>
      </button>
    </motion.div>
  );
}
