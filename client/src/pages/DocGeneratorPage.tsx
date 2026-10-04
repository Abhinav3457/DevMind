import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Download, Loader2, Sparkles, BookOpen, ListTree, Layout, Globe,
  Shield, Truck, Users, FileJson, ChevronDown, Clock, Trash2,
} from 'lucide-react';
import apiClient from '../api/axios';
import toast from 'react-hot-toast';
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer';
import { PageHeader } from '../components/layout/PageHeader';

const docTypes = [
  { value: 'readme', label: 'README.md', description: 'Project overview with features, tech stack, and quick start', icon: BookOpen },
  { value: 'installation', label: 'Installation', description: 'Step-by-step setup and configuration guide', icon: Download },
  { value: 'architecture', label: 'Architecture', description: 'System design, data flow, and design patterns', icon: Layout },
  { value: 'api-docs', label: 'API Docs', description: 'Complete API endpoint documentation with examples', icon: Globe },
  { value: 'deployment', label: 'Deployment', description: 'Deployment guide for various platforms', icon: Truck },
  { value: 'folder-structure', label: 'Structure', description: 'Directory tree with folder descriptions', icon: ListTree },
  { value: 'env-vars', label: 'Environment', description: 'All environment variables with descriptions', icon: FileJson },
  { value: 'contributing', label: 'Contributing', description: 'Contribution guidelines and standards', icon: Users },
  { value: 'license', label: 'License', description: 'Open source license file', icon: Shield },
];

interface HistoryItem {
  id: string;
  type: string;
  fileName: string;
  context: string;
  createdAt: string;
}

function docTypeLabel(value: string): string {
  return docTypes.find(dt => dt.value === value)?.label || value;
}

export function DocGeneratorPage() {
  const [mode, setMode] = useState<'generate' | 'history'>('generate');
  const [context, setContext] = useState('');
  const [docType, setDocType] = useState('readme');
  const [documentation, setDocumentation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (mode === 'history') fetchHistory();
  }, [mode]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiClient.get('/ai/doc-generator/history');
      setHistory(res.data.data?.documents || []);
    } catch { /* ignore */ }
    setLoadingHistory(false);
  };

  const loadHistoryDetail = async (id: string) => {
    setActiveId(id);
    setLoading(true);
    try {
      const res = await apiClient.get('/ai/doc-generator/history/' + id);
      const data = res.data.data;
      if (data) {
        setDocumentation(typeof data.content === 'string' ? data.content : '');
        if (typeof data.type === 'string') setDocType(data.type);
      }
    } catch {
      // Error toast is already shown by the axios interceptor
    } finally {
      setLoading(false);
    }
  };

  const deleteHistory = async (id: string) => {
    try {
      await apiClient.delete('/ai/doc-generator/history/' + id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      if (activeId === id) setActiveId(null);
      toast.success('Document deleted');
    } catch {
      // Error toast is already shown by the axios interceptor
    }
  };

  const handleGenerate = async () => {
    if (!context.trim()) { toast.error('Please provide project context to continue'); return; }
    setLoading(true);
    setDocumentation(null);
    setActiveId(null);
    try {
      const res = await apiClient.post('/ai/doc-generator/generate', {
        context: context.trim(),
        type: docType,
      });
      const doc = res.data.data?.documentation || res.data.data?.content || res.data.message;
      setDocumentation(typeof doc === 'string' ? doc : JSON.stringify(doc, null, 2));
      toast.success('Documentation generated!');
      if (mode === 'history') fetchHistory();
    } catch {
      toast.error('Failed to generate documentation');
    } finally { setLoading(false); }
  };

  const handleDownload = () => {
    if (!documentation) return;
    const blob = new Blob([documentation], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docType + '.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full min-h-0 flex-col gap-4 overflow-x-hidden overflow-y-auto pb-1 sm:gap-6">
      <PageHeader
        icon={FileText}
        title="Documentation Generator"
        description="Generate professional project documentation with AI"
        gradient="from-emerald-500 to-teal-600"
        actions={
          <div className="flex rounded-lg border border-surface-700 bg-surface-800 p-0.5 self-start sm:self-auto">
            <button onClick={() => setMode('generate')}
              className={`flex items-center gap-1 rounded-md px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium transition-all ${
                mode === 'generate' ? 'bg-primary-600 text-white shadow-sm' : 'text-surface-400 hover:text-surface-200'
              }`}
            ><Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Generate</button>
            <button onClick={() => setMode('history')}
              className={`flex items-center gap-1 rounded-md px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium transition-all ${
                mode === 'history' ? 'bg-primary-600 text-white shadow-sm' : 'text-surface-400 hover:text-surface-200'
              }`}
            ><Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> History</button>
          </div>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Form + preview */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-6 lg:flex-row">
          <div className="w-full space-y-4 lg:w-1/2">
            {mode === 'history' ? (
              loadingHistory ? (
                <div className="flex items-center gap-2 text-sm text-surface-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading history...
                </div>
              ) : history.length === 0 ? (
                <div className="rounded-xl border border-surface-700 bg-surface-900/50 p-8 text-center">
                  <Clock className="mx-auto mb-3 h-8 w-8 text-surface-600" />
                  <p className="text-sm font-medium text-surface-300">No documents yet</p>
                  <p className="mt-1 text-xs text-surface-500">
                    Generated documentation will be saved here so you can revisit it later.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className={
                        'group flex items-center gap-2 rounded-lg border px-3 py-3 transition-all ' +
                        (activeId === item.id
                          ? 'border-primary-500/50 bg-primary-500/5'
                          : 'border-surface-700 bg-surface-900/30 hover:border-surface-600')
                      }
                    >
                      <button onClick={() => loadHistoryDetail(item.id)} className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium text-surface-200">
                            {item.fileName || docTypeLabel(item.type)}
                          </span>
                          <span className="flex-shrink-0 rounded-full bg-surface-800 px-2 py-0.5 text-[10px] font-medium text-surface-400">
                            {docTypeLabel(item.type)}
                          </span>
                        </div>
                        {item.context && (
                          <p className="mt-1 truncate text-[11px] text-surface-400">{item.context}</p>
                        )}
                        <p className="mt-1 text-[10px] text-surface-500">
                          {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                        </p>
                      </button>
                      <button
                        onClick={() => deleteHistory(item.id)}
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-surface-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title="Delete document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <>
                <div>
                  <label htmlFor="doc-type-select" className="mb-1.5 block text-xs sm:text-sm font-medium text-surface-200">
                    Document type
                  </label>
                  <div className="relative">
                    <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
                    <select
                      id="doc-type-select"
                      value={docType}
                      onChange={e => setDocType(e.target.value)}
                      className="w-full cursor-pointer appearance-none rounded-xl border border-surface-700 bg-surface-900/50 py-2.5 pl-9 pr-9 text-xs text-surface-200 transition-all focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:text-sm"
                    >
                      {docTypes.map(dt => (
                        <option key={dt.value} value={dt.value}>{dt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                  </div>
                </div>
                <div>
                  <label htmlFor="project-context" className="mb-1.5 block text-xs sm:text-sm font-medium text-surface-200">
                    Project context
                  </label>
                  <textarea
                    id="project-context"
                    value={context} onChange={e => setContext(e.target.value)}
                    placeholder={'Describe your project:\n- Tech stack: React, Node.js, TypeScript\n- Key features: Authentication, API, Database\n- Structure: Monorepo with client/server'}
                    className="h-[250px] sm:h-[350px] lg:h-[400px] w-full resize-none rounded-xl border border-surface-700 bg-surface-900/50 p-3 sm:p-4 text-xs sm:text-sm text-surface-200 placeholder-surface-600 focus:border-primary-500/50 focus:outline-none"
                  />
                </div>
                <button onClick={handleGenerate} disabled={loading || !context.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-white shadow-lg shadow-black/25 transition-all hover:from-blue-500 hover:to-purple-500 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  {loading ? 'Generating...' : 'Generate Documentation'}
                </button>
              </>
            )}
          </div>

          <div className="w-full lg:w-1/2">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-xs sm:text-sm font-medium text-surface-200">Preview</label>
              {documentation && (
                <button onClick={handleDownload}
                  className="flex items-center gap-1.5 rounded-lg border border-surface-600 bg-surface-800/50 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-surface-300 transition-all hover:text-surface-100"
                ><Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Download</button>
              )}
            </div>
            <div className="h-[250px] sm:h-[350px] lg:h-[400px] overflow-y-auto rounded-xl border border-surface-700 bg-surface-900 p-3 sm:p-4">
              {documentation ? (
                <div className="max-w-none">
                  <MarkdownRenderer content={documentation} />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <FileText className="mb-3 h-10 w-10 text-surface-600" />
                  <p className="text-sm text-surface-400">Generated documentation will appear here</p>
                  <p className="mt-1 text-xs text-surface-500">
                    {mode === 'history'
                      ? 'Select a saved document to preview it'
                      : 'Select a document type and provide your project context'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
