import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Loader2, Sparkles, BookOpen, ListTree, Layout, Globe, Shield, Truck, Users, FileJson } from 'lucide-react';
import apiClient from '../api/axios';
import toast from 'react-hot-toast';
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer';

const docTypes = [
  { value: 'readme', label: 'README.md', icon: BookOpen },
  { value: 'installation', label: 'Installation', icon: Download },
  { value: 'architecture', label: 'Architecture', icon: Layout },
  { value: 'api-docs', label: 'API Docs', icon: Globe },
  { value: 'deployment', label: 'Deployment', icon: Truck },
  { value: 'folder-structure', label: 'Structure', icon: ListTree },
  { value: 'env-vars', label: 'Environment', icon: FileJson },
  { value: 'contributing', label: 'Contributing', icon: Users },
  { value: 'license', label: 'License', icon: Shield },
];

export function DocGeneratorPage() {
  const [context, setContext] = useState('');
  const [docType, setDocType] = useState('readme');
  const [documentation, setDocumentation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!context.trim()) { toast.error('Please provide project context'); return; }
    setLoading(true);
    setDocumentation(null);
    try {
      const res = await apiClient.post('/ai/doc-generator/generate', {
        context: context.trim(),
        type: docType,
      });
      const doc = res.data.data?.documentation || res.data.data?.content || res.data.message;
      setDocumentation(typeof doc === 'string' ? doc : JSON.stringify(doc, null, 2));
      toast.success('Documentation generated!');
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-100">Documentation Generator</h1>
        <p className="mt-1 text-sm text-surface-400">Generate professional project documentation using AI</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-200">Document Type</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {docTypes.map(dt => (
                <button key={dt.value} onClick={() => setDocType(dt.value)}
                  className={'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ' + (docType === dt.value ? 'border-primary-500/50 bg-primary-500/10 text-primary-400' : 'border-surface-600 bg-surface-800/50 text-surface-400 hover:border-surface-500 hover:text-surface-200')}
                ><dt.icon className="h-3.5 w-3.5" />{dt.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-200">Project Context</label>
            <textarea
              value={context} onChange={e => setContext(e.target.value)}
              placeholder={'Describe your project:\n- Tech stack: React, Node.js, TypeScript\n- Key features: Authentication, API, Database\n- Structure: Monorepo with client/server'}
              className="h-[300px] w-full resize-none rounded-xl border border-surface-700 bg-surface-900/50 p-4 text-sm text-surface-200 placeholder-surface-600 focus:border-primary-500/50 focus:outline-none"
            />
          </div>
          <button onClick={handleGenerate} disabled={loading || !context.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-purple-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Generating...' : 'Generate Documentation'}
          </button>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-medium text-surface-200">Preview</label>
            {documentation && (
              <button onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg border border-surface-600 bg-surface-800/50 px-3 py-1.5 text-xs text-surface-300 transition-all hover:text-surface-100"
              ><Download className="h-3.5 w-3.5" /> Download</button>
            )}
          </div>
          <div className="h-[400px] overflow-y-auto rounded-xl border border-surface-700 bg-surface-900/50 p-4 backdrop-blur-sm">
            {documentation ? (
              <div className="max-w-none">
                <MarkdownRenderer content={documentation} />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <FileText className="mb-3 h-10 w-10 text-surface-600" />
                <p className="text-sm text-surface-400">Generated documentation will appear here</p>
                <p className="mt-1 text-xs text-surface-500">Select a document type and describe your project</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
