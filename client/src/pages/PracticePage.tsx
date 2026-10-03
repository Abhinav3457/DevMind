import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Play, CheckCircle2, XCircle, AlertCircle, Clock,
  Lightbulb, ChevronDown, ChevronLeft, ChevronRight, Sparkles, Search, RotateCcw, Copy, ExternalLink, Flame, X, List,
  Maximize2, Minimize2, Gauge, Cpu, Code2, Sun, Moon,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import Editor from '@monaco-editor/react';
import toast from 'react-hot-toast';
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer';
import {
  fetchLeetcodeProblems, fetchLeetcodeProblem, submitLeetcodeSolution, fetchLeetcodeStats,
  type LeetCodeProblemSummary, type LeetCodeQuestion, type SubmissionResult,
  type PracticeDifficulty, type JudgeIssue, type LeetCodeStats,
} from '../services/practice';

const DIFFICULTY_STYLES: Record<PracticeDifficulty, string> = {
  easy: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  hard: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const DIFFICULTY_TEXT: Record<PracticeDifficulty, string> = {
  easy: 'text-emerald-400',
  medium: 'text-amber-400',
  hard: 'text-red-400',
};

const MONACO_LANGUAGE: Record<string, string> = {
  cpp: 'cpp', c: 'c', java: 'java', python3: 'python', python: 'python',
  javascript: 'javascript', typescript: 'typescript', csharp: 'csharp',
  golang: 'go', go: 'go', rust: 'rust', ruby: 'ruby', kotlin: 'kotlin',
  swift: 'swift', php: 'php', dart: 'dart', scala: 'scala', elixir: 'elixir',
  erlang: 'erlang', racket: 'scheme',
};

const QUICK_TAGS = ['array', 'string', 'hash-table', 'dynamic-programming', 'tree', 'graph'];

const STATUS_META: Record<SubmissionResult['status'], { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  accepted: { label: 'Accepted', className: 'text-emerald-400', Icon: CheckCircle2 },
  wrong_answer: { label: 'Wrong Answer', className: 'text-red-400', Icon: XCircle },
  needs_review: { label: 'Needs Review', className: 'text-amber-400', Icon: AlertCircle },
  error: { label: 'Judge Error', className: 'text-red-400', Icon: XCircle },
};

const SEVERITY_CLASSES: Record<JudgeIssue['severity'], string> = {
  critical: 'border-red-500/30 bg-red-500/10',
  major: 'border-amber-500/30 bg-amber-500/10',
  minor: 'border-surface-600/40 bg-surface-800/40',
};

const STATUS_ACCENT: Record<SubmissionResult['status'], { bg: string; bar: string; border: string }> = {
  accepted: { bg: 'bg-emerald-500/10', bar: 'bg-emerald-500', border: 'border-emerald-500/30' },
  wrong_answer: { bg: 'bg-red-500/10', bar: 'bg-red-500', border: 'border-red-500/30' },
  needs_review: { bg: 'bg-amber-500/10', bar: 'bg-amber-500', border: 'border-amber-500/30' },
  error: { bg: 'bg-red-500/10', bar: 'bg-red-500', border: 'border-red-500/30' },
};

function pickDefaultLanguage(question: LeetCodeQuestion): string {
  const langs = question.codeSnippets.map((s) => s.langSlug);
  for (const preferred of ['python3', 'python', 'javascript', 'typescript']) {
    if (langs.includes(preferred)) return preferred;
  }
  return langs[0] || 'python3';
}

export function PracticePage() {
  // Problem list
  const [problems, setProblems] = useState<LeetCodeProblemSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<PracticeDifficulty | ''>('');
  const [tag, setTag] = useState('');
  const [mobileListOpen, setMobileListOpen] = useState(false);

  // Selected problem
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [question, setQuestion] = useState<LeetCodeQuestion | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [language, setLanguage] = useState('python3');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [copied, setCopied] = useState(false);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [aiInsightsExpanded, setAiInsightsExpanded] = useState(false);
  const [resultExpanded, setResultExpanded] = useState(false);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'vs'>('vs-dark');
  const langBarRef = useRef<HTMLDivElement>(null);
  const [langScroll, setLangScroll] = useState({ left: false, right: false });

  // LeetCode profile
  const [username, setUsername] = useState(() => localStorage.getItem('leetcodeUsername') || '');
  const [stats, setStats] = useState<LeetCodeStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const loadProblems = useCallback(async (targetPage: number, append: boolean) => {
    setLoadingList(true);
    try {
      const data = await fetchLeetcodeProblems({
        difficulty,
        search: search.trim() || undefined,
        tags: tag.trim() || undefined,
        page: targetPage,
        limit: 30,
      });
      setTotal(data.total);
      setPage(targetPage);
      setProblems((prev) => (append ? [...prev, ...data.problems] : data.problems));
    } catch {
      /* interceptor surfaced the error */
    } finally {
      setLoadingList(false);
    }
  }, [difficulty, search, tag]);

  useEffect(() => {
    const handle = setTimeout(() => { void loadProblems(1, false); }, 300);
    return () => clearTimeout(handle);
  }, [loadProblems]);

  const loadStats = useCallback(async (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    setLoadingStats(true);
    try {
      const data = await fetchLeetcodeStats(name);
      setStats(data);
      setUsername(data.username);
      localStorage.setItem('leetcodeUsername', data.username);
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('leetcodeUsername');
    if (saved) void loadStats(saved);
  }, [loadStats]);

  const openProblem = useCallback(async (slug: string) => {
    setSelectedSlug(slug);
    setMobileListOpen(false);
    setLoadingQuestion(true);
    setResult(null);
    setShowHints(false);
    setCopied(false);
    try {
      const { problem, lastSubmission } = await fetchLeetcodeProblem(slug);
      setQuestion(problem);
      const lang = (lastSubmission?.language && problem.codeSnippets.some((s) => s.langSlug === lastSubmission.language)
        ? lastSubmission.language
        : pickDefaultLanguage(problem));
      setLanguage(lang);
      const snippet = problem.codeSnippets.find((s) => s.langSlug === lang);
      setCode(lastSubmission?.code || snippet?.code || '');
      if (lastSubmission) setResult(lastSubmission);
    } catch {
      setQuestion(null);
    } finally {
      setLoadingQuestion(false);
    }
  }, []);

  const changeLanguage = (langSlug: string) => {
    setLanguage(langSlug);
    if (question) {
      const snippet = question.codeSnippets.find((s) => s.langSlug === langSlug);
      setCode(snippet?.code || '');
      setResult(null);
    }
  };

  const resetCode = () => {
    if (!question) return;
    const snippet = question.codeSnippets.find((s) => s.langSlug === language);
    setCode(snippet?.code || '');
    setResult(null);
  };

  const handleSubmit = useCallback(async () => {
    if (!question || submitting) return;
    setSubmitting(true);
    try {
      const verdict = await submitLeetcodeSolution(question.slug, code, language);
      setResult(verdict);
      if (verdict.status === 'accepted') {
        toast.success(`Accepted — ${verdict.passedTests}/${verdict.totalTests} examples passed`);
        setSolved((prev) => new Set(prev).add(question.slug));
        if (username.trim()) void loadStats(username);
      } else if (verdict.status === 'wrong_answer') {
        toast.error(`Wrong answer — ${verdict.passedTests}/${verdict.totalTests} examples passed`);
      }
    } catch {
      /* interceptor surfaced the error */
    } finally {
      setSubmitting(false);
    }
  }, [question, submitting, code, language, username, loadStats]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSubmit]);

  const copyAndOpen = async () => {
    if (!question) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Code copied — paste it into LeetCode to submit');
    } catch {
      toast.error('Could not copy automatically');
    }
    window.open('https://leetcode.com/problems/' + question.slug + '/', '_blank', 'noopener');
  };

  const languages = useMemo(
    () => question?.codeSnippets.map((s) => ({ slug: s.langSlug, label: s.lang })) || [],
    [question],
  );

  /* ── The problem list, reused by the desktop pane and the mobile drawer ── */
  const renderProblemList = () => (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {loadingList && problems.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
          </div>
        ) : problems.length === 0 ? (
          <p className="py-12 text-center text-xs text-surface-500">No problems match your filters.</p>
        ) : (
          problems.map((p) => (
            <button
              key={p.slug}
              onClick={() => void openProblem(p.slug)}
              className={
                'w-full rounded-lg border px-3 py-2.5 text-left transition-colors ' +
                (selectedSlug === p.slug
                  ? 'border-primary-500/50 bg-primary-500/10'
                  : 'border-surface-700/60 bg-surface-900/60 hover:border-surface-600 hover:bg-surface-800/60')
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium text-surface-200">
                  {solved.has(p.slug) && <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-400" />}
                  <span className="mr-1.5 text-surface-500">{p.id}.</span>
                  {p.title}
                </span>
                <span className={`flex-shrink-0 text-[10px] font-semibold uppercase ${DIFFICULTY_TEXT[p.difficulty]}`}>
                  {p.difficulty}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-2 truncate text-[11px] text-surface-500">
                {p.paidOnly && <span className="text-amber-500">premium</span>}
                <span>{p.acRate}%</span>
                {p.tags.length > 0 && <span className="truncate">· {p.tags.slice(0, 2).join(', ')}</span>}
              </p>
            </button>
          ))
        )}

        {problems.length > 0 && problems.length < total && (
          <button
            onClick={() => void loadProblems(page + 1, true)}
            disabled={loadingList}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-700/60 bg-surface-900/40 py-2 text-xs text-surface-400 transition-colors hover:border-surface-600 hover:text-surface-200 disabled:opacity-50"
          >
            {loadingList ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Load more ({problems.length}/{total})
          </button>
        )}
      </div>
    </div>
  );

  // Close the fullscreen editor with Escape and lock background scroll while open.
  useEffect(() => {
    if (!editorExpanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditorExpanded(false); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [editorExpanded]);

  // Close the fullscreen AI insights with Escape and lock background scroll while open.
  useEffect(() => {
    if (!aiInsightsExpanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAiInsightsExpanded(false); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [aiInsightsExpanded]);

  // Close the fullscreen result panel with Escape and lock background scroll while open.
  useEffect(() => {
    if (!resultExpanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setResultExpanded(false); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [resultExpanded]);

  const updateLangScroll = useCallback(() => {
    const el = langBarRef.current;
    if (!el) return;
    setLangScroll({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);

  // Keep the slidebar arrows in sync and bring the active language into view.
  useEffect(() => {
    updateLangScroll();
    langBarRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }, [language, editorExpanded, languages.length, updateLangScroll]);

  useEffect(() => {
    window.addEventListener('resize', updateLangScroll);
    return () => window.removeEventListener('resize', updateLangScroll);
  }, [updateLangScroll]);

  const scrollLangBar = (dir: number) => {
    const el = langBarRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.6), behavior: 'smooth' });
  };

  /* ── The editor card, reused inline and inside the fullscreen overlay ── */
  const renderEditorCard = (expanded: boolean) => (
    <div
      className={
        'flex flex-col overflow-hidden rounded-2xl border border-surface-700/60 bg-surface-900/30 ' +
        (expanded
          ? 'h-full w-full shadow-2xl shadow-black/50'
          : 'min-h-[320px] sm:min-h-[380px] lg:min-h-[420px] max-h-[60vh] sm:max-h-[70vh] lg:max-h-[80vh]')
      }
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-surface-700/60 px-3 py-2 flex-wrap">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <button
            type="button"
            onClick={() => scrollLangBar(-1)}
            disabled={!langScroll.left}
            className="flex-shrink-0 rounded-md p-1 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200 disabled:opacity-25"
            aria-label="Scroll languages left"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div
            ref={langBarRef}
            onScroll={updateLangScroll}
            className="flex flex-nowrap items-center gap-1 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {languages.map((l) => (
              <button
                key={l.slug}
                data-active={language === l.slug ? 'true' : undefined}
                onClick={() => changeLanguage(l.slug)}
                className={
                  'whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium transition-colors ' +
                  (language === l.slug ? 'bg-primary-500/15 text-primary-300' : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200')
                }
              >
                {l.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => scrollLangBar(1)}
            disabled={!langScroll.right}
            className="flex-shrink-0 rounded-md p-1 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200 disabled:opacity-25"
            aria-label="Scroll languages right"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 flex-wrap">
          <button
            onClick={resetCode}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-surface-400 hover:bg-surface-800 hover:text-surface-200"
            title="Reset to LeetCode template"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => void copyAndOpen()}
            className="flex items-center gap-1.5 rounded-md border border-surface-600/60 px-3 py-1.5 text-xs font-medium text-surface-200 hover:bg-surface-800"
            title="Copy your code and open the problem on LeetCode"
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Copy & open</span>
          </button>
          <button
            onClick={() => setEditorExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-surface-600/60 px-2 py-1.5 text-xs font-medium text-surface-200 hover:bg-surface-800"
            title={expanded ? 'Exit fullscreen editor (Esc)' : 'Expand editor'}
            aria-label={expanded ? 'Exit fullscreen editor' : 'Expand editor'}
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setEditorTheme((t) => (t === 'vs-dark' ? 'vs' : 'vs-dark'))}
            className="flex items-center gap-1 rounded-md border border-surface-600/60 px-2 py-1.5 text-xs font-medium text-surface-200 hover:bg-surface-800"
            title={editorTheme === 'vs-dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label={editorTheme === 'vs-dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {editorTheme === 'vs-dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-500 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{submitting ? 'Judging…' : 'Submit'}</span>
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language={MONACO_LANGUAGE[language] || 'plaintext'}
          theme={editorTheme}
          value={code}
          onChange={(v) => setCode(v ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            tabSize: 2,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {/* ── Toolbar: search, filters, profile ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          onClick={() => setMobileListOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-xs font-medium text-surface-300 lg:hidden"
        >
          <List className="h-3.5 w-3.5" />
          Problems
        </button>

        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search LeetCode problems"
            className="w-full rounded-lg border border-surface-700 bg-surface-900 py-2 pl-9 pr-3 text-sm text-surface-200 placeholder:text-surface-500 focus:border-primary-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center rounded-lg border border-surface-700 bg-surface-900 p-0.5">
          {(['', 'easy', 'medium', 'hard'] as const).map((d) => (
            <button
              key={d || 'all'}
              onClick={() => setDifficulty(d)}
              className={
                'rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ' +
                (difficulty === d ? 'bg-primary-500/20 text-primary-300' : 'text-surface-400 hover:text-surface-200')
              }
            >
              {d === '' ? 'All' : d}
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-1.5 md:flex">
          {QUICK_TAGS.slice(0, 4).map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? '' : t)}
              className={
                'rounded-md border px-2 py-1 text-[11px] transition-colors ' +
                (tag === t
                  ? 'border-primary-500/50 bg-primary-500/10 text-primary-300'
                  : 'border-surface-700/60 bg-surface-900/60 text-surface-500 hover:text-surface-300')
              }
            >
              {t}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); void loadStats(username); }}
          className="ml-auto flex items-center gap-2"
        >
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="LeetCode username"
            className="w-40 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-xs text-surface-200 placeholder:text-surface-500 focus:border-amber-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loadingStats || !username.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
          >
            {loadingStats ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flame className="h-3.5 w-3.5" />}
            Load
          </button>
        </form>

        {stats && (
          <div className="flex w-full items-center gap-3 overflow-x-auto text-[11px] lg:w-auto">
            <span className="font-semibold text-surface-200">{stats.realName || stats.username}</span>
            <span className="text-emerald-400">{stats.solved.easy}E</span>
            <span className="text-amber-400">{stats.solved.medium}M</span>
            <span className="text-red-400">{stats.solved.hard}H</span>
            <span className="text-surface-400">{stats.solved.total} solved</span>
            {stats.streak.current > 0 && <span className="text-orange-400">{stats.streak.current}d streak</span>}
            <a
              href={'https://leetcode.com/u/' + stats.username + '/'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary-400 hover:text-primary-300"
            >
              profile <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {/* ── Main workspace ── */}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* Problem list (desktop) */}
        <aside className="hidden w-[290px] shrink-0 flex-col overflow-hidden rounded-2xl border border-surface-700/60 bg-surface-900/30 p-2 lg:flex">
          {renderProblemList()}
        </aside>

        {!selectedSlug ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-surface-700/60 bg-surface-900/20 px-6 py-16 text-center lg:py-0">
            <p className="text-sm font-medium text-surface-300">Select a problem to start</p>
            <p className="mt-1 max-w-md text-xs text-surface-500">
              Live problems come straight from LeetCode. Your solution is judged by AI against the examples,
              and one click copies it into LeetCode. Press Ctrl/⌘ + Enter to submit.
            </p>
          </div>
        ) : loadingQuestion ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-surface-700/60 bg-surface-900/30">
            <Loader2 className="h-6 w-6 animate-spin text-surface-500" />
          </div>
        ) : !question ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-surface-700/60 bg-surface-900/30 p-8 text-center text-sm text-surface-400">
            Could not load this problem.
          </div>
        ) : (
          <motion.div
            key={question.slug}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:flex-row"
          >
            {/* Problem panel */}
            <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-surface-700/60 bg-surface-900/30">
              <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-surface-700/60 px-4 py-3">
                <h2 className="text-sm font-bold text-surface-100">
                  <span className="mr-1.5 text-surface-500">{question.id}.</span>
                  {question.title}
                </h2>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${DIFFICULTY_STYLES[question.difficulty]}`}>
                  {question.difficulty}
                </span>
                {question.paidOnly && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">premium</span>
                )}
                {question.tags.slice(0, 4).map((t) => (
                  <span key={t} className="text-[10px] text-surface-500">#{t}</span>
                ))}
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <MarkdownRenderer content={question.description} />

                {question.hints.length > 0 && (
                  <div className="mt-4 border-t border-surface-700/50 pt-3">
                    <button
                      onClick={() => setShowHints((v) => !v)}
                      className="flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300"
                    >
                      <Lightbulb className="h-3.5 w-3.5" />
                      {showHints ? 'Hide hints' : `Show hints (${question.hints.length})`}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showHints ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {showHints && (
                        <motion.ul
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 space-y-1.5 overflow-hidden text-xs text-amber-200/90"
                        >
                          {question.hints.map((h, i) => (
                            <li key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                              <MarkdownRenderer content={h} className="[&_p]:my-0" />
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </section>

{/* Editor + result */}
            <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
              {!editorExpanded && renderEditorCard(false)}

              <AnimatePresence>
                {result && (
                  <div className={`shrink-0 overflow-y-auto ${!resultExpanded ? 'max-h-[50vh]' : ''}`}>
                    <ResultPanel
                      result={result}
                      aiInsightsExpanded={aiInsightsExpanded}
                      setAiInsightsExpanded={setAiInsightsExpanded}
                      resultExpanded={resultExpanded}
                      setResultExpanded={setResultExpanded}
                    />
                  </div>
                )}
              </AnimatePresence>
            </section>
          </motion.div>
        )}
      </div>

{/* ── Fullscreen editor overlay (portal escapes the animated parent so
          `position: fixed` anchors to the viewport, not the motion wrapper) ── */}
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {editorExpanded && (
              <>
                <motion.div
                  key="editor-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] bg-surface-950/60 backdrop-blur-sm"
                  onClick={() => setEditorExpanded(false)}
                />
                <motion.div
                  key="editor-overlay"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="fixed inset-0 z-[70] flex flex-col p-2 sm:p-4 lg:p-6"
                >
                  {renderEditorCard(true)}
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}

        {/* ── Fullscreen AI insights overlay ── */}
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {aiInsightsExpanded && result?.feedback && (
              <>
                <motion.div
                  key="ai-insights-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] bg-surface-950/60 backdrop-blur-sm"
                  onClick={() => setAiInsightsExpanded(false)}
                />
                <motion.div
                  key="ai-insights-overlay"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="fixed inset-0 z-[70] flex flex-col p-2 sm:p-4 lg:p-6"
                >
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-surface-700/60 bg-surface-900/30 h-full w-full shadow-2xl shadow-black/50">
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-surface-700/60 px-3 py-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-300">
                        <Sparkles className="h-3.5 w-3.5" /> AI insights
                      </div>
                      <button
                        onClick={() => setAiInsightsExpanded(false)}
                        className="flex items-center gap-1 rounded-md border border-surface-600/60 px-2 py-1.5 text-xs font-medium text-surface-200 hover:bg-surface-800"
                        title="Exit fullscreen (Esc)"
                        aria-label="Exit fullscreen"
                      >
                        <Minimize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                      <MarkdownRenderer content={result.feedback} />
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}

        {/* ── Fullscreen result panel overlay ── */}
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {resultExpanded && result && (
              <>
                <motion.div
                  key="result-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] bg-surface-950/60 backdrop-blur-sm"
                  onClick={() => setResultExpanded(false)}
                />
                <motion.div
                  key="result-overlay"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="fixed inset-0 z-[70] flex flex-col p-2 sm:p-4 lg:p-6"
                >
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-surface-700/60 bg-surface-900/30 h-full w-full shadow-2xl shadow-black/50">
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-surface-700/60 px-3 py-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-surface-300">
                        <Code2 className="h-3.5 w-3.5" /> Result details
                      </div>
                      <button
                        onClick={() => setResultExpanded(false)}
                        className="flex items-center gap-1 rounded-md border border-surface-600/60 px-2 py-1.5 text-xs font-medium text-surface-200 hover:bg-surface-800"
                        title="Exit fullscreen (Esc)"
                        aria-label="Exit fullscreen"
                      >
                        <Minimize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                      <ResultPanel
                        result={result}
                        aiInsightsExpanded={aiInsightsExpanded}
                        setAiInsightsExpanded={setAiInsightsExpanded}
                        resultExpanded={resultExpanded}
                        setResultExpanded={setResultExpanded}
                      />
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}

        {/* ── Mobile problem drawer ── */}
      <AnimatePresence>
        {mobileListOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-surface-950/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileListOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="fixed left-0 top-0 z-50 flex h-full w-[85vw] max-w-sm flex-col border-r border-surface-700 bg-surface-900 p-2 safe-top lg:hidden"
            >
              <div className="flex items-center justify-between px-2 py-2">
                <span className="text-sm font-semibold text-surface-200">Problems</span>
                <button
                  onClick={() => setMobileListOpen(false)}
                  className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-800 hover:text-surface-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {renderProblemList()}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

import { Dispatch, SetStateAction } from 'react';

function ResultPanel({ result, aiInsightsExpanded, setAiInsightsExpanded, resultExpanded, setResultExpanded }: { result: SubmissionResult; aiInsightsExpanded: boolean; setAiInsightsExpanded: Dispatch<SetStateAction<boolean>>; resultExpanded: boolean; setResultExpanded: Dispatch<SetStateAction<boolean>> }) {
  const meta = STATUS_META[result.status];
  const { Icon } = meta;
  const accent = STATUS_ACCENT[result.status];
  const pct = result.totalTests > 0 ? Math.round((result.passedTests / result.totalTests) * 100) : 0;
  const scoreTone = result.score >= 80 ? 'text-emerald-400' : result.score >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-3 rounded-2xl border border-surface-700/60 bg-surface-900/40 p-4"
    >
      {/* Verdict + score */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${accent.bg}`}>
            <Icon className={`h-5 w-5 ${meta.className}`} />
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-bold ${meta.className}`}>{meta.label}</p>
            <p className="text-[11px] text-surface-400">
              {result.passedTests}/{result.totalTests} examples passed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 ${accent.bg} ${accent.border}`}>
            <Gauge className="h-3.5 w-3.5 text-surface-300" />
            <span className={`text-sm font-bold tabular-nums ${scoreTone}`}>{result.score}</span>
            <span className="text-[10px] text-surface-400">/100</span>
          </div>
          <button
            onClick={() => setResultExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-surface-600/60 px-2 py-1.5 text-xs font-medium text-surface-200 hover:bg-surface-800"
            title={resultExpanded ? 'Exit fullscreen (Esc)' : 'Expand result panel'}
            aria-label={resultExpanded ? 'Exit fullscreen' : 'Expand result panel'}
          >
            {resultExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-800">
        <div className={`h-full rounded-full transition-all ${accent.bar}`} style={{ width: `${pct}%` }} />
      </div>

      {/* Complexity metrics */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <MetricChip icon={Clock} label="Time" value={result.timeComplexity} />
        <MetricChip icon={Cpu} label="Space" value={result.spaceComplexity} />
      </div>

      {/* AI feedback on the submission */}
      {result.feedback && (
        <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-300 mb-1.5">
            <Sparkles className="h-3.5 w-3.5" /> AI insights
          </p>
          <MarkdownRenderer content={result.feedback} />
        </div>
      )}

      {result.issues.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
            <AlertCircle className="h-3.5 w-3.5" /> Findings
          </p>
          {result.issues.map((issue, i) => (
            <div key={i} className={`rounded-lg border px-3 py-2 ${SEVERITY_CLASSES[issue.severity]}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">{issue.severity}</p>
              <p className="mt-0.5 text-sm text-surface-200">{issue.message}</p>
              {issue.suggestion && <p className="mt-1 text-xs text-surface-400">{issue.suggestion}</p>}
            </div>
          ))}
        </div>
      )}

      {result.betterApproach && (
        <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-300">
            <Sparkles className="h-3.5 w-3.5" /> Better approach
          </p>
          <MarkdownRenderer content={result.betterApproach} />
        </div>
      )}

      {result.improvedCode && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
            <Code2 className="h-3.5 w-3.5" /> Reference solution
          </p>
          <MarkdownRenderer content={result.improvedCode.includes('```') ? result.improvedCode : '```\n' + result.improvedCode + '\n```'} />
        </div>
      )}
    </motion.div>
  );
}

function MetricChip({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-surface-700/50 bg-surface-950/40 px-3 py-2">
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-surface-400" />
      <span className="text-[11px] text-surface-500">{label}</span>
      <span className="ml-auto truncate font-mono text-xs text-surface-200">{value || '—'}</span>
    </div>
  );
}
