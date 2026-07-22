import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, Bot, User, AlertCircle, Database, RefreshCw, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import apiClient from '../api/axios';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface IndexStatus {
  hasReport: boolean;
  reportId: string | null;
  status: string | null;
  fileCount: number | null;
  repoName: string | null;
  loading: boolean;
}

const initialState: IndexStatus = {
  hasReport: false,
  reportId: null,
  status: null,
  fileCount: null,
  repoName: null,
  loading: true,
};

export function AiChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your AI coding assistant. Ask me anything about your repositories, code, or project architecture.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexStatus, setIndexStatus] = useState<IndexStatus>(initialState);
  const [reports, setReports] = useState<{ id: string; repoName: string; fileCount: number }[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>('latest');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if user has any indexed repo on mount and fetch reports list
  useEffect(() => {
    checkIndexStatus();
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await apiClient.get('/ai/repo-intelligence/reports');
      const list = res.data.data?.reports || [];
      setReports(list);
      if (list.length > 0) {
        setSelectedReportId(list[0].id);
      }
    } catch { /* ignore */ }
  };

  const checkIndexStatus = async () => {
    setIndexStatus((prev) => ({ ...prev, loading: true }));
    try {
      const res = await apiClient.get('/ai/repo-intelligence/status');
      const status = res.data.data;
      if (status?.hasReport) {
        setIndexStatus({
          hasReport: true,
          reportId: status.reportId,
          status: 'completed',
          fileCount: status.fileCount,
          repoName: null,
          loading: false,
        });
      } else if (status?.status && ['pending', 'processing'].includes(status.status)) {
        setIndexStatus({
          hasReport: false,
          reportId: null,
          status: 'processing',
          fileCount: null,
          repoName: null,
          loading: false,
        });
      } else {
        setIndexStatus({
          hasReport: false,
          reportId: null,
          status: 'no_index',
          fileCount: null,
          repoName: null,
          loading: false,
        });
      }
    } catch {
      setIndexStatus({
        hasReport: false,
        reportId: null,
        status: 'no_index',
        fileCount: null,
        repoName: null,
        loading: false,
      });
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiClient.post('/ai/repo-intelligence/query', {
        question: input.trim(),
        reportId: selectedReportId,
      });
      const answer = res.data.data?.answer || res.data.data?.response || 'No response received.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: answer, timestamp: new Date() },
      ]);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      const serverMsg = axiosErr?.response?.data?.message || 'Could not connect to the server. Please make sure the backend is running.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `**Error:** ${serverMsg}\n\n---\n*Tip: Go to the **GitHub** page to import and index a repository first.*`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Explain the project architecture',
    'How is authentication implemented?',
    'Where is the database connected?',
    'Explain the API flow',
  ];

  const statusBanner = () => {
    if (indexStatus.loading) {
      return (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-800/50 px-4 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          <span className="text-xs text-gray-400">Checking indexing status...</span>
        </div>
      );
    }

    if (indexStatus.hasReport) {
      return (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-4 py-2">
          <Database className="h-4 w-4 text-emerald-400" />
          <span className="text-xs text-emerald-400">
            Repository indexed{indexStatus.fileCount ? ` (${indexStatus.fileCount} files analyzed)` : ''} — ready to answer questions!
          </span>
          <RefreshCw
            className="ml-auto h-3.5 w-3.5 cursor-pointer text-gray-500 hover:text-gray-300"
            onClick={checkIndexStatus}
          />
        </div>
      );
    }

    if (indexStatus.status === 'processing') {
      return (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
          <span className="text-xs text-amber-400">Indexing is still in progress. Please wait for it to complete.</span>
        </div>
      );
    }

    if (indexStatus.status === 'no_index') {
      return (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-400" />
          <span className="text-xs text-amber-300">
            No repository has been indexed. Go to{' '}
            <button
              onClick={() => navigate('/github')}
              className="inline-flex items-center gap-1 font-medium text-primary-400 underline hover:text-primary-300"
            >
              GitHub <ExternalLink className="h-3 w-3" />
            </button>{' '}
            to import and index a repository first.
          </span>
          <RefreshCw
            className="ml-auto h-3.5 w-3.5 cursor-pointer text-gray-500 hover:text-gray-300"
            onClick={checkIndexStatus}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-[calc(100vh-8rem)] flex-col"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">AI Assistant</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ask questions about your codebase
          </p>
        </div>
        <div className="flex items-center gap-3">
          {reports.length > 0 && (
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-gray-500" />
              <select
                value={selectedReportId}
                onChange={(e) => setSelectedReportId(e.target.value)}
                className="rounded-lg border border-surface-700 bg-surface-800 px-3 py-1.5 text-xs text-gray-300 focus:border-primary-500/50 focus:outline-none max-w-[200px]"
              >
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.repoName} ({r.fileCount} files)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-surface-800 bg-surface-900/50 p-4 backdrop-blur-sm">
        {statusBanner()}

        {messages.length <= 1 && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setInput(s);
                }}
                className="rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-left text-xs text-gray-400 transition-all hover:border-primary-500/30 hover:text-gray-300"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={
                'flex gap-3 ' + (msg.role === 'user' ? 'justify-end' : 'justify-start')
              }
            >
              {msg.role === 'assistant' && (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              <div
                className={
                  'max-w-[80%] rounded-xl px-4 py-3 ' +
                  (msg.role === 'user'
                    ? 'bg-primary-600/20 text-gray-200'
                    : 'bg-surface-800/80 text-gray-300')
                }
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
                <p className="mt-1 text-right text-[10px] text-gray-600">
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              {msg.role === 'user' && (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-700">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
              )}
            </motion.div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={
            indexStatus.hasReport
              ? 'Ask a question about your code...'
              : 'Index a repo first, then ask questions...'
          }
          className="flex-1 rounded-xl border border-surface-800 bg-surface-900 px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:border-primary-500/50 focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-medium text-white transition-all hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send
        </button>
      </div>
    </motion.div>
  );
}
