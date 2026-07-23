import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bug, Loader2, Code2, FileCode } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import apiClient from '../api/axios';
import toast from 'react-hot-toast';

export function CodeReviewPage() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [review, setReview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const handleReview = async () => {
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

  const examples = [
    { label: 'TypeScript', code: 'function add(a: any, b: any) { return a + b; }\n\n// Review this function' },
    { label: 'React', code: 'function App() {\n  const [data, setData] = useState(null);\n  useEffect(() => { fetchData().then(setData); }, []);\n  return <div>{data}</div>;\n}' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-100">AI Code Review</h1>
        <p className="mt-1 text-sm text-surface-400">Get instant feedback on your code quality, security, and performance</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
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
            className="h-[400px] w-full resize-none rounded-xl border border-surface-700 bg-surface-900/50 p-4 font-mono text-sm text-surface-200 placeholder-surface-600 focus:border-primary-500/50 focus:outline-none"
          />
          <div className="flex gap-2">
            {examples.map(ex => (
              <button key={ex.label} onClick={() => setCode(ex.code)}
                className="rounded-lg border border-surface-600 bg-surface-800/50 px-3 py-1.5 text-xs text-surface-400 transition-all hover:border-primary-500/30 hover:text-surface-200"
              ><Code2 className="mr-1 inline h-3 w-3" />{ex.label}</button>
            ))}
          </div>
          <button onClick={handleReview} disabled={loading || !code.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-purple-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
            {loading ? 'Analyzing code...' : 'Review Code'}
          </button>
        </div>

        <div>
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
          <div className="h-[400px] overflow-y-auto rounded-xl border border-surface-700 bg-surface-900/50 p-4 backdrop-blur-sm">
            {review ? (
              <div className="prose prose-theme prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{review}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <FileCode className="mb-3 h-10 w-10 text-surface-600" />
                <p className="text-sm text-surface-400">Your review results will appear here</p>
                <p className="mt-1 text-xs text-surface-500">Paste code and click &quot;Review Code&quot; to start</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
