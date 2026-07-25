import { useState, useCallback } from 'react';
import { Check, Copy, ChevronDown, ChevronRight } from 'lucide-react';

interface CodeBlockProps {
  className?: string;
  children?: React.ReactNode;
  inline?: boolean;
}

function getCodeText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(getCodeText).join('');
  if (typeof node === 'object' && node !== null && 'props' in node) {
    const el = node as { props: { children?: React.ReactNode } };
    return getCodeText(el.props.children);
  }
  return '';
}

function getLanguageColor(lang: string): string {
  const colors: Record<string, string> = {
    javascript: 'from-yellow-400 to-yellow-600',
    js: 'from-yellow-400 to-yellow-600',
    typescript: 'from-blue-400 to-blue-600',
    ts: 'from-blue-400 to-blue-600',
    tsx: 'from-blue-400 to-cyan-500',
    jsx: 'from-yellow-400 to-cyan-500',
    python: 'from-green-400 to-green-600',
    py: 'from-green-400 to-green-600',
    html: 'from-orange-400 to-red-500',
    css: 'from-pink-400 to-purple-500',
    json: 'from-green-400 to-emerald-600',
    bash: 'from-gray-400 to-slate-600',
    sh: 'from-gray-400 to-slate-600',
    sql: 'from-orange-400 to-amber-600',
    rust: 'from-orange-600 to-red-700',
    go: 'from-cyan-400 to-blue-500',
    java: 'from-red-400 to-orange-500',
    markdown: 'from-gray-400 to-gray-600',
    plaintext: 'from-gray-400 to-gray-500',
  };
  return colors[lang] || 'from-blue-400 to-indigo-500';
}

export function CodeBlock({ className, children, inline }: CodeBlockProps) {
  const language = className?.replace('language-', '').replace('hljs ', '') || 'plaintext';
  const code = getCodeText(children);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const lines = code.split('\n');
  const lineCount = lines.length;
  const isLongCode = lineCount > 30;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  if (inline) {
    return (
      <code className="inline-code text-surface-100">
        {children}
      </code>
    );
  }

  const langColor = getLanguageColor(language);

  return (
    <div className="code-block-wrapper group my-4 overflow-hidden rounded-xl border border-surface-600/50 bg-surface-900 shadow-lg">
      <div className="flex items-center justify-between border-b border-surface-700/50 bg-surface-800/80 px-4 py-2">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r ${langColor} px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm`}>
            {language === 'plaintext' ? 'Text' : language}
          </span>
          <span className="text-[10px] text-surface-500">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isLongCode && (
            <button onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-surface-400 transition-colors hover:bg-surface-700/50 hover:text-surface-200">
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          )}
          <button onClick={handleCopy}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-surface-400 transition-colors hover:bg-surface-700/50 hover:text-surface-200">
            {copied ? (
              <><Check className="h-3.5 w-3.5 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
            ) : (
              <><Copy className="h-3.5 w-3.5" />Copy</>
            )}
          </button>
        </div>
      </div>

      <div className={`overflow-x-auto transition-all duration-200 ${isLongCode && !expanded ? 'max-h-40 overflow-y-hidden' : ''}`}>
        <div className="flex">
          <div className="select-none border-r border-surface-700/50 bg-surface-900/50 py-4 text-right text-[12px] leading-6 text-surface-600">
            {lines.map((_, i) => (
              <div key={i} className="w-10 px-3 font-mono">{i + 1}</div>
            ))}
          </div>
          <pre className="flex-1 !m-0 !border-0 !bg-transparent !p-0">
            <code className={`hljs language-${language} !bg-transparent !p-4 !text-sm !leading-6 !font-mono`}>
              {children}
            </code>
          </pre>
        </div>
      </div>

      {isLongCode && !expanded && (
        <div className="relative flex justify-center pb-3 -mt-8">
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface-900 to-transparent pointer-events-none" />
          <button onClick={() => setExpanded(true)}
            className="relative z-10 flex items-center gap-1 rounded-lg border border-surface-600 bg-surface-800 px-4 py-1.5 text-[11px] text-surface-400 transition-colors hover:border-surface-500 hover:text-surface-200">
            <ChevronDown className="h-3.5 w-3.5" />
            Show all {lineCount} lines
          </button>
        </div>
      )}

      <div className="h-0.5 bg-gradient-to-r from-blue-500/50 via-purple-500/50 to-pink-500/50" />
    </div>
  );
}
