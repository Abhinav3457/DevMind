import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Loader2, Bot, User, AlertCircle, Database, RefreshCw,
  ExternalLink, MessageSquare, BookOpen, Plus, Trash2, Clock, ChevronLeft, ChevronRight,
} from 'lucide-react';
import apiClient from '../api/axios';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  _id: string;
  title: string;
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

interface IndexStatus {
  hasReport: boolean;
  reportId: string | null;
  status: string | null;
  fileCount: number | null;
  repoName: string | null;
  loading: boolean;
}

type ChatMode = 'general' | 'repo';

const initialState: IndexStatus = {
  hasReport: false, reportId: null, status: null,
  fileCount: null, repoName: null, loading: true,
};

const generalSuggestions = [
  'Write a React hook for debouncing user input',
  'Explain the difference between REST and GraphQL with code',
  'Show me how to implement JWT authentication in Node.js',
  'Create a TypeScript utility type for deep partial objects',
  'How do I optimize database queries in MongoDB?',
  'Write a Python function to merge two sorted arrays',
];

const repoSuggestions = [
  'Explain the project architecture in detail',
  'How is authentication implemented? Show the code flow',
  'Where is the database connected? Show the connection code',
  'List all API endpoints and their middleware',
  'Explain the folder structure and key modules',
  'What technologies and libraries are used?',
];

const WELCOME_MSG = 'Hello! I am your AI coding assistant. Ask me anything about coding, or select **Repo Q&A** to ask questions about your indexed repositories.';

export function AiChatPage() {
  const [mode, setMode] = useState<ChatMode>('general');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexStatus, setIndexStatus] = useState<IndexStatus>(initialState);
  const [reports, setReports] = useState<{ id: string; repoName: string; fileCount: number }[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>('latest');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // ── Chat Session State ───────────────────────────────────
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Load latest session or show welcome
  useEffect(() => {
    if (!loadingSessions && sessions.length > 0 && !activeChatId && sessions[0]) {
      loadChatMessages(sessions[0]._id);
    } else if (!loadingSessions && sessions.length === 0 && messages.length === 0) {
      setMessages([{ role: 'assistant', content: WELCOME_MSG, timestamp: new Date() }]);
    }
  }, [loadingSessions]);

  // Load reports when switching to repo mode
  useEffect(() => {
    if (mode === 'repo') {
      checkIndexStatus();
      fetchReports();
    }
  }, [mode]);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await apiClient.get('/ai/chat/sessions');
      setSessions(res.data.data?.chats || []);
    } catch { /* ignore */ }
    setLoadingSessions(false);
  };

  const createNewChat = async () => {
    try {
      const res = await apiClient.post('/ai/chat/sessions');
      const chat = res.data.data?.chat;
      if (chat) {
        setActiveChatId(chat._id);
        setSessions((prev) => [chat, ...prev]);
        setMessages([{ role: 'assistant', content: 'New chat. Ask me anything!', timestamp: new Date() }]);
      }
    } catch { /* ignore */ }
  };

  const loadChatMessages = async (chatId: string) => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/ai/chat/sessions/${chatId}`);
      const msgs = res.data.data?.messages || [];
      setActiveChatId(chatId);
      if (msgs.length > 0) {
        setMessages(msgs.map((m: { role: string; content: string; createdAt: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.createdAt),
        })));
      } else {
        setMessages([{ role: 'assistant', content: 'New chat. Ask me anything!', timestamp: new Date() }]);
      }
    } catch {
      setActiveChatId(null);
      setMessages([{ role: 'assistant', content: WELCOME_MSG, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/ai/chat/sessions/${chatId}`);
      setSessions((prev) => prev.filter((s) => s._id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
        const remaining = sessions.filter((s) => s._id !== chatId);
        if (remaining.length > 0 && remaining[0]) {
          loadChatMessages(remaining[0]._id);
        } else {
          setMessages([{ role: 'assistant', content: WELCOME_MSG, timestamp: new Date() }]);
        }
      }
    } catch { /* ignore */ }
  };

  const fetchReports = async () => {
    try {
      const res = await apiClient.get('/ai/repo-intelligence/reports');
      const list = res.data.data?.reports || [];
      setReports(list);
      if (list.length > 0) setSelectedReportId(list[0].id);
    } catch { /* ignore */ }
  };

  const checkIndexStatus = async () => {
    setIndexStatus((prev) => ({ ...prev, loading: true }));
    try {
      const res = await apiClient.get('/ai/repo-intelligence/status');
      const status = res.data.data;
      if (status?.hasReport) {
        setIndexStatus({ hasReport: true, reportId: status.reportId, status: 'completed', fileCount: status.fileCount, repoName: null, loading: false });
      } else if (status?.status && ['pending', 'processing'].includes(status.status)) {
        setIndexStatus({ hasReport: false, reportId: null, status: 'processing', fileCount: null, repoName: null, loading: false });
      } else {
        setIndexStatus({ hasReport: false, reportId: null, status: 'no_index', fileCount: null, repoName: null, loading: false });
      }
    } catch {
      setIndexStatus({ hasReport: false, reportId: null, status: 'no_index', fileCount: null, repoName: null, loading: false });
    }
  };

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (activeChatId) return activeChatId;
    try {
      const res = await apiClient.post('/ai/chat/sessions');
      const chat = res.data.data?.chat;
      if (chat) {
        setActiveChatId(chat._id);
        setSessions((prev) => [chat, ...prev]);
        return chat._id;
      }
    } catch { /* ignore */ }
    return null;
  }, [activeChatId]);

  const handleSendGeneral = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');

    const userMsg: Message = { role: 'user', content: userMessage, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const recentHistory = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));

      const body: Record<string, unknown> = { message: userMessage, history: recentHistory };

      // Create or use existing session
      if (!activeChatId) {
        const chatId = await ensureSession();
        if (chatId) body.chatId = chatId;
      } else {
        body.chatId = activeChatId;
      }

      const res = await apiClient.post('/ai/chat/generate', body);
      const answer = res.data.data?.answer || 'No response received.';

      setMessages((prev) => [...prev, { role: 'assistant', content: answer, timestamp: new Date() }]);

      // Reload sessions to get updated title
      loadSessions();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      const serverMsg = axiosErr?.response?.data?.message || 'Could not connect to the AI service. Please check your API keys and server configuration.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `**Error:** ${serverMsg}`, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRepo = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');

    const userMsg: Message = { role: 'user', content: userMessage, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await apiClient.post('/ai/repo-intelligence/query', {
        question: userMessage,
        reportId: selectedReportId,
      });
      const answer = res.data.data?.answer || res.data.data?.response || 'No response received.';
      setMessages((prev) => [...prev, { role: 'assistant', content: answer, timestamp: new Date() }]);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      const serverMsg = axiosErr?.response?.data?.message || 'Could not connect to the AI service. Make sure your API keys (GEMINI_API_KEY or GROQ_API_KEY) are configured in the server environment variables.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `**Error:** ${serverMsg}`, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = mode === 'general' ? handleSendGeneral : handleSendRepo;
  const suggestions = mode === 'general' ? generalSuggestions : repoSuggestions;

  const statusBanner = () => {
    if (mode !== 'repo') return null;
    if (indexStatus.loading) {
      return (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-800/50 px-4 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-surface-400" />
          <span className="text-xs text-surface-400">Checking indexing status...</span>
        </div>
      );
    }
    if (indexStatus.hasReport) {
      return (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-4 py-2">
          <Database className="h-4 w-4 text-emerald-400" />
          <span className="text-xs text-emerald-400">
            Repository indexed{indexStatus.fileCount ? ` (${indexStatus.fileCount} files analyzed)` : ''} — ready!
          </span>
          <RefreshCw className="ml-auto h-3.5 w-3.5 cursor-pointer text-surface-500 hover:text-surface-300" onClick={checkIndexStatus} />
        </div>
      );
    }
    if (indexStatus.status === 'no_index') {
      return (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-400" />
          <span className="text-xs text-amber-300">
            No repository has been indexed.{' '}
            <button onClick={() => navigate('/github')} className="inline-flex items-center gap-1 font-medium text-primary-400 underline hover:text-primary-300">
              GitHub <ExternalLink className="h-3 w-3" />
            </button>{' '}
            to import and index a repository first.
          </span>
        </div>
      );
    }
    return null;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-[calc(100vh-8rem)] gap-4">
      {/* ── Sidebar ──────────────────────────────────────── */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div className="flex h-full w-[260px] flex-col rounded-xl border border-surface-700 bg-surface-900/50 backdrop-blur-sm">
              {/* Sidebar Header */}
              <div className="flex items-center justify-between border-b border-surface-700/50 p-3">
                <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Chats</h2>
                <button
                  onClick={createNewChat}
                  className="flex items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1.5 text-[11px] font-medium text-white transition-all hover:bg-primary-700"
                >
                  <Plus className="h-3 w-3" />
                  New
                </button>
              </div>

              {/* Session List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loadingSessions ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-surface-500" />
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="px-2 py-8 text-center text-xs text-surface-500">No chats yet.<br />Start a new conversation!</p>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => loadChatMessages(session._id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadChatMessages(session._id); } }}
                      className={`w-full rounded-lg p-2.5 text-left transition-all group cursor-pointer ${
                        activeChatId === session._id
                          ? 'bg-primary-600/10 border border-primary-500/30'
                          : 'hover:bg-surface-800/50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-medium ${
                            activeChatId === session._id ? 'text-primary-300' : 'text-surface-200'
                          }`}>
                            {session.title || 'New Chat'}
                          </p>
                          {session.lastMessage && (
                            <p className="mt-0.5 truncate text-[11px] text-surface-500">
                              {session.lastMessage.slice(0, 80)}
                            </p>
                          )}
                          <p className="mt-1 flex items-center gap-1 text-[10px] text-surface-600">
                            <Clock className="h-3 w-3" />
                            {formatDate(session.updatedAt || session.createdAt)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteChat(session._id, e)}
                          className="mt-0.5 flex-shrink-0 rounded-md p-1 text-surface-600 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                          title="Delete chat"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Chat Area ────────────────────────────────── */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="rounded-lg border border-surface-700 bg-surface-800 p-2 text-surface-400 transition-all hover:bg-surface-700 hover:text-surface-200"
              title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
            >
              {showSidebar ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <div>
              <h1 className="text-2xl font-bold text-surface-100">AI Assistant</h1>
              <p className="mt-1 text-sm text-surface-400">
                {mode === 'general' ? 'Your personal coding assistant' : 'Ask questions about your codebase'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode Toggle */}
            <div className="flex rounded-lg border border-surface-700 bg-surface-800 p-0.5">
              <button onClick={() => setMode('general')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  mode === 'general' ? 'bg-primary-600 text-white shadow-sm' : 'text-surface-400 hover:text-surface-200'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                General
              </button>
              <button onClick={() => setMode('repo')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  mode === 'repo' ? 'bg-primary-600 text-white shadow-sm' : 'text-surface-400 hover:text-surface-200'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Repo
              </button>
            </div>

            {mode === 'repo' && reports.length > 0 && (
              <select value={selectedReportId} onChange={(e) => setSelectedReportId(e.target.value)}
                className="rounded-lg border border-surface-700 bg-surface-800 px-3 py-1.5 text-xs text-surface-300 focus:border-primary-500/50 focus:outline-none max-w-[180px]"
              >
                {reports.map((r) => <option key={r.id} value={r.id}>{r.repoName} ({r.fileCount}f)</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-surface-700 bg-surface-900/50 p-4 backdrop-blur-sm">
          {statusBanner()}

          {messages.length <= 1 && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => setInput(s)}
                  className="rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2 text-left text-xs text-surface-400 transition-all hover:border-primary-500/30 hover:text-surface-200"
                >{s}</button>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={`${i}-${msg.timestamp.getTime()}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={'flex gap-3 ' + (msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={'max-w-[80%] rounded-xl px-4 py-3 ' +
                      (msg.role === 'user' ? 'bg-primary-600/20 text-surface-100' : 'bg-surface-800/80 text-surface-200')}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="max-w-none">
                        <MarkdownRenderer content={msg.content} />
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                    <p className="mt-1 text-right text-[10px] text-surface-500">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-700">
                      <User className="h-4 w-4 text-surface-400" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-surface-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={mode === 'general' ? 'Ask a coding question...' : indexStatus.hasReport ? 'Ask a question about your code...' : 'Index a repo first...'}
            className="flex-1 rounded-xl border border-surface-700 bg-surface-900 px-4 py-3 text-sm text-surface-100 placeholder-surface-500 focus:border-primary-500/50 focus:outline-none"
          />
          <button onClick={handleSend} disabled={loading || !input.trim()}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-medium text-white transition-all hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </div>
      </div>
    </motion.div>
  );
}
