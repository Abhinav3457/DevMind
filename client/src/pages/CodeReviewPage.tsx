import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bug, Loader2, Code2, FileCode, BookOpen, Database, AlertCircle, ExternalLink } from 'lucide-react';
import apiClient from '../api/axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer';

interface IndexedReport {
  id: string;
  repoName: string;
  fileCount: number;
  status: string;
}

export function CodeReviewPage() {
  const [mode, setMode] = useState<'snippet' | 'repo'>('snippet');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [review, setReview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const navigate = useNavigate();

  // Repo review state
  const [reports, setReports] = useState<IndexedReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    if (mode === 'repo') fetchReports();
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

  const handleReviewSnippet = async () => {
    if (!code.trim()) { toast.error('Please enter some code to review'); return; }
    setLoading(true);
    setReview(null);
    setScore(null);
    try {
      const res = await apiClient.post('/ai/code-review/review', { code, language, fileName: 'input.' + language });
      const result = res.data.data?.summary || res.data.data?.review || res.data.data?.result || res.data.message;
      const extractedScore = typeof result === 'string' ? parseInt(result.match(/\d+/)?.[0] || '') || null : null;
      if (typeof result === 'string' && result.includes('```')) {
        setReview(result);
      } else if (typeof result === 'object' && result?.summary) {
        setReview(result.summary);
      } else {
        setReview(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
      }
      setScore(extractedScore);
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
        const summary = data.summary || '';
        const cats = data.categories || {};
        let reviewMd = '';
        if (data.score !== undefined) {
          reviewMd += `## REVIEW SCORE\n\n**Score: ${data.score}/100**\n\n`;
        }
        reviewMd += `### SUMMARY\n\n${summary || 'Review completed.'}\n\n`;
        for (const [catName, cat] of Object.entries(cats)) {
          const c = cat as { summary?: string; issues?: unknown[] };
          if (c.summary && c.issues && c.issues.length > 0) {
            reviewMd += `### ${catName.toUpperCase()}\n\n${c.summary}\n\n`;
          }
        }
        if (data.refactoringSuggestions?.length > 0) {
          reviewMd += `### REFACTORING SUGGESTIONS\n\n${data.refactoringSuggestions.length} suggestion(s) found.\n\n`;
        }
        if (data.complexity) {
          const cx = data.complexity;
          reviewMd += `### COMPLEXITY ANALYSIS\n\n`;
          reviewMd += `- Average complexity: **${cx.averageComplexity || 'N/A'}**\n`;
          reviewMd += `- High complexity files: **${(cx.highComplexityFiles || []).length}**\n\n`;
        }
        if (data.duplicateCode?.length > 0) {
          reviewMd += `### DUPLICATE CODE\n\nFound **${data.duplicateCode.length}** duplicate block(s).\n\n`;
        }
        setReview(reviewMd || 'Review completed. No issues found.');
        setScore(data.score ?? null);
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
    { label: 'TypeScript', code: 'function add(a: any, b: any) { return a + b; }\n\n// Review this function' },
    { label: 'React', code: 'function App() {\n  const [data, setData] = useState(null);\n  useEffect(() => { fetchData().then(setData); }, []);\n  return <div>{data}</div>;\n}' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-surface-100 truncate">AI Code Review</h1>
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
          {mode === 'repo' && (
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
            </>
          )}

          {mode === 'snippet' && (
            <>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-surface-200">Paste your code</label>
                <select value={language} onChange={e => setLanguage(e.target.value)}
                  className="rounded-lg border border-surface-600 bg-surface-800 px-3 py-1.5 text-xs text-surface-300"
                >
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="jsx">React JSX</option>
                  <option value="tsx">React TSX</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                </select>
              </div>
              <textarea
                value={code} onChange={e => setCode(e.target.value)}
                placeholder={'// Paste your code here for AI review\nfunction example() {\n  // ...\n}'}
                className="h-[180px] sm:h-[250px] lg:h-[300px] w-full resize-none rounded-xl border border-surface-700 bg-surface-900/50 p-3 sm:p-4 font-mono text-xs sm:text-sm text-surface-200 placeholder-surface-600 focus:border-primary-500/50 focus:outline-none"
              />
              <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                {examples.map(ex => (
                  <button key={ex.label} onClick={() => setCode(ex.code)}
                    className="rounded-lg border border-surface-600 bg-surface-800/50 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-surface-400 transition-all hover:border-primary-500/30 hover:text-surface-200"
                  ><Code2 className="mr-1 inline h-2.5 w-2.5 sm:h-3 sm:w-3" />{ex.label}</button>
                ))}
              </div>
            </>
          )}

          <button onClick={handleReview} disabled={loading || (mode === 'snippet' && !code.trim()) || (mode === 'repo' && !selectedReportId)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-purple-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
            {loading ? 'Analyzing...' : mode === 'repo' ? 'Review Repository' : 'Review Code'}
          </button>
        </div>

        <div className="w-full lg:w-1/2">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-surface-200">Review Results</label>
            {score !== null && (
              <span className={
                'rounded-full px-3 py-1 text-xs font-medium ' +
                (score >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
                 score >= 50 ? 'bg-amber-500/10 text-amber-400' :
                 'bg-red-500/10 text-red-400')
              }>Score: {score}/100</span>
            )}
          </div>
          <div className="h-[250px] sm:h-[350px] lg:h-[400px] overflow-y-auto rounded-xl border border-surface-700 bg-surface-900/50 p-3 sm:p-4 backdrop-blur-sm">
            {review ? (
              <div className="max-w-none">
                <MarkdownRenderer content={review} />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <FileCode className="mb-3 h-10 w-10 text-surface-600" />
                <p className="text-sm text-surface-400">
                  {mode === 'repo' ? 'Select a repository and click "Review Repository"' : 'Paste code and click "Review Code"'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
