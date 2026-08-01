import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bug, Loader2, Code2, BookOpen, Brain, Wand2, Sparkles, AlertCircle, ExternalLink, Database } from 'lucide-react';
import apiClient from '../api/axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer';
import Editor from '@monaco-editor/react';

interface IndexedReport {
  id: string;
  repoName: string;
  fileCount: number;
  status: string;
}

/**
 * Detect programming language from code content using keyword and pattern matching.
 * Returns a monaco-compatible language ID.
 */
function detectLanguage(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return 'typescript';

  // Heuristics sorted by specificity
  const patterns: [RegExp, string][] = [
    // JSX/TSX — MUST run before the HTML tag pattern so JSX with <div> etc.
    // isn't misdetected as HTML
    [/(?:import\s+React|from\s+['"]react['"])/m, 'tsx'],
    [/\b(?:className|onClick|onChange|useState|useEffect|useRef|useCallback|useMemo|return\s*\(?\s*<)/, 'tsx'],
    [/(?:export\s+(?:default\s+)?(?:const|function|class)\s+\w+[\s\S]*?(?:=>\s*\(?\s*<|render\s*\(\s*\)\s*\{))/m, 'tsx'],
    // HTML/XML
    [/^<!DOCTYPE html/i, 'html'],
    [/<(html|body|head|meta|link|script|style|table)\b[^>]*>/i, 'html'],
    [/<\/(html|body|head)\s*>/i, 'html'],
    // TypeScript
    [/\b(?:interface|type|as\s+\w+|: string|: number|: boolean|: any|: void|: Record<|: Partial<|: Pick<|: Omit<|: Promise<)\b/, 'typescript'],
    [/\b(const|let|var)\s+\w+\s*:\s*\w+/s, 'typescript'],
    // JavaScript
    [/^import\s+.*\s+from\s+['"]/m, 'javascript'],
    [/\b(?:module\.exports|require\s*\(|export\s+default|export\s+const\s+\w+\s*=\s*\(|=>\s*{)/, 'javascript'],
    [/\b(?:const|let|var)\s+\w+\s*=\s*(?:require|import)\s*\(/m, 'javascript'],
    // Python
    [/^import\s+\w+/m, 'python'],
    [/^from\s+\w+\s+import\s+/m, 'python'],
    [/\b(?:def\s+\w+\s*\(|class\s+\w+\s*:|print\s*\(|if\s+__name__\s*==\s*['"]__main__['"])/, 'python'],
    [/\b(?:self\s*[.,]|@(?:staticmethod|classmethod|property)\b)/, 'python'],
    // CSS/SCSS
    [/[.#]\w+\s*\{[^}]*\}[.\w\s,#]*\{/s, 'css'],
    [/^\s*[.#]?\w[\w-]*\s*\{/m, 'css'],
    [/@(?:import|media|keyframes|mixin|include|extend)\s/m, 'scss'],
    // JSON
    [/^\s*\{[\s\S]*"[\w]+"\s*:[\s\S]*\}\s*$/, 'json'],
    // SQL
    [/\b(?:SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|JOIN|INNER|LEFT|RIGHT|GROUP BY|ORDER BY)\s/i, 'sql'],
    // Bash
    [/^#!/m, 'bash'],
    [/\b(?:npm|yarn|pnpm|echo|curl|wget|grep|sed|awk|chmod|sudo|apt|yum|brew)\s+/, 'bash'],
    // Markdown
    [/^#{1,6}\s/m, 'markdown'],
    [/\*\*[\w\s]+\*\*|__[\w\s]+__/m, 'markdown'],
    // Go
    [/\b(?:func\s+\w+|package\s+\w+|import\s+\(|fmt\.Print|defer\s+)/, 'go'],
    // Rust
    [/\b(?:fn\s+\w+|let\s+mut\s+|impl\s+|pub\s+(?:fn|struct|enum|trait))\b/, 'rust'],
    // Java
    [/\b(?:public\s+(?:class|void|static)|private\s+\w+\s+\w+\s*\(|System\.out\.print|@Override)\b/, 'java'],
    // C# / CSharp
    [/\b(?:using\s+System|namespace\s+\w+|Console\.(?:WriteLine|ReadLine)|class\s+\w+\s*:\s*\w+)\b/, 'csharp'],
    // C / C++
    [/#include\s*[<"].*[>"]/m, 'cpp'],
    [/\b(?:int\s+main\s*\(|printf\s*\(|cout\s*<<|std::)/, 'cpp'],
    // YAML
    [/^[\w-]+:\s/m, 'yaml'],
    [/^---\s*$/m, 'yaml'],
    // Dockerfile
    [/^FROM\s+\w+/im, 'dockerfile'],
    [/^RUN\s+/im, 'dockerfile'],
    // GraphQL
    [/\b(?:type\s+\w+\s*\{|query\s+\w+\s*\{|mutation\s+\w+\s*\{|scalar\s+)/, 'graphql'],
  ];

  for (const [regex, lang] of patterns) {
    if (regex.test(trimmed)) return lang;
  }

  // Generic HTML tag check — runs AFTER the JSX/TSX patterns above so that
  // React/JSX snippets (which contain <div>, <span>, etc.) are not classified
  // as HTML. Only plain HTML with a couple of tags reaches this point.
  const tagMatches = (trimmed.match(/<\/?[a-z][a-z0-9-]*\b[^>]*>/gi) || []).length;
  if (tagMatches >= 2) return 'html';

  // Fallback: check for common keywords
  if (/\b(function|console\.log|async|await|Promise|new Promise|Array\.from|Object\.keys|try\s*{|catch\s*\()/s.test(trimmed)) return 'javascript';
  if (/\b(public|private|protected|class\s+\w+\s*extends|static\s+void)\b/.test(trimmed)) return 'java';
  if (/\b(def\s+\w+|class\s+\w+:|import\s+\w+\s*$|print\s*\()/m.test(trimmed)) return 'python';

  return 'typescript';
}

/**
 * Map our internal language IDs to Monaco-compatible ones.
 */
function toMonacoLanguage(lang: string): string {
  const map: Record<string, string> = {
    jsx: 'javascript',
    tsx: 'typescript',
    cpp: 'cpp',
    csharp: 'csharp',
    scss: 'scss',
    yaml: 'yaml',
    dockerfile: 'dockerfile',
    graphql: 'graphql',
    sql: 'sql',
    bash: 'bash',
    go: 'go',
    rust: 'rust',
    java: 'java',
    json: 'json',
    markdown: 'markdown',
    python: 'python',
    html: 'html',
    css: 'css',
    javascript: 'javascript',
    typescript: 'typescript',
  };
  return map[lang] || 'typescript';
}

/**
 * Map internal language IDs to extensions for the server.
 */
function toExtension(lang: string): string {
  const map: Record<string, string> = {
    typescript: 'ts',
    javascript: 'js',
    python: 'py',
    jsx: 'jsx',
    tsx: 'tsx',
    html: 'html',
    css: 'css',
    json: 'json',
    markdown: 'md',
    bash: 'sh',
    sql: 'sql',
    go: 'go',
    rust: 'rs',
    java: 'java',
    csharp: 'cs',
    cpp: 'cpp',
    scss: 'scss',
    yaml: 'yml',
    dockerfile: 'Dockerfile',
    graphql: 'graphql',
  };
  return map[lang] || 'ts';
}

interface ReviewIssue {
  type: string;
  severity: string;
  file: string;
  line: number;
  message: string;
  explanation: string;
  recommendation: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  bugs: 'Bugs & Correctness',
  security: 'Security',
  performance: 'Performance',
  codeSmells: 'Code Smells & Maintainability',
  solidViolations: 'Architecture & Design (SOLID)',
};

/**
 * Build a readable markdown report from the structured review payload so the
 * user sees every issue, its fix, the score and the refactoring suggestions —
 * not just a one-line summary.
 */
function renderReviewMarkdown(data: Record<string, unknown>): string {
  const parts: string[] = [];

  const score = data.score;
  if (typeof score === 'number') {
    parts.push(`## Review Score\n\n**${score}/100**\n`);
  }
  if (typeof data.summary === 'string' && data.summary.trim()) {
    parts.push(`## Summary\n\n${data.summary}\n`);
  }

  const cats = (data.categories || {}) as Record<string, { issues?: ReviewIssue[]; summary?: string }>;
  for (const [key, cat] of Object.entries(cats)) {
    const issues = cat?.issues || [];
    if (issues.length === 0) continue;
    parts.push(`## ${CATEGORY_LABELS[key] || key}\n`);
    if (cat.summary) parts.push(`> ${cat.summary}\n`);
    issues.forEach((issue) => {
      const loc = issue.file && issue.file !== 'unknown'
        ? `\`${issue.file}${issue.line ? ':' + issue.line : ''}\``
        : 'Location unknown';
      const sev = issue.severity ? `**${issue.severity.toUpperCase()}**` : '';
      parts.push(`- **${issue.message || 'Issue'}** ${sev} — ${loc}`);
      if (issue.explanation) parts.push(`  ${issue.explanation}`);
      if (issue.recommendation) parts.push(`  **Fix:** ${issue.recommendation.replace(/\n/g, '\n  ')}`);
      parts.push('');
    });
  }

  const suggestions = (data.refactoringSuggestions || []) as {
    title?: string;
    description?: string;
    file?: string;
    priority?: string;
  }[];
  if (suggestions.length > 0) {
    parts.push(`## Refactoring Suggestions\n`);
    suggestions.forEach((s) => {
      parts.push(`- **${s.title || 'Suggestion'}**${s.file ? ` — \`${s.file}\`` : ''}${s.priority ? ` (${s.priority})` : ''}`);
      if (s.description) parts.push(`  ${s.description}`);
    });
    parts.push('');
  }

  const complexity = data.complexity as { averageComplexity?: number; highComplexityFiles?: unknown[] } | undefined;
  if (complexity) {
    parts.push(`## Complexity Analysis\n`);
    parts.push(`- Average complexity: **${complexity.averageComplexity ?? 'N/A'}**`);
    parts.push(`- High complexity files: **${(complexity.highComplexityFiles || []).length}**\n`);
  }

  if (Array.isArray(data.duplicateCode) && (data.duplicateCode as unknown[]).length > 0) {
    parts.push(`## Duplicate Code\n\nFound **${(data.duplicateCode as unknown[]).length}** duplicate block(s).\n`);
  }

  if (typeof data.fixedVersion === 'string' && data.fixedVersion.trim()) {
    parts.push(`## Fixed Version\n\n${data.fixedVersion}\n`);
  }

  return parts.join('\n') || 'Review completed. No issues found.';
}

export function CodeReviewPage() {
  const [mode, setMode] = useState<'snippet' | 'repo'>('snippet');
  const [code, setCode] = useState('');
  const [detectedLang, setDetectedLang] = useState('typescript');
  const [review, setReview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const navigate = useNavigate();

  // Repo review state
  const [reports, setReports] = useState<IndexedReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [loadingReports, setLoadingReports] = useState(false);



  useEffect(() => {
    if (mode === 'repo') fetchReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await apiClient.get('/ai/repo-intelligence/reports');
      const list = res.data.data?.reports || [];
      setReports(list);
      if (list.length > 0) setSelectedReportId(list[0].id);
    } catch { /* ignore */ }
    setLoadingReports(false);
  };

  const handleCodeChange = useCallback((value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);
    if (newCode.trim()) {
      setDetectedLang(detectLanguage(newCode));
    }
  }, []);

  // All languages the detector can return AND the server validator accepts.
  const supportedLanguages = [
    'typescript', 'javascript', 'python', 'jsx', 'tsx', 'html', 'css', 'json', 'markdown',
    'go', 'rust', 'java', 'csharp', 'cpp', 'scss', 'yaml', 'dockerfile', 'graphql', 'sql', 'bash',
  ];

  const handleReviewSnippet = async () => {
    if (!code.trim()) { toast.error('Please enter some code to review'); return; }
    setLoading(true);
    setReview(null);
    setScore(null);
    try {
      // Only send languages the server supports — fall back to typescript for unknown ones
      const safeLang = supportedLanguages.includes(detectedLang) ? detectedLang : 'typescript';
      const res = await apiClient.post('/ai/code-review/review', {
        code,
        language: safeLang,
        fileName: 'input.' + toExtension(safeLang),
      });
      const data = res.data.data;
      if (data) {
        setReview(renderReviewMarkdown(data));
        setScore(typeof data.score === 'number' ? data.score : null);
      } else {
        setReview('No review data returned from server.');
      }
      toast.success('Code review complete!');
    } catch {
      toast.error('Failed to review code. Please try again.');
    } finally { setLoading(false); }
  };

  const handleReviewRepo = async () => {
    if (!selectedReportId) { toast.error('Please select a repository to review'); return; }
    setLoading(true);
    setReview(null);
    setScore(null);
    try {
      const res = await apiClient.post(`/ai/code-review/${selectedReportId}`, { files: undefined });
      const data = res.data.data;
      if (data) {
        setReview(renderReviewMarkdown(data));
        setScore(typeof data.score === 'number' ? data.score : null);
      } else {
        setReview('No review data returned from server.');
      }
      toast.success('Repository review complete!');
    } catch {
      toast.error('Failed to review repository. Make sure it is indexed and try again.');
    } finally { setLoading(false); }
  };

  const handleReview = mode === 'snippet' ? handleReviewSnippet : handleReviewRepo;

  const examples = [
    { label: 'TypeScript', code: 'interface User {\n  id: string;\n  name: string;\n  email: string;\n}\n\nfunction greet(user: User): string {\n  return `Hello, ${user.name}!`;\n}' },
    { label: 'React', code: 'function App() {\n  const [data, setData] = useState(null);\n  useEffect(() => { fetchData().then(setData); }, []);\n  return <div>{data}</div>;\n}' },
    { label: 'Python', code: 'def fibonacci(n: int) -> list:\n    """Generate Fibonacci sequence up to n."""\n    fib = [0, 1]\n    while fib[-1] + fib[-2] <= n:\n        fib.append(fib[-1] + fib[-2])\n    return fib' },
    { label: 'HTML', code: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>My Page</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>' },
  ];

  const langColors: Record<string, string> = {
    typescript: 'bg-blue-500/10 text-blue-400',
    javascript: 'bg-yellow-500/10 text-yellow-400',
    python: 'bg-green-500/10 text-green-400',
    tsx: 'bg-cyan-500/10 text-cyan-400',
    jsx: 'bg-cyan-500/10 text-cyan-400',
    html: 'bg-orange-500/10 text-orange-400',
    css: 'bg-pink-500/10 text-pink-400',
    json: 'bg-emerald-500/10 text-emerald-400',
    bash: 'bg-gray-500/10 text-gray-400',
    sql: 'bg-amber-500/10 text-amber-400',
    go: 'bg-sky-500/10 text-sky-400',
    rust: 'bg-red-500/10 text-red-400',
    java: 'bg-orange-500/10 text-orange-400',
    csharp: 'bg-purple-500/10 text-purple-400',
    cpp: 'bg-indigo-500/10 text-indigo-400',
    markdown: 'bg-gray-500/10 text-gray-400',
    yaml: 'bg-red-500/10 text-red-400',
    graphql: 'bg-pink-500/10 text-pink-400',
    dockerfile: 'bg-sky-500/10 text-sky-400',
    scss: 'bg-pink-500/10 text-pink-400',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-surface-100 truncate flex items-center gap-2">
            <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-primary-400" />
            AI Code Review
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-surface-400">Get instant feedback on your code quality, security, and performance</p>
        </div>
        <div className="flex rounded-lg border border-surface-700 bg-surface-800 p-0.5 self-start sm:self-auto">
          <button onClick={() => setMode('snippet')}
            className={`flex items-center gap-1 rounded-md px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium transition-all ${
              mode === 'snippet' ? 'bg-primary-600 text-white shadow-sm' : 'text-surface-400 hover:text-surface-200'
            }`}
          ><Code2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Code</button>
          <button onClick={() => setMode('repo')}
            className={`flex items-center gap-1 rounded-md px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium transition-all ${
              mode === 'repo' ? 'bg-primary-600 text-white shadow-sm' : 'text-surface-400 hover:text-surface-200'
            }`}
          ><BookOpen className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Repo</button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        <div className="space-y-4 w-full lg:w-1/2">
          {mode === 'repo' ? (
            <>
              {loadingReports ? (
                <div className="flex items-center gap-2 text-sm text-surface-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading repositories...
                </div>
              ) : reports.length === 0 ? (
                <div className="rounded-xl border border-amber-700/50 bg-amber-900/20 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
                    <div className="text-sm text-amber-200">
                      No indexed repositories found.{' '}
                      <button onClick={() => navigate('/github')}
                        className="inline-flex items-center gap-1 font-medium text-primary-400 underline hover:text-primary-300"
                      >
                        Go to GitHub <ExternalLink className="h-3 w-3" />
                      </button>
                      {' '}to import and index a repository first.
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-200">Select Repository</label>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-surface-500" />
                    <select value={selectedReportId} onChange={e => setSelectedReportId(e.target.value)}
                      className="flex-1 rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-xs text-surface-300 focus:border-primary-500/50 focus:outline-none"
                    >
                      {reports.map(r => (
                        <option key={r.id} value={r.id}>{r.repoName} ({r.fileCount} files)</option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-2 text-xs text-surface-500">
                    The AI will analyze all indexed files in this repository.
                  </p>
                </div>
              )}
              <button onClick={handleReview} disabled={loading || !selectedReportId}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-purple-500 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                {loading ? 'Analyzing...' : 'Review Repository'}
              </button>
            </>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-surface-200 flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-primary-400" />
                    Paste your code
                  </label>
                  {code.trim() && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${langColors[detectedLang] || 'bg-surface-800 text-surface-400'}`}>
                      <Code2 className="h-3 w-3" />
                      {detectedLang}
                    </span>
                  )}
                </div>
                <div className={`overflow-hidden rounded-xl border transition-all duration-200 ${editorReady ? 'border-surface-600' : 'border-surface-700'} ${!code.trim() ? 'opacity-80' : ''}`}>
                  <Editor
                    height="280px"
                    language={toMonacoLanguage(detectedLang)}
                    value={code}
                    onChange={handleCodeChange}
                    onMount={() => setEditorReady(true)}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      padding: { top: 12, bottom: 12 },
                      folding: true,
                      foldingHighlight: true,
                      automaticLayout: true,
                      tabSize: 2,
                      renderWhitespace: 'selection',
                      bracketPairColorization: { enabled: true },
                      suggestOnTriggerCharacters: false,
                      quickSuggestions: false,
                      wordWrap: 'on',
                    }}
                  />
                </div>
                {!code.trim() && (
                  <p className="mt-1.5 text-[10px] text-surface-500">Start typing or paste code — language is detected automatically</p>
                )}
              </div>

              <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                {examples.map(ex => (
                  <button key={ex.label} onClick={() => handleCodeChange(ex.code)}
                    className="flex items-center gap-1 rounded-lg border border-surface-600 bg-surface-800/50 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-surface-400 transition-all hover:border-primary-500/30 hover:text-surface-200 hover:bg-surface-800/80"
                  ><Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary-400" />{ex.label}</button>
                ))}
              </div>

              <button onClick={handleReview} disabled={loading || !code.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
                {loading ? 'Analyzing with AI...' : 'Review Code'}
              </button>
            </>
          )}
        </div>

        <div className="w-full lg:w-1/2">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-surface-200">Review Results</label>
            <div className="flex items-center gap-2">
              {code.trim() && detectedLang && (
                <span className="rounded-full bg-surface-800 px-2 py-0.5 text-[10px] text-surface-400">
                  {code.length} chars
                </span>
              )}
              {score !== null && (
                <span className={
                  'rounded-full px-3 py-1 text-xs font-medium ' +
                  (score >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
                   score >= 50 ? 'bg-amber-500/10 text-amber-400' :
                   'bg-red-500/10 text-red-400')
                }>Score: {score}/100</span>
              )}
            </div>
          </div>
          <div className="h-[350px] sm:h-[400px] lg:h-[450px] overflow-y-auto rounded-xl border border-surface-700 bg-surface-900/50 p-3 sm:p-4 backdrop-blur-sm">
            {review ? (
              <div className="max-w-none">
                <MarkdownRenderer content={review} />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 ring-1 ring-blue-500/20">
                  <Brain className="h-7 w-7 text-primary-400" />
                </div>
                <p className="text-sm font-medium text-surface-300">Ready to Review</p>
                <p className="mt-1 text-xs text-surface-500 max-w-xs">
                  Paste your code on the left, then click <span className="text-primary-400 font-medium">Review Code</span> to get AI-powered feedback
                </p>
                <div className="mt-5 grid grid-cols-3 gap-2 text-[10px] text-surface-500">
                  <div className="rounded-lg bg-surface-800/50 p-2 text-center">
                    <div className="font-medium text-surface-400">Quality</div>
                    <div className="mt-0.5">Bugs & style</div>
                  </div>
                  <div className="rounded-lg bg-surface-800/50 p-2 text-center">
                    <div className="font-medium text-surface-400">Security</div>
                    <div className="mt-0.5">Vulnerabilities</div>
                  </div>
                  <div className="rounded-lg bg-surface-800/50 p-2 text-center">
                    <div className="font-medium text-surface-400">Performance</div>
                    <div className="mt-0.5">Optimizations</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}