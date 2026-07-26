import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Plus, ExternalLink, Loader2, Search, GitBranch } from 'lucide-react';
import apiClient from '../api/axios';
import toast from 'react-hot-toast';

interface Workspace {
  id: string;
  name: string;
  description: string;
  slug: string;
  userRole: string;
  memberCount: number;
  repoCount?: number;
}

export function WorkspacePage() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchWorkspaces(); }, []);

  const fetchWorkspaces = async () => {
    try {
      const res = await apiClient.get('/workspaces');
      setWorkspaces(res.data.data?.workspaces || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!newName || !newSlug) { toast.error('Name and slug are required'); return; }
    setCreating(true);
    try {
      await apiClient.post('/workspaces', { name: newName, slug: newSlug });
      toast.success('Workspace created!');
      setShowCreate(false);
      setNewName('');
      setNewSlug('');
      fetchWorkspaces();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to create workspace');
    } finally { setCreating(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-surface-100 truncate">Workspaces</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-surface-400 truncate">Manage your development workspaces</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-primary-600 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-white transition-all hover:bg-primary-700 whitespace-nowrap flex-shrink-0">
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>New</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-2.5 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-surface-400" />
        <input
          type="text" placeholder="Search workspaces..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-surface-700 bg-surface-900 py-2 sm:py-2.5 pl-8 sm:pl-10 pr-3 sm:pr-4 text-xs sm:text-sm text-surface-100 placeholder-surface-500 focus:border-primary-500/50 focus:outline-none"
        />
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCreate(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="w-full max-w-md rounded-xl border border-surface-700 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-surface-200">Create Workspace</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-surface-300">Name</label>
                <input type="text" value={newName} onChange={e => { setNewName(e.target.value); setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); }} className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:border-primary-500 focus:outline-none" placeholder="My Workspace" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-surface-300">Slug</label>
                <input type="text" value={newSlug} onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:border-primary-500 focus:outline-none" placeholder="my-workspace" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="rounded-lg border border-surface-600 px-4 py-2 text-sm text-surface-300 hover:bg-surface-800">Cancel</button>
                <button onClick={handleCreate} disabled={creating} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50">
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Workspace List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={'skel-' + i} className="h-20 animate-pulse rounded-xl bg-surface-800" />)}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Users className="mb-3 h-12 w-12 text-surface-600" />
          <p className="text-lg font-medium text-surface-300">No workspaces yet</p>
          <p className="mt-1 text-sm text-surface-500">Create your first workspace to get started</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.filter(w => !search || w.name.toLowerCase().includes(search.toLowerCase())).map((ws, i) => (
            <motion.div
              key={ws.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group cursor-pointer rounded-xl border border-surface-700 bg-surface-900/50 p-3 sm:p-5 backdrop-blur-sm transition-all hover:border-primary-500/30 hover:bg-surface-800/50"
              onClick={() => navigate('/workspace/' + ws.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary-500/10">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary-400" />
                </div>
                <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-surface-500 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <h3 className="mt-2 sm:mt-3 text-sm sm:text-base font-medium text-surface-200 truncate">{ws.name}</h3>
              {ws.description && <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-surface-400 line-clamp-2">{ws.description}</p>}
              <div className="mt-2 sm:mt-3 flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-surface-400 flex-wrap">
                <span className="flex items-center gap-1"><Users className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {ws.memberCount}</span>
                <span className="flex items-center gap-1"><GitBranch className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {ws.repoCount || 0}</span>
                <span className={
                  'rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-xs font-medium ' +
                  (ws.userRole === 'owner' ? 'bg-amber-500/10 text-amber-400' :
                   ws.userRole === 'admin' ? 'bg-blue-500/10 text-blue-400' :
                   'bg-surface-800 text-surface-300')
                }>{ws.userRole}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
