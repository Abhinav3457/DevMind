import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Loader2, Bot, User, AlertCircle, Database, RefreshCw,
  ExternalLink, MessageSquare, BookOpen, Plus, Trash2, Clock, ChevronLeft,
} from 'lucide-react';
import apiClient from '../api/axios';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer';

interface SourceRef {
  filePath: string;
  startLine: number;
  endLine: number;
  type: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: SourceRef[];
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
  'Write a React hook that debounces user input',
  'Compare REST and GraphQL with practical code examples',
  'Show me how to implement JWT authentication in Node.js',
  'Create a TypeScript utility type for deep partial objects',
  'How can I optimize database queries in MongoDB?',
  'Write a Python function that merges two sorted arrays',
];

const repoSuggestions = [
  'Explain the project architecture in detail',
  'How is authentication implemented? Walk me through the code flow',
  'Where is the database connected? Show the connection code',
  'List all API endpoints and the middleware they use',
  'Explain the folder structure and key modules',
  'Which technologies and libraries does this project use?',
];

const WELCOME_MSG = 'Hello! I\'m your AI coding assistant. Ask me any development question, or switch to **Repo Q&A** to explore your indexed repositories.';

export function AiChatPage() {
  const [mode, setMode] = useState<ChatMode>('general');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexStatus, setIndexStatus] = useState<IndexStatus>(initialState);
  const [reports, setReports] = useState<{ id: string; repoName: string; fileCount: number }[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>('latest');
  const [repoContextId, setRepoContextId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // ── Chat Session State ───────────────────────────────────
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load sessions + indexed reports (for optional repo context) on mount
  useEffect(() => {
    loadSessions();
    fetchReports();
  }, []);

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
        setMessages([{ role: 'assistant', content: 'New conversation. What would you like to work on?', timestamp: new Date() }]);
      }
    } catch { /* ignore */ }
  };

  const loadChatMessages = useCallback(async (chatId: string) => {
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
        setMessages([{ role: 'assistant', content: 'New conversation. What would you like to work on?', timestamp: new Date() }]);
      }
    } catch {
      setActiveChatId(null);
      setMessages([{ role: 'assistant', content: WELCOME_MSG, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load latest session or show welcome — runs once after sessions finish
  // loading (the didInit ref guards against re-runs from new state identities).
  const didInit = useRef(false);
  useEffect(() => {
    if (loadingSessions || didInit.current) return;
    didInit.current = true;
    if (sessions.length > 0 && !activeChatId && sessions[0]) {
      loadChatMessages(sessions[0]._id);
    } else if (sessions.length === 0 && messages.length === 0) {
      setMessages([{ role: 'assistant', content: WELCOME_MSG, timestamp: new Date() }]);
    }
  }, [loadingSessions, sessions, activeChatId, messages.length, loadChatMessages]);

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
      if (repoContextId) body.reportId = repoContextId;

      if (!activeChatId) {
        const chatId = await ensureSession();
        if (chatId) body.chatId = chatId;
      } else {
        body.chatId = activeChatId;
      }

      const res = await apiClient.post('/ai/chat/generate', body);
      const answer = res.data.data?.answer || 'No response received.';
      const sources: SourceRef[] = res.data.data?.sources || [];

      setMessages((prev) => [...prev, { role: 'assistant', content: answer, sources, timestamp: new Date() }]);

      loadSessions();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      const serverMsg = axiosErr?.response?.data?.message || 'Could not connect to the AI service. Please check your API keys and server configuration.';
      // Stale repo context (deleted index) — clear it so the next message falls back to general chat
      let finalMsg = serverMsg;
      if (/Index report not found|has not completed|No completed index/i.test(serverMsg)) {
        setRepoContextId('');
        finalMsg = 'The selected repository context is no longer available — I\'ve cleared it. ' + serverMsg;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: `**Error:** ${finalMsg}`, timestamp: new Date() }]);
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
      const sources: SourceRef[] = res.data.data?.sources || [];
      setMessages((prev) => [...prev, { role: 'assistant', content: answer, sources, timestamp: new Date() }]);
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
        <div className="mb-3 sm:mb-4 flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-800/50 px-3 sm:px-4 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-surface-400 flex-shrink-0" />
          <span className="text-xs text-surface-400 truncate">Checking indexing status...</span>
        </div>
      );
    }
    if (indexStatus.hasReport) {
      return (
        <div className="mb-3 sm:mb-4 flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-3 sm:px-4 py-2">
          <Database className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          <span className="text-xs text-emerald-400 truncate">
            Repository indexed{indexStatus.fileCount ? ` · ${indexStatus.fileCount} files` : ''} — ready for questions
          </span>
          <RefreshCw className="ml-auto h-3.5 w-3.5 flex-shrink-0 cursor-pointer text-surface-500 hover:text-surface-300" onClick={checkIndexStatus} />
        </div>
      );
    }
    if (indexStatus.status === 'no_index') {
      return (
        <div className="mb-3 sm:mb-4 flex items-center gap-2 rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 sm:px-4 py-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-400" />
          <span className="text-xs text-amber-300">
            No repository has been indexed yet.{' '}
            <button onClick={() => navigate('/github')} className="inline-flex items-center gap-1 font-medium text-primary-400 underline hover:text-primary-300 whitespace-nowrap">
              GitHub <ExternalLink className="h-3 w-3" />
            </button>
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

  // ── Animation Variants ────────────────────────────────────────

  const chatSidebarVariants = {
    closed: {
      x: '-100%',
      opacity: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 35,
        mass: 1,
      },
    },
    open: {
      x: 0,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 400,
        damping: 30,
        mass: 0.8,
        staggerChildren: 0.03,
        delayChildren: 0.08,
      },
    },
  };

  const sessionItemVariants = {
    closed: { opacity: 0, x: -15 },
    open: {
      opacity: 1,
      x: 0,
      transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
    },
  };

  const chatOverlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
    exit: { opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } },
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-[calc(100vh-10rem)] sm:h-[calc(100vh-12rem)] lg:h-[calc(100vh-8rem)]">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            key="chat-overlay"
            variants={chatOverlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-40 bg-surface-950/60 backdrop-blur-sm lg:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-1 gap-3 sm:gap-4 min-h-0">
        {/* Sidebar */}
        <AnimatePresence>
          {showSidebar && (
            <motion.aside
              key="chat-sidebar"
              variants={chatSidebarVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="flex-shrink-0 overflow-hidden lg:relative lg:z-auto fixed left-0 top-0 z-50 h-full pt-14 lg:pt-0"
            >
              <div className="flex h-full w-[240px] max-w-[85vw] flex-col rounded-none lg:rounded-xl border-0 lg:border border-surface-700 bg-surface-900/95 lg:bg-surface-900/50 backdrop-blur-xl lg:backdrop-blur-sm shadow-2xl shadow-black/40">
                {/* Sidebar Header */}
                <div className="flex items-center justify-between border-b border-surface-700/50 p-2.5 sm:p-3">
                  <motion.h2
                    initial={false}
                    className="text-[10px] sm:text-xs font-semibold text-surface-400 uppercase tracking-wider"
                  >
                    Chats
                  </motion.h2>
                  <div className="flex items-center gap-1">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={createNewChat}
                      className="flex items-center gap-1 rounded-lg bg-primary-600 px-2 sm:px-2.5 py-1.5 text-[10px] sm:text-[11px] font-medium text-white transition-all hover:bg-primary-700"
                    >
                      <Plus className="h-3 w-3" />
                      <span className="hidden sm:inline">New</span>
                    </motion.button>
                    <button
                      onClick={() => setShowSidebar(false)}
                      className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-800 lg:hidden transition-colors"
                      aria-label="Close sidebar"
                    >
                      <motion.div
                        animate={{ rotate: 180 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </motion.div>
                    </button>
                  </div>
                </div>

                {/* Session List */}
                <div className="flex-1 overflow-y-auto p-1.5 sm:p-2 space-y-1">
                  {loadingSessions ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-4 w-4 animate-spin text-surface-500" />
                    </div>
                  ) : sessions.length === 0 ? (
                    <motion.p
                      variants={sessionItemVariants}
                      className="px-2 py-8 text-center text-[10px] sm:text-xs text-surface-500"
                    >
                      No conversations yet.<br />Start a new chat to get going.
                    </motion.p>
                  ) : (
                    sessions.map((session) => (
                      <motion.div
                        key={session._id}
                        variants={sessionItemVariants}
                        role="button"
                        tabIndex={0}
                        onClick={() => { loadChatMessages(session._id); if (window.innerWidth < 1024) setShowSidebar(false); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadChatMessages(session._id); if (window.innerWidth < 1024) setShowSidebar(false); }}}
                        className={`w-full rounded-lg p-2 sm:p-2.5 text-left transition-all group cursor-pointer ${
                          activeChatId === session._id
                            ? 'bg-primary-600/10 border border-primary-500/30'
                            : 'hover:bg-surface-800/50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 sm:gap-2">
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-xs sm:text-sm font-medium ${
                              activeChatId === session._id ? 'text-primary-300' : 'text-surface-200'
                            }`}>
                              {session.title || 'Untitled conversation'}
                            </p>
                            {session.lastMessage && (
                              <p className="mt-0.5 truncate text-[10px] sm:text-[11px] text-surface-500">
                                {session.lastMessage.slice(0, 60)}
                              </p>
                            )}
                            <p className="mt-1 flex items-center gap-1 text-[9px] sm:text-[10px] text-surface-600">
                              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              {formatDate(session.updatedAt || session.createdAt)}
                            </p>
                          </div>
                          <button
                            onClick={(e) => deleteChat(session._id, e)}
                            className="mt-0.5 flex-shrink-0 rounded-md p-1 text-surface-600 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                            title="Delete chat"
                          >
                            <Trash2 className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── Main Chat Area ────────────────────────────────── */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Header */}
          <div className="mb-2 sm:mb-3 lg:mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleSidebar}
                className="rounded-lg border border-surface-700 bg-surface-800 p-1.5 sm:p-2 text-surface-400 transition-all hover:bg-surface-700 hover:text-surface-200 flex-shrink-0"
                title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
                aria-label={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
              >
                <motion.div
                  animate={{ rotate: showSidebar ? 0 : 180 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </motion.div>
              </motion.button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-surface-100 truncate">AI Assistant</h1>
                <p className="text-[10px] sm:text-xs lg:text-sm text-surface-400 truncate">
                  {mode === 'general' ? 'Your personal coding assistant' : 'Ask questions grounded in your codebase'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Mode Toggle */}
              <div className="flex rounded-lg border border-surface-700 bg-surface-800 p-0.5">
                <button onClick={() => setMode('general')}
                  className={`flex items-center gap-1 rounded-md px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap ${
                    mode === 'general' ? 'bg-primary-600 text-white shadow-sm' : 'text-surface-400 hover:text-surface-200'
                  }`}
                >
                  <MessageSquare className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                  <span className="hidden sm:inline">General</span>
                </button>
                <button onClick={() => setMode('repo')}
                  className={`flex items-center gap-1 rounded-md px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap ${
                    mode === 'repo' ? 'bg-primary-600 text-white shadow-sm' : 'text-surface-400 hover:text-surface-200'
                  }`}
                >
                  <BookOpen className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                  <span className="hidden sm:inline">Repo</span>
                </button>
              </div>

              {mode === 'general' && reports.length > 0 && (
                <select
                  value={repoContextId}
                  onChange={(e) => setRepoContextId(e.target.value)}
                  title="Attach repository context to your answers"
                  className="rounded-lg border border-surface-700 bg-surface-800 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-surface-300 focus:border-primary-500/50 focus:outline-none max-w-[110px] sm:max-w-[170px] truncate"
                >
                  <option value="">No repo context</option>
                  {reports.map((r) => <option key={r.id} value={r.id}>{r.repoName}</option>)}
                </select>
              )}

              {mode === 'repo' && reports.length > 0 && (
                <select value={selectedReportId} onChange={(e) => setSelectedReportId(e.target.value)}
                  className="rounded-lg border border-surface-700 bg-surface-800 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-surface-300 focus:border-primary-500/50 focus:outline-none max-w-[120px] sm:max-w-[180px] truncate"
                >
                  {reports.map((r) => <option key={r.id} value={r.id} className="truncate">{r.repoName} ({r.fileCount}f)</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto rounded-xl border border-surface-700 bg-surface-900/50 p-3 sm:p-4 backdrop-blur-sm">
            {statusBanner()}

            {messages.length <= 1 && !loading && (
              <div className="mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => setInput(s)}
                      className="rounded-lg bg-surface-800/30 px-3 py-2 text-left text-xs text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200 truncate"
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3 sm:space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={`${i}-${msg.timestamp.getTime()}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={'flex gap-2 sm:gap-3 ' + (msg.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                        <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                    )}
                    <div
                      className={'max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] px-3 sm:px-4 py-2 sm:py-3 ' +
                        (msg.role === 'user' ? 'rounded-2xl rounded-br-md bg-blue-600 text-white' : 'rounded-2xl rounded-bl-md bg-surface-800 text-surface-200')}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="max-w-none text-xs sm:text-sm">
                          <MarkdownRenderer content={msg.content} />
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-2 rounded-lg border border-surface-700 bg-surface-900/60 p-2">
                              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                                <BookOpen className="h-3 w-3" />
                                Sources
                              </p>
                              <ul className="mt-1.5 space-y-1">
                                {msg.sources.map((src, i) => (
                                  <li key={i} className="font-mono text-[10px] sm:text-[11px] text-emerald-400/90 break-all">
                                    {src.filePath}
                                    <span className="text-surface-500">:{src.startLine}-{src.endLine}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      )}
                      <p className="mt-1 text-right text-[9px] sm:text-[10px] text-surface-500">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {msg.role === 'user' && (
                      <div className="flex h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-700">
                        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-surface-400" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 pl-10">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-surface-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-surface-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-surface-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder={mode === 'general' ? 'Ask a coding question...' : indexStatus.hasReport ? 'Ask about your code...' : 'Index a repository first...'}
              className="input-field"
            />
            <button onClick={handleSend} disabled={loading || !input.trim()}
              className="btn-primary px-4"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
