import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, FileCode, GitBranch, Hash, Copy, Check, Inbox } from 'lucide-react';
import apiClient from '../api/axios';

interface SearchResult {
  id: string;
  reportId: string;
  repositoryId: string;
  repoName: string;
  filePath: string;
  line: number;
  snippet: string;
}

export function CodeSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get('/ai/repo-intelligence/search', { params: { q: trimmed } });
      setResults(res.data.data?.results || []);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { runSearch(query); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, runSearch]);

  const copySnippet = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-surface-100">
          <Search className="h-5 w-5 sm:h-6 sm:w-6 text-primary-400" />
          Code Search
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-surface-400">
          Search every indexed repository for a function, variable, or string
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. apiClient, authenticate, JWT_SECRET..."
          autoFocus
          className="w-full rounded-xl border border-surface-700 bg-surface-900 py-3 pl-10 pr-4 text-sm text-surface-100 placeholder-surface-500 focus:border-primary-500/50 focus:outline-none"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-surface-500" />
        )}
      </div>

      {searched && !loading && results.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-surface-700 bg-surface-900/50 py-12 text-center">
          <Inbox className="mb-3 h-8 w-8 text-surface-600" />
          <p className="text-sm font-medium text-surface-300">No matches for &ldquo;{query}&rdquo;</p>
          <p className="mt-1 text-xs text-surface-500">Try a different term or index more repositories</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2 sm:space-y-3">
          <p className="text-xs text-surface-400">{results.length} result{results.length === 1 ? '' : 's'} for &ldquo;{query}&rdquo;</p>
          {results.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-xl border border-surface-700 bg-surface-900/50 transition-colors hover:border-surface-600">
              <div className="flex flex-wrap items-center gap-2 border-b border-surface-700/60 px-3 sm:px-4 py-2.5">
                <span className="flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400">
                  <GitBranch className="h-3 w-3" />
                  {r.repoName}
                </span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-surface-200 min-w-0">
                  <FileCode className="h-3.5 w-3.5 flex-shrink-0 text-surface-400" />
                  <span className="truncate">{r.filePath}</span>
                </span>
                <span className="flex items-center gap-1 rounded bg-surface-800 px-1.5 py-0.5 text-[10px] font-medium text-surface-400">
                  <Hash className="h-3 w-3" />
                  {r.line}
                </span>
                <button
                  onClick={() => copySnippet(r.id, r.snippet)}
                  className="ml-auto flex items-center gap-1 rounded-lg border border-surface-700 px-2 py-1 text-[10px] font-medium text-surface-300 transition-colors hover:bg-surface-800"
                >
                  {copied === r.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copied === r.id ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="max-h-56 overflow-auto p-3 sm:p-4 font-mono text-[11px] leading-relaxed text-surface-300">
                {r.snippet.split('\n').map((line, i) => (
                  <div key={i} className="whitespace-pre">{line}</div>
                ))}
              </pre>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
