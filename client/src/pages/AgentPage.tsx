import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bot, Search, FileText, FolderTree, Brain, Wrench, Loader2,
  CheckCircle2, XCircle, Clock, Trash2, Play, AlertTriangle,
  History, Terminal, GitCompare, ChevronDown, Check, FileCode, ArrowDown,
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
  'Identify potential security issues in the auth module',
];

const TOOL_META: Record<string, { label: string; icon: typeof Search }> = {
  search: { label: 'Search codebase', icon: Search },
  read_file: { label: 'Read file', icon: FileText },
  list_files: { label: 'List files', icon: FolderTree },
  analyze: { label: 'Analyze findings', icon: Brain },
  propose_change: { label: 'Propose change', icon: Wrench },
};

function StatusBadge({ status }: { status: AgentRun['status'] }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Completed
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-red-400">
        <XCircle className="h-3.5 w-3.5" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-400">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {status === 'queued' ? 'Queued' : 'Running'}
    </span>
  );
}

function StepRow({ step, active, last }: { step: AgentStep; active: boolean; last: boolean }) {
  const meta = TOOL_META[step.tool] || { label: 'Tool', icon: Search };
  const Icon = meta.icon;
  const done = step.status === 'completed';
  const failed = step.status === 'failed';

  return (
    <div className={'flex gap-3 ' + (last ? '' : 'pb-4')}>
      <div className="flex flex-col items-center">
        <div
          className={
            'z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ' +
            (failed
              ? 'border-red-500/40 bg-red-500/10 text-red-400'
              : done
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : active
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                  : 'border-surface-700 bg-surface-800 text-surface-500')
          }
        >
          {failed ? <XCircle className="h-3 w-3" /> : done ? <Check className="h-3 w-3" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
        </div>
        {!last && <span className={'mt-1 w-px flex-1 ' + (done ? 'bg-emerald-500/20' : 'bg-surface-700/50')} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={'text-xs ' + (done || active ? 'font-medium text-surface-200' : 'text-surface-400')}>
            {meta.label}
          </span>
          <span className="truncate font-mono text-[10px] text-surface-500">{JSON.stringify(step.params)}</span>
          {active && !done && !failed && <span className="text-[10px] font-medium text-blue-400">working…</span>}
        </div>
        {step.reasoning && <p className="mt-1 text-[11px] leading-relaxed text-surface-500">{step.reasoning}</p>}
        {step.result && (
          <pre className="mt-2 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-md border border-surface-800 bg-surface-950/80 p-2.5 font-mono text-[11px] leading-relaxed text-emerald-300/90">
            {step.result}
          </pre>
        )}
        {step.error && (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-red-400">
            <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" /> {step.error}
          </p>
        )}
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

  // Poll the selected run while it is actively working. Poll at 3s — fast enough
  // to feel live, but light on the API (a full run uses ~10-20 requests instead
  // of 40+). Paused while the tab is hidden so background tabs never burn quota,
  // and refreshes instantly when the tab becomes visible again.
  const activeRunId = selected && selected.status !== 'completed' && selected.status !== 'failed'
    ? selected.id
    : null;
  const pollActiveRun = useCallback(async () => {
    if (!activeRunId || document.hidden) return;
    try {
      const fresh = await fetchAgentRun(activeRunId);
      setSelected(fresh);
      setRuns((prev) => prev.map((r) => (r.id === fresh.id ? fresh : r)));
    } catch {
      /* ignore transient poll failures */
    }
  }, [activeRunId]);

  useEffect(() => {
    if (!activeRunId) return;
    const timer = setInterval(() => void pollActiveRun(), 3000);
    return () => clearInterval(timer);
  }, [activeRunId, pollActiveRun]);

  useEffect(() => {
    if (!activeRunId) return;
    const onVisible = () => {
      if (!document.hidden) void pollActiveRun();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [activeRunId, pollActiveRun]);

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
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-surface-100">AI Agent</h1>
          <p className="mt-0.5 text-xs text-surface-400">
            Describe a task and the agent will plan, explore, and propose changes across your indexed repositories.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-surface-500">
          <span>{runs.length} runs</span>
          <span className="text-surface-700">·</span>
          <span>{completedCount} completed</span>
          <span className="text-surface-700">·</span>
          <span>{activeCount} active</span>
          <span className="text-surface-700">·</span>
          <span>{totalChanges} changes</span>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
        {/* Left rail */}
        <div className="space-y-5 lg:sticky lg:top-24">
          {/* New task */}
          <div className="rounded-xl border border-surface-700/40 bg-surface-900/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary-400" />
              <h2 className="text-sm font-semibold text-surface-200">New task</h2>
            </div>

            <label htmlFor="agent-repo" className="mb-1.5 block text-[11px] font-medium text-surface-400">Repository</label>
            <div className="relative">
              <select
                id="agent-repo"
                value={reportId}
                onChange={(e) => setReportId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-surface-700 bg-surface-800/60 px-3 py-2 pr-8 text-xs text-surface-200 outline-none transition-colors focus:border-primary-500/60"
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
              placeholder="Describe what you want the agent to do..."
              className="w-full resize-none rounded-lg border border-surface-700 bg-surface-800/60 px-3 py-2 text-xs leading-relaxed text-surface-200 placeholder:text-surface-600 outline-none transition-colors focus:border-primary-500/60"
            />
            <div className="mt-1 flex justify-end">
              <span className="text-[10px] text-surface-600">{task.length}/2000</span>
            </div>

            <div className="mt-1 flex flex-wrap gap-1.5">
              {EXAMPLE_TASKS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTask(t)}
                  className="rounded-md border border-surface-700 bg-surface-800/50 px-2 py-1 text-[10px] text-surface-400 transition-colors hover:border-primary-500/50 hover:text-primary-300"
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={handleCreate}
              disabled={!reportId || task.trim().length < 10 || submitting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary-600"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {submitting ? 'Starting agent...' : 'Run agent'}
            </button>
          </div>

          {/* Run history — fixed height so new runs don't push the page */}
          <div className="rounded-xl border border-surface-700/40 bg-surface-900/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-surface-400" />
                <h2 className="text-sm font-semibold text-surface-200">Run history</h2>
              </div>
              <span className="text-[10px] text-surface-500">{runs.length} runs</span>
            </div>
            {loadingRuns ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
              </div>
            ) : runs.length === 0 ? (
              <p className="py-8 text-center text-xs text-surface-500">
                No agent runs yet. Launch your first task above.
              </p>
            ) : (
              <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
                {runs.map((run) => {
                  const isSelected = selected && selected.id === run.id;
                  return (
                    <div key={run.id} className="group relative">
                      <button
                        onClick={() => setSelected(run)}
                        className={
                          'w-full rounded-lg border p-3 pr-9 text-left transition-colors ' +
                          (isSelected
                            ? 'border-blue-500/50 bg-blue-500/5'
                            : 'border-surface-700/40 bg-surface-800/30 hover:border-surface-600 hover:bg-surface-800/60')
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <StatusBadge status={run.status} />
                          <span className="text-[10px] text-surface-500">{timeAgo(run.createdAt)}</span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs text-surface-300">{run.task}</p>
                        <p className="mt-1 truncate text-[10px] text-surface-500">{run.repoName}</p>
                      </button>
                      <button
                        onClick={() => void handleDelete(run.id)}
                        aria-label="Delete run"
                        className="absolute right-2 top-2 rounded p-1 text-surface-600 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="min-w-0">
          {selected ? <RunDetail run={selected} /> : <EmptyState />}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-surface-700/50 bg-surface-900/20 px-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-800">
        <Bot className="h-6 w-6 text-surface-400" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-surface-200">No run selected</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-surface-500">
        Select a repository, describe a task, and run the agent. Its plan, progress, and solution
        will appear here.
      </p>
    </div>
  );
}

function RunDetail({ run }: { run: AgentRun }) {
  const running = run.status === 'running' || run.status === 'queued';
  const activeStepIndex = run.steps.findIndex((s) => s.status === 'running');
  const stepsDone = run.steps.filter((s) => s.status === 'completed').length;
  const stepsTotal = Math.max(run.steps.length, run.plan.length) || 1;
  const duration = formatDuration(run.startedAt, run.completedAt);
  const hasPanel = running || run.plan.length > 0 || run.steps.length > 0;

  // Only auto-scroll if the user is already near the bottom — scrolling up to
  // read earlier output must never yank them back down.
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  // Reset to "stick to bottom" whenever a different run is selected.
  useEffect(() => {
    stickToBottomRef.current = true;
    setAtBottom(true);
  }, [run.id]);

  // Track where the user is within the panel (listener re-attached when the
  // panel appears/disappears). setAtBottom bails out unless the value changes,
  // so scrolling does not cause re-renders.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const near = distance < 100;
      stickToBottomRef.current = near;
      setAtBottom((prev) => (prev === near ? prev : near));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasPanel]);

  // Keep the page in place: only auto-scroll the inner panel when the user is
  // near the bottom; never scroll the page itself.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [run.steps, run.status]);

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    setAtBottom(true);
    el.scrollTop = el.scrollHeight;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusBadge status={run.status} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-surface-500">
            <span className="truncate">{run.repoName}</span>
            <span className="text-surface-700">·</span>
            <span>{formatTime(run.createdAt)}</span>
            {duration && (
              <>
                <span className="text-surface-700">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {duration}
                </span>
              </>
            )}
          </div>
        </div>
        <h2 className="mt-2.5 text-sm font-medium leading-relaxed text-surface-100">{run.task}</h2>
        {running && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-surface-500">
            <span className="flex items-center gap-1.5 font-medium text-primary-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Working…
            </span>
            <span className="text-surface-600">
              {run.steps.length === 0 && run.plan.length === 0 ? 'starting up' : stepsDone + ' of ' + stepsTotal + ' steps'}
            </span>
          </div>
        )}
        {run.status === 'failed' && run.error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-700/40 bg-red-900/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
            <p className="text-xs leading-relaxed text-red-300">{run.error}</p>
          </div>
        )}
      </div>

      {/* Execution — always present for active runs so the panel height is reserved
          from the start and scanning stays in place (internal scroll only) */}
      {hasPanel && (
        <div className="relative overflow-hidden rounded-xl border border-surface-700/40 bg-surface-900/40">
          <div className="flex items-center justify-between border-b border-surface-700/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-surface-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-400">Execution</h3>
            </div>
            <span className="text-[10px] text-surface-500">{stepsDone}/{stepsTotal} steps</span>
          </div>

          {run.plan.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-b border-surface-700/40 px-4 py-2.5">
              {run.plan.map((p, i) => {
                const state = run.steps[i] ? run.steps[i].status : 'pending';
                return (
                  <span
                    key={i}
                    className={
                      'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium ' +
                      (state === 'completed'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : state === 'running'
                          ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                          : state === 'failed'
                            ? 'border-red-500/30 bg-red-500/10 text-red-400'
                            : 'border-surface-700 bg-surface-800/50 text-surface-500')
                    }
                  >
                    {state === 'completed' ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                    {p.action}
                  </span>
                );
              })}
            </div>
          )}

          <div ref={scrollRef} className="h-[440px] overflow-y-auto px-4 py-3">
            {run.steps.length === 0 ? (
              <p className="py-8 text-center text-xs text-surface-500">Preparing the plan…</p>
            ) : (
              run.steps.map((step, i) => (
                <StepRow key={step._id} step={step} active={i === activeStepIndex} last={i === run.steps.length - 1} />
              ))
            )}
          </div>

          {!atBottom && (
          <button
            onClick={jumpToLatest}
            className="absolute bottom-3 right-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-surface-700 bg-surface-800/90 px-3 py-1.5 text-[11px] font-medium text-primary-400 shadow-lg backdrop-blur transition-colors hover:bg-surface-700"
          >
            <ArrowDown className="h-3 w-3" /> Latest
          </button>
          )}
        </div>
      )}

      {/* Solution */}
      {run.status === 'completed' && run.solution && (
        <div className="space-y-5">
          {run.solution.summary && (
            <div className="rounded-xl border border-emerald-700/30 bg-emerald-500/5 p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Solution</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-surface-300">{run.solution.summary}</p>
            </div>
          )}

          {run.solution.changes.length > 0 && (
            <div className="rounded-xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <GitCompare className="h-4 w-4 text-surface-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-400">Proposed changes</h3>
                <span className="rounded-full bg-surface-800 px-2 py-0.5 text-[10px] font-medium text-surface-400">
                  {run.solution.changes.length}
                </span>
              </div>
              <div className="space-y-4">
                {run.solution.changes.map((c, i) => (
                  <div key={i} className="rounded-lg border border-surface-700/40 bg-surface-950/40 p-3 sm:p-4">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                        <FileCode className="h-3.5 w-3.5 text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-all font-mono text-xs font-semibold text-blue-400">{c.filePath}</p>
                        <p className="mt-0.5 text-xs font-medium text-surface-200">{c.title}</p>
                      </div>
                    </div>
                    {c.reasoning && <p className="mt-2 text-[11px] leading-relaxed text-surface-400">{c.reasoning}</p>}
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
            <div className="rounded-xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-400">Report</h3>
              <MarkdownRenderer content={run.solution.report} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
