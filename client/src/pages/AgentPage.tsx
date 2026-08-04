import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, Search, FileText, FolderTree, Brain, Wrench, Loader2,
  CheckCircle2, XCircle, Clock, Trash2, Play, Sparkles, AlertTriangle,
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

const TOOL_META: Record<string, { label: string; icon: typeof Search; chip: string }> = {
  search: { label: 'Search', icon: Search, chip: 'bg-blue-500/10 text-blue-400' },
  read_file: { label: 'Read file', icon: FileText, chip: 'bg-cyan-500/10 text-cyan-400' },
  list_files: { label: 'List files', icon: FolderTree, chip: 'bg-purple-500/10 text-purple-400' },
  analyze: { label: 'Analyze', icon: Brain, chip: 'bg-amber-500/10 text-amber-400' },
  propose_change: { label: 'Propose change', icon: Wrench, chip: 'bg-emerald-500/10 text-emerald-400' },
};

function StatusBadge({ status }: { status: AgentRun['status'] }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Completed
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
        <XCircle className="h-3.5 w-3.5" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {status === 'queued' ? 'Queued' : 'Running'}
    </span>
  );
}

function StepRow({ step, active }: { step: AgentStep; active: boolean }) {
  const meta = TOOL_META[step.tool] || { label: 'Tool', icon: Search, chip: 'bg-surface-700/40 text-surface-300' };
  const Icon = meta.icon;
  const paramsText = JSON.stringify(step.params);
  const done = step.status === 'completed';
  const failed = step.status === 'failed';

  return (
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
        <div className={
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ' +
          (failed ? 'bg-red-500/10 text-red-400' : meta.chip)
        }>
          {failed ? <XCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-surface-200">{meta.label}</span>
            <span className="truncate text-[11px] text-surface-500">{paramsText}</span>
            {active && !done && !failed && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400">
                <Loader2 className="h-3 w-3 animate-spin" /> working
              </span>
            )}
          </div>
          {step.reasoning && (
            <p className="mt-1 text-xs text-surface-400">{step.reasoning}</p>
          )}
          {step.result && (
            <pre className="mt-2 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-950/70 p-3 font-mono text-[11px] leading-relaxed text-surface-300">
              {step.result}
            </pre>
          )}
          {step.error && (
            <p className="mt-2 text-[11px] text-red-400">{step.error}</p>
          )}
        </div>
        <div className="mt-1 flex-shrink-0">
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
  );
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl space-y-6"
    >
      {/* ── Page header ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-400" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-400">Autonomous coding agent</span>
        </div>
        <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-surface-100">AI Agent</h1>
        <p className="mt-1 max-w-2xl text-xs sm:text-sm text-surface-400">
          Give the agent a task and it will plan its work, search and read your indexed codebase,
          then hand you a solution with concrete proposed code changes.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
        {/* ── Left rail ─────────────────────────────────────── */}
        <div className="space-y-6 lg:sticky lg:top-24">
          {/* New task card */}
          <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5 backdrop-blur-sm">
            <div className="mb-3 flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-surface-200">Start a new task</h2>
            </div>

            <label className="mb-1.5 block text-[11px] font-medium text-surface-400">Repository</label>
            <select
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
              className="w-full rounded-xl border border-surface-700 bg-surface-800/60 px-3 py-2 text-xs text-surface-200 outline-none transition-colors focus:border-blue-500/60"
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

            <label className="mb-1.5 mt-3 block text-[11px] font-medium text-surface-400">Task</label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Describe what you want the agent to do, e.g. fix the bug in the login flow..."
              className="w-full resize-none rounded-xl border border-surface-700 bg-surface-800/60 px-3 py-2 text-xs leading-relaxed text-surface-200 placeholder:text-surface-600 outline-none transition-colors focus:border-blue-500/60"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLE_TASKS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTask(t)}
                  className="rounded-full border border-surface-700 bg-surface-800/50 px-2.5 py-1 text-[10px] text-surface-400 transition-colors hover:border-surface-500 hover:text-surface-200"
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={handleCreate}
              disabled={!reportId || task.trim().length < 10 || submitting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {submitting ? 'Starting agent...' : 'Run agent'}
            </button>
          </div>

          {/* Run history */}
          <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-surface-200">Run history</h2>
              <span className="text-[10px] text-surface-500">{runs.length} runs</span>
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
                {runs.map((run) => (
                  <div key={run.id} className="group relative">
                    <button
                      onClick={() => setSelected(run)}
                      className={
                        'w-full rounded-xl border p-3 pr-9 text-left transition-all ' +
                        (selected && selected.id === run.id
                          ? 'border-blue-500/50 bg-blue-500/5'
                          : 'border-surface-700/40 bg-surface-800/30 hover:border-surface-600 hover:bg-surface-800/60')
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge status={run.status} />
                        <span className="text-[10px] text-surface-500">{formatTime(run.createdAt)}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-surface-300">{run.task}</p>
                      <div className="mt-1.5 truncate text-[10px] text-surface-500">{run.repoName}</div>
                    </button>
                    <button
                      onClick={() => void handleDelete(run.id)}
                      aria-label="Delete run"
                      className="absolute right-2 top-2 rounded-md p-1 text-surface-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
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
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-surface-700/50 bg-surface-900/20 p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10">
        <Bot className="h-8 w-8 text-blue-400" />
      </div>
      <h3 className="text-base font-semibold text-surface-200">Your autonomous coding agent awaits</h3>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-surface-400">
        Pick an indexed repository, describe a task, and the agent will plan its work, search and
        read the code, then hand you a solution with concrete proposed changes.
      </p>
    </div>
  );
}

function RunDetail({ run }: { run: AgentRun }) {
  const running = run.status === 'running' || run.status === 'queued';
  const activeStepIndex = run.steps.findIndex((s) => s.status === 'running');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-surface-700/40 bg-gradient-to-br from-surface-900/60 to-surface-950/60 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge status={run.status} />
          <div className="flex items-center gap-2 text-[11px] text-surface-500">
            <span>{run.repoName}</span>
            <span>·</span>
            <span>{formatTime(run.createdAt)}</span>
          </div>
        </div>
        <h2 className="mt-3 text-sm sm:text-base font-semibold leading-relaxed text-surface-100">{run.task}</h2>
        {running && (
          <p className="mt-2 flex items-center gap-2 text-xs text-blue-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            The agent is working through its plan...
          </p>
        )}
        {run.status === 'failed' && run.error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-700/40 bg-red-900/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
            <p className="text-xs leading-relaxed text-red-300">{run.error}</p>
          </div>
        )}
      </div>

      {/* Plan */}
      {run.plan.length > 0 && (
        <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-400">Plan</h3>
          <ol className="space-y-2">
            {run.plan.map((p, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-surface-300">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-surface-800 text-[10px] font-bold text-surface-400">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <span className="font-medium text-surface-200">{p.action}</span>
                  <span className="ml-2 text-[10px] text-surface-500">({p.tool})</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Steps */}
      {run.steps.length > 0 && (
        <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-400">
            Progress <span className="ml-1 text-surface-500">({run.steps.length} steps)</span>
          </h3>
          <div className="space-y-2.5">
            {run.steps.map((step, i) => (
              <StepRow key={step._id} step={step} active={i === activeStepIndex} />
            ))}
          </div>
        </div>
      )}

      {/* Solution */}
      {run.status === 'completed' && run.solution && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-700/30 bg-emerald-900/10 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-surface-100">Solution</h3>
            </div>
            {run.solution.summary && (
              <p className="mt-2 text-xs leading-relaxed text-surface-300">{run.solution.summary}</p>
            )}
          </div>

          {run.solution.changes.length > 0 && (
            <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-400">
                Proposed changes <span className="ml-1 text-surface-500">({run.solution.changes.length})</span>
              </h3>
              <div className="space-y-5">
                {run.solution.changes.map((c, i) => (
                  <div key={i} className="rounded-xl border border-surface-700/40 bg-surface-950/40 p-3 sm:p-4">
                    <p className="font-mono text-xs font-semibold text-blue-400">{c.filePath}</p>
                    <p className="mt-0.5 text-xs font-medium text-surface-200">{c.title}</p>
                    {c.reasoning && (
                      <p className="mt-1 text-[11px] leading-relaxed text-surface-400">{c.reasoning}</p>
                    )}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-red-400">Before</p>
                        <CodeBlock className="language-typescript">{c.before}</CodeBlock>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">After</p>
                        <CodeBlock className="language-typescript">{c.after}</CodeBlock>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {run.solution.report && (
            <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-400">Report</h3>
              <MarkdownRenderer content={run.solution.report} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
