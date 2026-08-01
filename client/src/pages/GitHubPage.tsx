import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Github, GitBranch, Globe, Lock, Loader2, ExternalLink, Search, RefreshCw, Database, Trash2, LogOut } from 'lucide-react';
import { isAxiosError } from 'axios';
import apiClient from '../api/axios';
import toast from 'react-hot-toast';

interface ImportedRepo {
  _id: string;
  fullName: string;
  name: string;
  language?: string;
  description?: string;
  url?: string;
  defaultBranch?: string;
  indexStatus?: 'not_indexed' | 'pending' | 'processing' | 'completed' | 'failed';
  indexedFiles?: number;
  indexedChunks?: number;
  indexedAt?: string;
}

const OAUTH_ERRORS: Record<string, string> = {
  missing_params: 'Missing authorization parameters from GitHub. Please try again.',
  invalid_or_expired_state: 'Your GitHub authorization session expired or is invalid. Please try connecting again.',
  access_denied: 'You denied the GitHub authorization request.',
};

/**
 * Detects the server error about a GitHub account being already linked
 * to a different DevMind user and returns a user-friendly message.
 */
function formatConnectionError(serverMsg: string): string {
  const alreadyConnectedPattern = /already connected to another user/i;
  if (alreadyConnectedPattern.test(serverMsg)) {
    const loginMatch = serverMsg.match(/GitHub account "([^"]+)"/);
    const login = loginMatch ? loginMatch[1] : 'this GitHub account';
    return `"${login}" is already signed in to another DevMind account. Please disconnect GitHub from that account's settings first, then try connecting again.`;
  }
  return serverMsg;
}

export function GitHubPage() {
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [githubUser, setGithubUser] = useState<string | null>(null);
  const [repos, setRepos] = useState<{ id: string; name: string; fullName: string; description: string; private: boolean; language: string; url: string }[]>([]);
  const [importedRepos, setImportedRepos] = useState<ImportedRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [indexModal, setIndexModal] = useState<{ open: boolean; repoName: string; repoId: string } | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Track whether we've processed URL params to avoid showing errors on re-renders
  const processedParams = useRef(false);

  useEffect(() => {
    // Read OAuth result from URL params (set by handleDirectOAuthCallback redirect)
    if (!processedParams.current) {
      const error = searchParams.get('error');
      const githubStatus = searchParams.get('github_status');
      const errorMsg = searchParams.get('message');

      if (error && OAUTH_ERRORS[error]) {
        toast.error(OAUTH_ERRORS[error]);
      } else if (error) {
        toast.error('GitHub authorization failed. Please try again.');
      }

      if (githubStatus === 'success') {
        toast.success('GitHub account connected successfully!');
      } else if (githubStatus === 'error' && errorMsg) {
        const decoded = decodeURIComponent(errorMsg);
        toast.error(formatConnectionError(decoded));
      }

      processedParams.current = true;
    }

    checkConnection();
    fetchWorkspaces(); 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const res = await apiClient.get('/workspaces');
      const list = res.data.data?.workspaces || [];
      setWorkspaces(list);
      if (list.length > 0) setSelectedWorkspaceId(list[0].id);
    } catch { /* ignore */ }
  };

  const checkConnection = async () => {
    try {
      const res = await apiClient.get('/github/status');
      const data = res.data.data;
      setConnected(!!data?.connected);
      setGithubUser(data?.account?.login || null);
      if (data?.connected) {
        fetchImportedRepos();
      }
    } catch { /* not connected */ }
  };

  const fetchImportedRepos = async () => {
    try {
      const res = await apiClient.get('/github/repos/imported');
      setImportedRepos(res.data.data?.repos || []);
    } catch { /* ignore */ }
  };

  const handleConnect = async () => {
    try {
      const res = await apiClient.get('/github/auth/url');
      const authUrl = res.data?.data?.url;
      if (!authUrl) {
        toast.error('Failed to get authorization URL');
        return;
      }
      const width = 600; const height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;
      const popup = window.open(authUrl, 'github-oauth', `width=${width},height=${height},left=${left},top=${top}`);
      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          checkConnection();
        }
      }, 500);
    } catch {
      toast.error('Failed to connect to GitHub');
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await apiClient.post('/github/disconnect');
      toast.success('GitHub account disconnected');
      setConnected(false);
      setGithubUser(null);
      setRepos([]);
      setImportedRepos([]);
    } catch {
      toast.error('Failed to disconnect GitHub account');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleFetchRepos = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/github/repos');
      setRepos(res.data.data?.repositories || res.data.data?.repos || []);
      toast.success('Repositories fetched!');
    } catch { toast.error('Failed to fetch repositories'); }
    finally { setLoading(false); }
  };

  const handleImport = async (repoName: string) => {
    setImporting(repoName);
    try {
      const parts = repoName.split('/');
      const owner = parts[0]!;
      const repo = parts.slice(1).join('/') || parts[0]!;
      const body: Record<string, string> = { owner, repo };
      if (selectedWorkspaceId) body.workspaceId = selectedWorkspaceId;
      await apiClient.post('/github/repos/import', body);
      toast.success('Repository imported! You can now index it from anywhere.');
      fetchImportedRepos();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to import repository');
    } finally { setImporting(null); }
  };

  const handleRemoveRepo = async () => {
    if (!showRemoveConfirm) return;
    setRemoving(showRemoveConfirm);
    try {
      await apiClient.delete('/github/repos/imported/' + showRemoveConfirm);
      toast.success('Repository removed');
      setShowRemoveConfirm(null);
      fetchImportedRepos();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to remove repository');
    } finally { setRemoving(null); }
  };

  const handleIndex = async () => {
    if (!indexModal) return;
    setIndexing(true);
    try {
      // Use a longer timeout for indexing — downloading + parsing can take several minutes
      await apiClient.post('/indexer/repos/' + indexModal.repoId + '/index', {}, { timeout: 300000 });
      toast.success('Repository indexed successfully!');
      setIndexModal(null);
      fetchImportedRepos();
    } catch (err: unknown) {
      const message = isAxiosError(err)
        ? err.response?.data?.message || err.message || 'Failed to index repository'
        : 'Failed to index repository';
      toast.error(message);
    } finally { setIndexing(false); }
  };

  const filteredRepos = repos.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.fullName.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-surface-100 truncate">GitHub Integration</h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-surface-400 truncate">Connect your GitHub account and import repositories</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {connected && (
            <button onClick={handleDisconnect} disabled={disconnecting}
              className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 sm:px-3 py-2 sm:py-2.5 text-[11px] sm:text-sm font-medium text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-50"
            >
              {disconnecting ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              <span className="hidden sm:inline">Disconnect</span>
            </button>
          )}
          <button onClick={handleConnect} disabled={connected}
            className={'flex items-center gap-1.5 sm:gap-2 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-sm font-medium transition-all whitespace-nowrap ' + (connected ? 'bg-emerald-500/10 text-emerald-400 cursor-default' : 'bg-surface-800 text-surface-200 hover:bg-surface-700')}
          >
            <Github className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="truncate max-w-[120px] sm:max-w-none">{connected ? 'Connected as ' + githubUser : 'Connect GitHub'}</span>
          </button>
        </div>
      </div>

      {!connected ? (
        <div className="flex flex-col items-center py-10 sm:py-16 text-center px-4">
          <div className="mb-4 sm:mb-6 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-xl sm:rounded-2xl bg-surface-800">
            <Github className="h-8 w-8 sm:h-10 sm:w-10 text-surface-400" />
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-surface-200">Connect Your GitHub Account</h2>
          <p className="mt-1 sm:mt-2 max-w-xs sm:max-w-md text-xs sm:text-sm text-surface-400">Connect your GitHub account to import public and private repositories, analyze code, and generate documentation.</p>
          <button onClick={handleConnect} className="mt-4 sm:mt-6 flex items-center gap-2 rounded-lg sm:rounded-xl bg-surface-800 px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-surface-200 transition-all hover:bg-surface-700">
            <Github className="h-4 w-4 sm:h-5 sm:w-5" />
            Sign in with GitHub
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-surface-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search repos..."
                  className="w-full rounded-lg border border-surface-700 bg-surface-900 py-2 sm:py-2.5 pl-8 sm:pl-10 pr-3 sm:pr-4 text-xs sm:text-sm text-surface-100 placeholder-surface-500 focus:border-primary-500/50 focus:outline-none"
                />
              </div>
              {workspaces.length > 0 && (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-[10px] sm:text-xs text-surface-400 whitespace-nowrap">Link to:</span>
                  <select value={selectedWorkspaceId} onChange={e => setSelectedWorkspaceId(e.target.value)}
                    className="rounded-lg border border-surface-600 bg-surface-800 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-surface-300 focus:border-primary-500/50 focus:outline-none max-w-[120px] sm:max-w-none truncate"
                  >
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id} className="truncate">{ws.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <button onClick={handleFetchRepos} disabled={loading}
              className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-surface-700 bg-surface-900 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-surface-300 transition-all hover:text-surface-100 self-end sm:self-auto"
            >
              <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
              Refresh
            </button>
          </div>

          {filteredRepos.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <GitBranch className="mb-3 h-8 w-8 text-surface-600" />
              <p className="text-sm text-surface-400">No repositories found</p>
              <p className="text-xs text-surface-500">Click Refresh to fetch your GitHub repositories</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRepos.map(repo => (
                <motion.div key={repo.id} layout className="rounded-xl border border-surface-700 bg-surface-900/50 p-4 backdrop-blur-sm transition-all hover:border-primary-500/30">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-surface-400" />
                      <span className="text-sm font-medium text-surface-200 truncate max-w-[180px]">{repo.name}</span>
                    </div>
                    {repo.private ? <Lock className="h-3.5 w-3.5 text-amber-500" /> : <Globe className="h-3.5 w-3.5 text-emerald-500" />}
                  </div>
                  {repo.description && <p className="mt-2 text-xs text-surface-400 line-clamp-2">{repo.description}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    {repo.language && (
                      <span className="rounded-full bg-surface-800 px-2 py-0.5 text-[10px] text-surface-300">{repo.language}</span>
                    )}
                    <button onClick={() => handleImport(repo.fullName || repo.name)} disabled={importing === repo.name}
                      className="flex items-center gap-1 rounded-lg bg-primary-600/20 px-3 py-1.5 text-xs font-medium text-primary-400 transition-all hover:bg-primary-600/30 disabled:opacity-50"
                    >
                      {importing === repo.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                      {importing === repo.name ? 'Importing...' : 'Import'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Imported Repos Section */}
          {importedRepos.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-surface-200">
                <Database className="h-4 w-4 text-surface-400" />
                Imported Repositories ({importedRepos.length})
              </h2>
              <div className="space-y-2">
                {importedRepos.map((ir) => {
                  const status = ir.indexStatus || 'not_indexed';
                  const isIndexed = status === 'completed';
                  return (
                    <div key={ir._id} className="flex flex-col gap-2 rounded-lg border border-surface-700 bg-surface-900/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                        <GitBranch className="h-4 w-4 flex-shrink-0 text-surface-400" />
                        <span className="truncate text-sm font-medium text-surface-200">{ir.fullName}</span>
                        <span className={
                          'flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                          (status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                           status === 'processing' || status === 'pending' ? 'bg-blue-500/10 text-blue-400' :
                           status === 'failed' ? 'bg-red-500/10 text-red-400' :
                           'bg-surface-800 text-surface-400')
                        }>
                          {status === 'completed' ? '✓ ' + (ir.indexedFiles || 0) + ' files' :
                           status === 'processing' ? 'Processing...' :
                           status === 'pending' ? 'Queued' :
                           status === 'failed' ? 'Failed' :
                           'Not indexed'}
                        </span>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2 sm:ml-3">
                        {!isIndexed ? (
                          <button
                            onClick={() => setIndexModal({ open: true, repoName: ir.fullName, repoId: ir._id })}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-all hover:bg-emerald-600/30"
                          >
                            <Database className="h-3 w-3" />
                            Index
                          </button>
                        ) : (
                          <span className="text-xs text-surface-400">
                            {ir.indexedAt ? new Date(ir.indexedAt).toLocaleDateString() : ''}
                          </span>
                        )}
                        <button
                          onClick={() => setShowRemoveConfirm(ir._id)}
                          className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/20"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowRemoveConfirm(null)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
            className="w-full max-w-sm rounded-xl border border-surface-700 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-red-400">Remove Repository?</h3>
            <p className="mt-2 text-sm text-surface-300">
              This will permanently remove the repository and <strong>all its indexed data</strong> (files, chunks, reports).
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowRemoveConfirm(null)}
                className="rounded-lg border border-surface-600 px-4 py-2 text-sm text-surface-300 hover:bg-surface-800"
              >
                Cancel
              </button>
              <button onClick={handleRemoveRepo} disabled={removing === showRemoveConfirm}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {removing ? 'Removing...' : 'Remove Permanently'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Index Modal */}
      {indexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { setIndexModal(null); }}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="w-full max-w-md rounded-xl border border-surface-700 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-surface-200">Index Repository</h2>
            </div>
            <p className="mt-3 text-sm text-surface-300">
              The repository <span className="font-medium text-surface-100">{indexModal.repoName}</span> will be downloaded from GitHub and indexed. This may take a few moments depending on the repository size.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => { setIndexModal(null); }}
                className="rounded-lg border border-surface-600 px-4 py-2 text-sm text-surface-300 transition-all hover:bg-surface-800"
              >
                Cancel
              </button>
              <button
                onClick={handleIndex}
                disabled={indexing}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
              >
                {indexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {indexing ? 'Downloading & Indexing...' : 'Start Indexing'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
