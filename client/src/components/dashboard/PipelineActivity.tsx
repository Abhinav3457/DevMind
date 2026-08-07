import { useState } from 'react';
import { Bot, Check, X, GitCompare, MoreVertical, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Suggestion {
  id: string;
  filePath: string;
  title: string;
  before: string;
  after: string;
}

interface PipelineActivityProps {
  suggestions: Suggestion[];
  loading: boolean;
}

function DiffPane({ title, code, tone }: { title: string; code: string; tone: 'removed' | 'added' }) {
  const lines = (code || '').split('\n');
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-surface-700/60 bg-surface-950/50">
      <div className="flex items-center justify-between border-b border-surface-700/60 bg-surface-900/60 px-3 py-1.5">
        <span className={
          'text-[10px] font-semibold uppercase tracking-wider ' +
          (tone === 'removed' ? 'text-red-400' : 'text-emerald-400')
        }>
          {title}
        </span>
        <span className="text-[10px] text-surface-500">{lines.length} lines</span>
      </div>
      <div className="flex max-h-64 overflow-auto">
        <div className="select-none border-r border-surface-700/60 bg-surface-900/40 py-2 text-right text-[11px] leading-5 text-surface-600">
          {lines.map((_, i) => (
            <div key={i} className="w-7 pr-1.5 font-mono">{i + 1}</div>
          ))}
        </div>
        <pre className={
          'flex-1 overflow-x-auto whitespace-pre px-3 py-2 font-mono text-[11px] leading-5 ' +
          (tone === 'removed' ? 'text-red-300/80' : 'text-emerald-300/80')
        }>
          {code || '\n'}
        </pre>
      </div>
    </div>
  );
}

export function PipelineActivity({ suggestions, loading }: PipelineActivityProps) {
  const [decisions, setDecisions] = useState<Record<string, 'accepted' | 'declined'>>({});

  const decide = (id: string, d: 'accepted' | 'declined') => {
    setDecisions((prev) => ({ ...prev, [id]: d }));
  };

  return (
    <div className="rounded-xl border border-surface-700/40 bg-surface-900/40 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
            <GitCompare className="h-4 w-4 text-primary-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-surface-200">Dev Pipeline Activity</h3>
            <p className="text-[11px] text-surface-500">AI-proposed changes from your agent runs</p>
          </div>
        </div>
        <Link
          to="/ai/agent"
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-1.5 text-[11px] font-medium text-surface-300 transition-all hover:border-primary-500/40 hover:text-primary-300"
        >
          Open Agent <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
        </div>
      ) : suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-800">
            <Sparkles className="h-5 w-5 text-surface-500" />
          </div>
          <p className="text-sm font-medium text-surface-300">No AI suggestions yet</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-surface-500">
            Run the AI Agent on an indexed repository and its proposed changes will appear here for review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((s) => {
            const decision = decisions[s.id];
            return (
              <div key={s.id} className="overflow-hidden rounded-xl border border-surface-700/50 bg-surface-900/30">
                <div className="flex items-center justify-between gap-2 border-b border-surface-700/40 bg-surface-900/50 px-3 py-2.5 sm:px-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                      <Bot className="h-3 w-3 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-surface-200">AI Suggestions</p>
                      <p className="truncate font-mono text-[10px] text-surface-500">{s.filePath}</p>
                    </div>
                  </div>
                  <button className="flex-shrink-0 rounded-lg p-1.5 text-surface-500 transition-colors hover:bg-surface-800 hover:text-surface-300" aria-label="More options">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-3 sm:p-4">
                  <p className="mb-3 text-xs font-medium text-surface-200">{s.title}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <DiffPane title="Before" code={s.before} tone="removed" />
                    <DiffPane title="After" code={s.after} tone="added" />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-surface-500">
                      {decision === 'accepted' ? 'Change accepted' : decision === 'declined' ? 'Change declined' : 'Review this proposed change'}
                    </span>
                    {decision ? (
                      <span className={
                        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium ' +
                        (decision === 'accepted' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')
                      }>
                        {decision === 'accepted' ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {decision === 'accepted' ? 'Accepted' : 'Declined'}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => decide(s.id, 'accepted')}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/15 px-3 py-1.5 text-[11px] font-medium text-emerald-400 transition-all hover:bg-emerald-600/25"
                        >
                          <Check className="h-3.5 w-3.5" /> Accept
                        </button>
                        <button
                          onClick={() => decide(s.id, 'declined')}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-400 transition-all hover:bg-red-500/20"
                        >
                          <X className="h-3.5 w-3.5" /> Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
