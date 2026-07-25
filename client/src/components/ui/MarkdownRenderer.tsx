import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';
import { ExternalLink, AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function getPlainText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(getPlainText).join('');
  if (typeof node === 'object' && 'props' in node) {
    const el = node as { props: { children?: React.ReactNode } };
    return getPlainText(el.props.children);
  }
  return '';
}

function CustomHeading({ level, children, node: _node }: { level: number; children?: React.ReactNode; node?: unknown; [key: string]: unknown }) {
  const text = typeof children === 'string' ? children : getPlainText(children);
  const headingId = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '') || `heading-${level}`;
  const sizes: Record<number, string> = {
    1: 'text-xl font-bold text-surface-100 mt-6 mb-3 pb-2 border-b border-surface-700/50',
    2: 'text-lg font-bold text-surface-100 mt-5 mb-2.5',
    3: 'text-base font-semibold text-surface-100 mt-4 mb-2',
    4: 'text-sm font-semibold text-surface-200 mt-3 mb-1.5',
    5: 'text-xs font-semibold text-surface-200 mt-2 mb-1',
    6: 'text-xs font-semibold text-surface-300 mt-2 mb-1',
  };
  const size = sizes[level] || 'text-lg font-bold text-surface-100 mt-5 mb-2.5';
  
  switch (level) {
    case 1: return React.createElement('h1', { id: headingId, className: size }, React.createElement('a', { href: `#${headingId}`, className: 'anchor-link mr-2 text-surface-500 opacity-0 hover:opacity-100 transition-opacity', 'aria-label': `Link to ${text}` }, '#'), children);
    case 2: return React.createElement('h2', { id: headingId, className: size }, React.createElement('a', { href: `#${headingId}`, className: 'anchor-link mr-2 text-surface-500 opacity-0 hover:opacity-100 transition-opacity', 'aria-label': `Link to ${text}` }, '#'), children);
    case 3: return React.createElement('h3', { id: headingId, className: size }, React.createElement('a', { href: `#${headingId}`, className: 'anchor-link mr-2 text-surface-500 opacity-0 hover:opacity-100 transition-opacity', 'aria-label': `Link to ${text}` }, '#'), children);
    case 4: return React.createElement('h4', { id: headingId, className: size }, React.createElement('a', { href: `#${headingId}`, className: 'anchor-link mr-2 text-surface-500 opacity-0 hover:opacity-100 transition-opacity', 'aria-label': `Link to ${text}` }, '#'), children);
    case 5: return React.createElement('h5', { id: headingId, className: size }, React.createElement('a', { href: `#${headingId}`, className: 'anchor-link mr-2 text-surface-500 opacity-0 hover:opacity-100 transition-opacity', 'aria-label': `Link to ${text}` }, '#'), children);
    case 6: return React.createElement('h6', { id: headingId, className: size }, React.createElement('a', { href: `#${headingId}`, className: 'anchor-link mr-2 text-surface-500 opacity-0 hover:opacity-100 transition-opacity', 'aria-label': `Link to ${text}` }, '#'), children);
    default: return React.createElement('h2', { id: headingId, className: size }, React.createElement('a', { href: `#${headingId}`, className: 'anchor-link mr-2 text-surface-500 opacity-0 hover:opacity-100 transition-opacity', 'aria-label': `Link to ${text}` }, '#'), children);
  }
}

const components: Record<string, React.ComponentType<any>> = {
  code: ({ className, children }) => {
    const isInline = !(className || '').includes('language-');
    return React.createElement(CodeBlock, { className, inline: isInline }, children);
  },
  pre: ({ children }) => React.createElement(React.Fragment, null, children),
  h1: (props: any) => React.createElement(CustomHeading, { level: 1, ...props }),
  h2: (props: any) => React.createElement(CustomHeading, { level: 2, ...props }),
  h3: (props: any) => React.createElement(CustomHeading, { level: 3, ...props }),
  h4: (props: any) => React.createElement(CustomHeading, { level: 4, ...props }),
  h5: (props: any) => React.createElement(CustomHeading, { level: 5, ...props }),
  h6: (props: any) => React.createElement(CustomHeading, { level: 6, ...props }),
  a: ({ href, children }) => {
    const isExternal = href?.startsWith('http');
    return React.createElement('a', {
      href,
      target: isExternal ? '_blank' : undefined,
      rel: isExternal ? 'noopener noreferrer' : undefined,
      className: 'inline-flex items-center gap-1 text-primary-400 hover:text-primary-300 underline underline-offset-2 decoration-primary-500/30 hover:decoration-primary-400/50 transition-all'
    }, children, isExternal ? React.createElement(ExternalLink, { className: 'h-3 w-3 inline-block' }) : null);
  },
  table: ({ children }) => React.createElement('div', { className: 'my-4 overflow-x-auto rounded-xl border border-surface-700/50' },
    React.createElement('table', { className: 'min-w-full divide-y divide-surface-700 text-sm' }, children)),
  blockquote: ({ children }) => {
    const text = getPlainText(children).toLowerCase();
    if (text.includes('warning') || text.includes('caution')) {
      return React.createElement('div', { className: 'my-4 rounded-xl border border-amber-700/50 bg-amber-900/20 p-4' },
        React.createElement('div', { className: 'flex items-start gap-3' },
          React.createElement(AlertTriangle, { className: 'mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400' }),
          React.createElement('div', { className: 'text-sm text-amber-200 [&>p]:m-0 [&>p]:text-amber-200' }, children)));
    }
    if (text.includes('danger') || text.includes('error')) {
      return React.createElement('div', { className: 'my-4 rounded-xl border border-red-700/50 bg-red-900/20 p-4' },
        React.createElement('div', { className: 'flex items-start gap-3' },
          React.createElement(AlertCircle, { className: 'mt-0.5 h-5 w-5 flex-shrink-0 text-red-400' }),
          React.createElement('div', { className: 'text-sm text-red-200 [&>p]:m-0 [&>p]:text-red-200' }, children)));
    }
    if (text.includes('tip') || text.includes('note') || text.includes('info')) {
      return React.createElement('div', { className: 'my-4 rounded-xl border border-blue-700/50 bg-blue-900/20 p-4' },
        React.createElement('div', { className: 'flex items-start gap-3' },
          React.createElement(Info, { className: 'mt-0.5 h-5 w-5 flex-shrink-0 text-blue-400' }),
          React.createElement('div', { className: 'text-sm text-blue-200 [&>p]:m-0 [&>p]:text-blue-200' }, children)));
    }
    return React.createElement('blockquote', { className: 'my-4 border-l-4 border-surface-600 bg-surface-800/50 py-3 px-4 rounded-r-xl text-sm text-surface-300 italic' }, children);
  },
  p: ({ children }) => React.createElement('p', { className: 'my-3 text-sm leading-relaxed text-surface-200' }, children),
  ul: ({ children }) => React.createElement('ul', { className: 'my-3 ml-5 list-disc space-y-1.5 text-sm text-surface-200' }, children),
  ol: ({ children }) => React.createElement('ol', { className: 'my-3 ml-5 list-decimal space-y-1.5 text-sm text-surface-200' }, children),
  li: ({ children }) => React.createElement('li', { className: 'text-surface-200 leading-relaxed' }, children),
  hr: () => React.createElement('hr', { className: 'my-6 border-surface-700/50' }),
  strong: ({ children }) => React.createElement('strong', { className: 'font-semibold text-surface-100' }, children),
  em: ({ children }) => React.createElement('em', { className: 'italic text-surface-200' }, children),
};

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return React.createElement('div', { className: `markdown-content ${className}` },
    React.createElement(ReactMarkdown as any, {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeHighlight],
      components,
    }, content)
  );
}