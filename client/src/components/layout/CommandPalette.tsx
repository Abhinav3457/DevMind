import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Github, Brain, Bug, FileText, BarChart3,
  Moon, Sun, Plus, Search, CornerDownLeft, FolderGit2,
} from 'lucide-react';
import apiClient from '../../api/axios';
import { useUIStore } from '../../store';

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

const navTargets = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/github', label: 'GitHub', icon: Github },
  { to: '/ai/chat', label: 'AI Chat', icon: Brain },
  { to: '/ai/code-review', label: 'Code Review', icon: Bug },
  { to: '/ai/docs', label: 'Documentation', icon: FileText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

interface ImportedRepo {
  _id: string;
  fullName: string;
  indexStatus?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [repos, setRepos] = useState<ImportedRepo[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { theme, setTheme } = useUIStore();

  // Global hotkey (Ctrl/Cmd+K) + header button event
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('devmind:open-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('devmind:open-palette', onOpen);
    };
  }, []);

  // Focus input + reset on open, lazy-load imported repos
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 40);
    apiClient.get('/github/repos/imported')
      .then((res) => setRepos(res.data.data?.repos || []))
      .catch(() => { /* ignore */ });
  }, [open]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const run = (item: PaletteItem) => {
    setOpen(false);
    item.action();
  };

  const items: PaletteItem[] = [
    ...navTargets.map((n) => ({
      id: 'nav-' + n.to,
      label: n.label,
      hint: n.to,
      icon: n.icon,
      action: () => navigate(n.to),
    })),
    {
      id: 'action-theme',
      label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      hint: 'T',
      icon: theme === 'dark' ? Sun : Moon,
      action: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    },
    { id: 'action-newchat', label: 'New AI chat', hint: 'Ctrl K', icon: Plus, action: () => navigate('/ai/chat') },
    ...repos.map((r) => ({
      id: 'repo-' + r._id,
      label: r.fullName,
      hint: r.indexStatus || 'imported',
      icon: FolderGit2,
      action: () => navigate('/github'),
    })),
  ];

  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) => i.label.toLowerCase().includes(q) || (i.hint || '').toLowerCase().includes(q))
    : items;

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (filtered.length > 0) setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (filtered.length > 0) setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const item = filtered[active]; if (item) run(item); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-surface-950/60 backdrop-blur-sm p-4 pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-surface-700 px-4 py-3">
              <Search className="h-4 w-4 flex-shrink-0 text-surface-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={onInputKeyDown}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent text-sm text-surface-100 placeholder-surface-500 focus:outline-none"
              />
              <kbd className="flex-shrink-0 rounded border border-surface-700 bg-surface-800 px-1.5 py-0.5 text-[10px] text-surface-500">esc</kbd>
            </div>

            <div className="max-h-72 overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-surface-500">No results for &ldquo;{query}&rdquo;</p>
              ) : (
                filtered.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => run(item)}
                    onMouseEnter={() => setActive(i)}
                    className={
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ' +
                      (i === active ? 'bg-primary-500/10 text-surface-100' : 'text-surface-300 hover:bg-surface-800/60')
                    }
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0 text-surface-500" />
                    <span className="flex-1 truncate text-sm">{item.label}</span>
                    {item.hint && <span className="max-w-[120px] truncate text-[10px] text-surface-500">{item.hint}</span>}
                    {i === active && <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0 text-primary-400" />}
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-surface-700 px-4 py-2 text-[10px] text-surface-500">
              <span className="flex items-center gap-1"><kbd className="rounded border border-surface-700 bg-surface-800 px-1 py-0.5">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="rounded border border-surface-700 bg-surface-800 px-1 py-0.5">↵</kbd> select</span>
              <span className="ml-auto">Ctrl K to toggle</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
