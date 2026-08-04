import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot, Search, FileText, FolderTree, Brain, Wrench, Loader2,
  CheckCircle2, XCircle, Clock, Trash2, Play, Sparkles, AlertTriangle,
  History, ListChecks, Terminal, GitCompare, ChevronDown, ArrowRight,
  Lightbulb, Zap, FileCode, Cpu, Check,
} from 'lucide-react';
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer';
import { CodeBlock } from '../components/ui/CodeBlock';
import {
  fetchIndexReports, createAgentRun, fetchAgentRun, fetchAgentRuns, deleteAgentRun,
} from '../services/agent';
import { AgentRun, AgentStep, IndexReportOption } from '../types';

const EXAMPLE_TASKS = [
  'Find and fix the bug in the JWT generation code',
  'Add input validation to the login endpoint',
  'Explain the authentication flow and suggest improvements',
  'Find potential security issues in the auth module',
];

const WORKFLOW_STEPS = [
  { icon: ListChecks, label: 'Plan' },
  { icon: Search, label: 'Explore' },
  { icon: Brain, label: 'Analyze' },
  { icon: Wrench, label: 'Propose' },
];

const TOOL_META: Record<string, { label: string; icon: typeof Search; chip: string }> = {
  search: { label: 'Search codebase', icon: Search, chip: 'bg-blue-500/10 text-blue-400' },
  read_file: { label: 'Read file', icon: FileText, chip: 'bg-cyan-500/10 text-cyan-400' },
  list_files: { label: 'List files', icon: FolderTree, chip: 'bg-purple-500/10 text-purple-400' },
  analyze: { label: 'Analyze findings', icon: Brain, chip: 'bg-amber-500/10 text-amber-400' },
  propose_change: { label: 'Propose change', icon: Wrench, chip: 'bg-emerald-500/10 text-emerald-400' },
};

function StatusBadge({ status }: { status: AgentRun['status'] }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
        <CheckCircle2 className="h-3.5 w-3.5" /> Completed
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400 ring-1 ring-red-500/20">
        <XCircle className="h-3.5 w-3.5" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-400 ring-1 ring-blue-500/20">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
      </span>
      {status === 'queued' ? 'Queued' : 'Running'}
    </span>
  );
}

function StatChip({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-surface-700/50 bg-surface-800/50 px-3 py-2 backdrop-blur-sm">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
        <Icon className="h-3.5 w-3.5 text-blue-400" />
      </div>
      <div>
        <p className="text-sm font-bold leading-none text-surface-100">{value}</p>
        <p className="mt-0.5 text-[10px] leading-none text-surface-500">{label}</p>
      </div>
    </div>
  );
}

function AgentOrb() {
  return (
    <div className="relative flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20">
      <motion.span
        className="absolute inset-0 rounded-full bg-blue-500/25 blur-xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className="absolute inset-0 rounded-full border border-blue-400/30"
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        animate={{ rotate: [0, 12, -12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30 sm:h-14 sm:w-14"
      >
        <Bot className="h-6 w-6 text-white sm:h-7 sm:w-7" />
      </motion.div>
    </div>
  );
}

function ToolOutput({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  const isLong = text.length > 320;
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-surface-700/50 bg-surface-950/80">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-surface-800/40"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
          <Terminal className="h-3 w-3" /> Output
        </span>
        <ChevronDown className={'h-3.5 w-3.5 text-surface-500 transition-transform duration-200 ' + (open ? '' : '-rotate-90')} />
      </button>
      {open && (
        <pre className={'whitespace-pre-wrap p-3 font-mono text-[11px] leading-relaxed text-emerald-300/90 ' + (isLong ? 'max-h-44 overflow-y-auto' : '')}>
          {text}
        </pre>
      )}
    </div>
  );
}

function StepRow({ step, active, last }: { step: AgentStep; active: boolean; last: boolean }) {
  const meta = TOOL_META[step.tool] || { label: 'Tool', icon: Search, chip: 'bg-surface-700/40 text-surface-300' };
  const Icon = meta.icon;
  const paramsText = JSON.stringify(step.params);
  const done = step.status === 'completed';
  const failed = step.status === 'failed';
  const nodeCls = failed
    ? 'border-red-500/40 bg-red-500/15 text-red-400'
    : done
      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
      : active
        ? 'border-blue-500/50 bg-blue-500/15 text-blue-400'
        : 'border-surface-700 bg-surface-800 text-surface-500';

  return (
    <div className="relative flex gap-3">
      {!last && (
        <span className={'absolute left-[15px] top-10 bottom-[-14px] w-px ' + (done ? 'bg-emerald-500/30' : 'bg-surface-700/60')} />
      )}
      <div className={'z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border shadow-lg shadow-black/20 ' + nodeCls}>
        {failed ? <XCircle className="h-4 w-4" /> : done ? <Check className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={
            'rounded-xl border p-3 sm:p-4 transition-colors ' +
            (failed
              ? 'border-red-700/40 bg-red-900/10'
              : active
                ? 'border-blue-600/40 bg-blue-900/10'
                : 'border-surface-700/40 bg-surface-900/40')
          }
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-surface-200">{meta.label}</span>
                <span className="truncate rounded-md bg-surface-800/80 px-1.5 py-0.5 font-mono text-[10px] text-surface-500">{paramsText}</span>
                {active && !done && !failed && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400">
                    <span className="flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1 w-1 animate-bounce rounded-full bg-blue-400"
                          style={{ animationDelay: i * 120 + 'ms' }}
                        />
                      ))}
                    </span>
                    working
                  </span>
                )}
              </div>
              {step.reasoning && (
                <p className="mt-1 text-xs text-surface-400">{step.reasoning}</p>
              )}
              {step.result && <ToolOutput text={step.result} />}
              {step.error && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> {step.error}
                </p>
              )}
            </div>
            <div className="mt-0.5 flex-shrink-0">
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : failed ? (
                <XCircle className="h-4 w-4 text-red-400" />
              ) : active ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              ) : (
                <Clock className="h-4 w-4 text-surface-600" />
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return new Date(iso).toLocaleDateString();
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return '';
  const secs = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (secs < 60) return secs + 's';
  return Math.floor(secs / 60) + 'm ' + (secs % 60) + 's';
}

export function AgentPage() {
  const [reports, setReports] = useState<IndexReportOption[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selected, setSelected] = useState<AgentRun | null>(null);
  const [reportId, setReportId] = useState('');
  const [task, setTask] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);

  const loadRuns = useCallback(async () => {
    try {
      const list = await fetchAgentRuns();
      setRuns(list);
      setSelected((prev) => {
        if (!prev) return prev;
        return list.find((r) => r.id === prev.id) || prev;
      });
    } catch {
      /* interceptor handles errors */
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    fetchIndexReports()
      .then((list) => {
        setReports(list);
        setReportId((prev) => prev || (list[0]?.id ?? ''));
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoadingReports(false));
    loadRuns();
  }, [loadRuns]);

  // Poll the selected run while it is actively working
  const activeRunId = selected && selected.status !== 'completed' && selected.status !== 'failed'
    ? selected.id
    : null;
  useEffect(() => {
    if (!activeRunId) return;
    const timer = setInterval(async () => {
      try {
        const fresh = await fetchAgentRun(activeRunId);
        setSelected(fresh);
        setRuns((prev) => prev.map((r) => (r.id === fresh.id ? fresh : r)));
      } catch {
        /* ignore transient poll failures */
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [activeRunId]);

  const handleCreate = async () => {
    if (!reportId || task.trim().length < 10 || submitting) return;
    setSubmitting(true);
    try {
      const run = await createAgentRun(reportId, task.trim());
      setRuns((prev) => [run, ...prev]);
      setSelected(run);
      setTask('');
    } catch {
      /* interceptor shows the error toast */
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (runId: string) => {
    try {
      await deleteAgentRun(runId);
      setRuns((prev) => prev.filter((r) => r.id !== runId));
      if (selected && selected.id === runId) setSelected(null);
    } catch {
      /* ignore */
    }
  };

  const completedCount = runs.filter((r) => r.status === 'completed').length;
  const activeCount = runs.filter((r) => r.status === 'running' || r.status === 'queued').length;
  const totalChanges = runs.reduce((acc, r) => acc + (r.solution?.changes.length || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl space-y-6"
    >
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-surface-700/30 bg-gradient-to-br from-surface-900/70 via-surface-900/40 to-surface-950/70 p-4 sm:p-6 md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-400">Autonomous coding agent</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-surface-100">
              AI Agent
            </h1>
            <p className="max-w-xl text-xs sm:text-sm text-surface-400">
              Give the agent a task and it will plan its work, explore and read your indexed codebase,
              then hand you a solution with concrete proposed code changes.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <StatChip icon={Cpu} label="Total runs" value={runs.length} />
              <StatChip icon={Zap} label="Completed" value={completedCount} />
              <StatChip icon={Bot} label="Active now" value={activeCount} />
              <StatChip icon={FileCode} label="Changes" value={totalChanges} />
            </div>
          </div>
          <AgentOrb />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
        {/* ── Left rail ─────────────────────────────────────── */}
        <div className="space-y-6 lg:sticky lg:top-24">
          {/* New task card */}
          <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5 backdrop-blur-sm">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <Bot className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-surface-200">Start a new task</h2>
                <p className="text-[10px] text-surface-500">The agent works on one task at a time</p>
              </div>
            </div>

            {/* How it works */}
            <div className="mb-4 flex items-center gap-1 rounded-xl border border-surface-700/40 bg-surface-800/40 p-2">
              {WORKFLOW_STEPS.map((step, i) => (
                <div key={step.label} className="flex flex-1 items-center gap-1">
                  <div className="flex flex-col items-center gap-0.5 flex-1">
                    <step.icon className="h-3.5 w-3.5 text-surface-400" />
                    <span className="text-[9px] font-medium text-surface-500">{step.label}</span>
                  </div>
                  {i < WORKFLOW_STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-surface-600" />}
                </div>
              ))}
            </div>

            <label htmlFor="agent-repo" className="mb-1.5 block text-[11px] font-medium text-surface-400">Repository</label>
            <div className="relative">
              <select
                id="agent-repo"
                value={reportId}
                onChange={(e) => setReportId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-surface-700 bg-surface-800/60 px-3 py-2 pr-8 text-xs text-surface-200 outline-none transition-all focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/10"
              >
                {loadingReports ? (
                  <option>Loading repositories...</option>
                ) : reports.length === 0 ? (
                  <option value="">No indexed repositories — import one from GitHub first</option>
                ) : (
                  reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.repoName} ({r.fileCount} files)
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
            </div>

            <label htmlFor="agent-task" className="mb-1.5 mt-3 block text-[11px] font-medium text-surface-400">Task</label>
            <textarea
              id="agent-task"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Describe what you want the agent to do, e.g. fix the bug in the login flow..."
              className="w-full resize-none rounded-xl border border-surface-700 bg-surface-800/60 px-3 py-2 text-xs leading-relaxed text-surface-200 placeholder:text-surface-600 outline-none transition-all focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/10"
            />
            <div className="mt-1 flex justify-end">
              <span className="text-[10px] text-surface-600">{task.length}/2000</span>
            </div>

            <div className="mt-1 flex flex-wrap gap-1.5">
              {EXAMPLE_TASKS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTask(t)}
                  className="rounded-full border border-surface-700 bg-surface-800/50 px-2.5 py-1 text-[10px] text-surface-400 transition-all hover:scale-[1.03] hover:border-blue-500/50 hover:text-blue-300"
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={handleCreate}
              disabled={!reportId || task.trim().length < 10 || submitting}
              className="group relative mt-4 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {submitting ? 'Starting agent...' : 'Run agent'}
            </button>
          </div>

          {/* Run history */}
          <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-surface-400" />
                <h2 className="text-sm font-semibold text-surface-200">Run history</h2>
              </div>
              <span className="rounded-full bg-surface-800 px-2 py-0.5 text-[10px] font-medium text-surface-400">{runs.length} runs</span>
            </div>
            {loadingRuns ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
              </div>
            ) : runs.length === 0 ? (
              <p className="py-8 text-center text-xs text-surface-500">
                No agent runs yet. Start your first task above.
              </p>
            ) : (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {runs.map((run) => {
                    const isSelected = selected && selected.id === run.id;
                    const isActive = run.status === 'running' || run.status === 'queued';
                    return (
                      <motion.div
                        key={run.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        className="group relative"
                      >
                        <button
                          onClick={() => setSelected(run)}
                          className={
                            'w-full overflow-hidden rounded-xl border p-3 pr-9 text-left transition-all ' +
                            (isSelected
                              ? 'border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/20'
                              : 'border-surface-700/40 bg-surface-800/30 hover:border-surface-600 hover:bg-surface-800/60')
                          }
                        >
                          <span
                            className={
                              'absolute inset-y-0 left-0 w-0.5 ' +
                              (run.status === 'completed' ? 'bg-emerald-500/70' : run.status === 'failed' ? 'bg-red-500/70' : 'bg-blue-500/70')
                            }
                          />
                          <div className="flex items-center justify-between gap-2">
                            <StatusBadge status={run.status} />
                            <span className="text-[10px] text-surface-500">{timeAgo(run.createdAt)}</span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs text-surface-300">{run.task}</p>
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <span className="truncate text-[10px] text-surface-500">{run.repoName}</span>
                            {run.steps.length > 0 && (
                              <span className="flex-shrink-0 text-[10px] text-surface-600">{run.steps.length} steps</span>
                            )}
                          </div>
                          {isActive && (
                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-800">
                              <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                                animate={{ width: ['20%', '85%', '20%'] }}
                                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                              />
                            </div>
                          )}
                        </button>
                        <button
                          onClick={() => void handleDelete(run.id)}
                          aria-label="Delete run"
                          className="absolute right-2 top-2 rounded-md p-1 text-surface-600 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: detail ─────────────────────────────────── */}
        <div className="min-w-0">
          {selected ? <RunDetail run={selected} /> : <EmptyState />}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="relative flex min-h-[480px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-surface-700/50 bg-surface-900/20 p-8 text-center">
      <div className="pointer-events-none absolute -left-16 top-10 h-48 w-48 rounded-full bg-blue-500/5 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-48 w-48 rounded-full bg-purple-500/5 blur-3xl" />
      <AgentOrb />
      <h3 className="mt-6 text-base font-semibold text-surface-200">Your autonomous coding agent awaits</h3>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-surface-400">
        Pick an indexed repository, describe a task, and the agent will plan its work, search and
        read the code, then hand you a solution with concrete proposed changes.
      </p>
      <div className="mt-6 grid w-full max-w-md gap-2 sm:grid-cols-3">
        {[
          { icon: ListChecks, title: 'Plans', desc: 'builds its own step-by-step plan' },
          { icon: Search, title: 'Explores', desc: 'searches and reads your code' },
          { icon: Wrench, title: 'Proposes', desc: 'hands back concrete changes' },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-surface-700/40 bg-surface-800/30 p-3">
            <item.icon className="mx-auto h-4 w-4 text-blue-400" />
            <p className="mt-1.5 text-xs font-semibold text-surface-200">{item.title}</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-surface-500">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RunDetail({ run }: { run: AgentRun }) {
  const running = run.status === 'running' || run.status === 'queued';
  const activeStepIndex = run.steps.findIndex((s) => s.status === 'running');
  const stepsDone = run.steps.filter((s) => s.status === 'completed').length;
  const stepsTotal = Math.max(run.steps.length, run.plan.length) || 1;
  const progressPct = Math.round((stepsDone / stepsTotal) * 100);
  const duration = formatDuration(run.startedAt, run.completedAt);

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-surface-700/40 bg-gradient-to-br from-surface-900/70 to-surface-950/70 p-4 sm:p-6"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <StatusBadge status={run.status} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-surface-500">
            <span className="inline-flex items-center gap-1">
              <FileCode className="h-3 w-3" /> {run.repoName}
            </span>
            <span>·</span>
            <span>{formatTime(run.createdAt)}</span>
            {duration && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {duration}
                </span>
              </>
            )}
          </div>
        </div>
        <h2 className="relative z-10 mt-3 text-sm sm:text-base font-semibold leading-relaxed text-surface-100">{run.task}</h2>

        {running && (
          <div className="relative z-10 mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 font-medium text-blue-400">
                <Loader2 className="h-3 w-3 animate-spin" /> Working...
              </span>
              <span className="text-surface-500">
                {run.steps.length === 0 && run.plan.length === 0 ? 'Starting...' : stepsDone + ' of ' + stepsTotal + ' steps'}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-800">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                initial={{ width: 0 }}
                animate={{ width: progressPct + '%' }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {run.status === 'failed' && run.error && (
          <div className="relative z-10 mt-3 flex items-start gap-2 rounded-xl border border-red-700/40 bg-red-900/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
            <p className="text-xs leading-relaxed text-red-300">{run.error}</p>
          </div>
        )}
      </motion.div>

      {/* Plan */}
      {run.plan.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5"
        >
          <div className="mb-4 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-surface-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-400">Plan</h3>
          </div>
          <div className="space-y-0">
            {run.plan.map((p, i) => {
              const step = run.steps[i];
              const state = step ? step.status : 'pending';
              const nodeCls = state === 'completed'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                : state === 'running'
                  ? 'border-blue-500/50 bg-blue-500/15 text-blue-400'
                  : state === 'failed'
                    ? 'border-red-500/40 bg-red-500/15 text-red-400'
                    : 'border-surface-700 bg-surface-800 text-surface-500';
              return (
                <div key={i} className="relative flex gap-3">
                  {i < run.plan.length - 1 && (
                    <span className={'absolute left-[15px] top-10 bottom-[-14px] w-px ' + (state === 'completed' ? 'bg-emerald-500/30' : 'bg-surface-700/60')} />
                  )}
                  <div className={'z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-[11px] font-bold shadow-lg shadow-black/20 ' + nodeCls}>
                    {state === 'completed' ? <Check className="h-4 w-4" /> : state === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : state === 'failed' ? <XCircle className="h-4 w-4" /> : i + 1}
                  </div>
                  <div className="flex-1 pb-5">
                    <div className="flex flex-wrap items-center gap-2 pt-1.5">
                      <span className={'text-xs ' + (state === 'pending' ? 'font-medium text-surface-400' : 'font-semibold text-surface-100')}>{p.action}</span>
                      <span className={'rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ' + (TOOL_META[p.tool]?.chip || 'bg-surface-800 text-surface-400')}>
                        {p.tool}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Steps */}
      {run.steps.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-surface-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-400">Progress</h3>
            </div>
            <span className="rounded-full bg-surface-800 px-2 py-0.5 text-[10px] font-medium text-surface-400">
              {stepsDone}/{stepsTotal} steps
            </span>
          </div>
          {run.steps.map((step, i) => (
            <StepRow key={step._id} step={step} active={i === activeStepIndex} last={i === run.steps.length - 1} />
          ))}
        </motion.div>
      )}

      {/* Solution */}
      {run.status === 'completed' && run.solution && (
        <div className="space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-emerald-700/30 bg-gradient-to-br from-emerald-900/20 to-surface-900/40 p-4 sm:p-5"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
            <div className="relative z-10 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-surface-100">Solution</h3>
            </div>
            {run.solution.summary && (
              <p className="relative z-10 mt-2.5 text-xs leading-relaxed text-surface-300">{run.solution.summary}</p>
            )}
          </motion.div>

          {run.solution.changes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5"
            >
              <div className="mb-4 flex items-center gap-2">
                <GitCompare className="h-4 w-4 text-surface-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-400">Proposed changes</h3>
                <span className="rounded-full bg-surface-800 px-2 py-0.5 text-[10px] font-medium text-surface-400">{run.solution.changes.length}</span>
              </div>
              <div className="space-y-5">
                {run.solution.changes.map((c, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="rounded-xl border border-surface-700/40 bg-surface-950/40 p-3 sm:p-4"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                        <FileCode className="h-3.5 w-3.5 text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-semibold text-blue-400">{c.filePath}</p>
                        <p className="mt-0.5 text-xs font-medium text-surface-200">{c.title}</p>
                      </div>
                    </div>
                    {c.reasoning && (
                      <p className="mt-2 text-[11px] leading-relaxed text-surface-400">{c.reasoning}</p>
                    )}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">
                          <XCircle className="h-3 w-3" /> Before
                        </p>
                        <CodeBlock className="language-typescript">{c.before}</CodeBlock>
                      </div>
                      <div>
                        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> After
                        </p>
                        <CodeBlock className="language-typescript">{c.after}</CodeBlock>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {run.solution.report && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-6"
            >
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-400">Report</h3>
              </div>
              <MarkdownRenderer content={run.solution.report} />
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
