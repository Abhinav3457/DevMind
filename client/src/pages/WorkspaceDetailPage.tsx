import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, Settings, Info, Mail, UserMinus, UserPlus,
  Loader2, ArrowLeft, Save, Edit3, Trash2, Archive,
  ShieldAlert, Clock, Activity, GitBranch, ExternalLink,
} from 'lucide-react';
import apiClient from '../api/axios';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'repos' | 'members' | 'settings';
type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';

interface WorkspaceData {
  id: string;
  _id: string;
  name: string;
  slug: string;
  description: string;
  plan: string;
  isActive: boolean;
  userRole: WorkspaceRole;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
  role: WorkspaceRole;
  joinedAt: string;
}

interface RepoSummary {
  id: string;
  name: string;
  fullName: string;
  language: string;
  description: string;
  url: string;
  isPrivate: boolean;
  stars: number;
  forks: number;
  indexStatus: string;
  indexedFiles: number;
  indexedAt: string | null;
}

interface Activity {
  type: string;
  description: string;
  timestamp: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: WorkspaceRole;
  inviterName?: string;
  createdAt: string;
}

const ROLE_BADGES: Record<WorkspaceRole, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-amber-500/10 text-amber-400' },
  admin: { label: 'Admin', color: 'bg-blue-500/10 text-blue-400' },
  member: { label: 'Member', color: 'bg-surface-800 text-surface-300' },
  guest: { label: 'Guest', color: 'bg-surface-800 text-surface-400' },
};

const ROLES_FOR_SELECT = ['admin', 'member', 'guest'] as const;

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [inviting, setInviting] = useState(false);
  const [invitations, setInvitations] = useState<PendingInvite[]>([]);
  const [revokingInvite, setRevokingInvite] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [removeRepo, setRemoveRepo] = useState<{ id: string; name: string } | null>(null);
  const [removingRepo, setRemovingRepo] = useState(false);

  const fetchWorkspace = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiClient.get('/workspaces/' + id);
      const ws = res.data.data?.workspace;
      setWorkspace(ws || null);
      setEditName(ws?.name || '');
      setEditDesc(ws?.description || '');
    } catch {
      toast.error('Failed to load workspace');
      navigate('/workspace');
    }
  }, [id, navigate]);

  const fetchMembers = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiClient.get('/workspaces/' + id + '/members');
      setMembers(res.data.data?.members || []);
    } catch { /* ignore */ }
  }, [id]);

  const fetchInvitations = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiClient.get('/workspaces/' + id + '/invitations');
      setInvitations(res.data.data?.invitations || []);
    } catch { /* ignore */ }
  }, [id]);

  const fetchRepos = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiClient.get('/workspaces/' + id + '/repos');
      setRepos(res.data.data?.repos || []);
    } catch { /* ignore */ }
  }, [id]);

  const fetchActivity = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiClient.get('/workspaces/' + id + '/activity');
      setActivities(res.data.data?.activities || []);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchWorkspace(), fetchMembers(), fetchRepos(), fetchActivity(), fetchInvitations()])
      .finally(() => setLoading(false));
  }, [fetchWorkspace, fetchMembers, fetchRepos, fetchActivity, fetchInvitations]);

  const handleSaveSettings = async () => {
    if (!id || !editName.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await apiClient.patch('/workspaces/' + id, { name: editName.trim(), description: editDesc.trim() });
      toast.success('Workspace updated!');
      setIsEditing(false);
      fetchWorkspace();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to update workspace');
    } finally { setSaving(false); }
  };

  const handleArchive = async () => {
    if (!id) return;
    setArchiving(true);
    try {
      await apiClient.post('/workspaces/' + id + '/archive');
      toast.success('Workspace archived');
      navigate('/workspace');
    } catch {
      toast.error('Failed to archive workspace');
    } finally { setArchiving(false); setShowArchiveConfirm(false); }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await apiClient.delete('/workspaces/' + id);
      toast.success('Workspace deleted');
      navigate('/workspace');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to delete workspace');
    } finally { setDeleting(false); setShowDeleteConfirm(false); }
  };

  const handleInvite = async () => {
    if (!id || !inviteEmail.trim()) { toast.error('Email is required'); return; }
    setInviting(true);
    try {
      await apiClient.post('/workspaces/' + id + '/invitations', { email: inviteEmail.trim(), role: inviteRole });
      toast.success('Invitation sent!');
      setInviteEmail('');
      setInviteRole('member');
      fetchInvitations();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to send invitation');
    } finally { setInviting(false); }
  };

  const handleRevokeInvitation = async (inviteId: string) => {
    if (!id) return;
    setRevokingInvite(inviteId);
    try {
      await apiClient.delete('/workspaces/' + id + '/invitations/' + inviteId);
      toast.success('Invitation revoked');
      fetchInvitations();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to revoke invitation');
    } finally { setRevokingInvite(null); }
  };

  const handleRoleChange = async (userId: string, newRole: WorkspaceRole) => {
    if (!id) return;
    try {
      await apiClient.patch('/workspaces/' + id + '/members/' + userId, { role: newRole });
      toast.success('Role updated!');
      fetchMembers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to update role');
    }
  };

  const handleRemoveRepo = async () => {
    if (!id || !removeRepo) return;
    setRemovingRepo(true);
    try {
      await apiClient.delete('/github/repos/imported/' + removeRepo.id);
      toast.success('Repository removed');
      setRemoveRepo(null);
      fetchRepos();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to remove repository');
    } finally { setRemovingRepo(false); }
  };

  const handleRemoveMember = async () => {
    if (!id || !removeTarget) return;
    try {
      await apiClient.delete('/workspaces/' + id + '/members/' + removeTarget.id);
      toast.success('Member removed');
      setRemoveTarget(null);
      fetchMembers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to remove member');
    }
  };

  const canManage = workspace && (workspace.userRole === 'owner' || workspace.userRole === 'admin');
  const isOwner = workspace?.userRole === 'owner';

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <Users className="h-12 w-12 text-surface-600" />
        <p className="text-surface-300">Workspace not found</p>
        <button onClick={() => navigate('/workspace')} className="text-sm text-primary-400 hover:underline">Go back</button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof Info }[] = [
    { key: 'overview', label: 'Overview', icon: Info },
    { key: 'repos', label: 'Repositories (' + repos.length + ')', icon: GitBranch },
    { key: 'members', label: 'Members (' + workspace.memberCount + ')', icon: Users },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 sm:space-y-6">        <div className="flex items-start sm:items-center gap-2 sm:gap-4">
        <button onClick={() => navigate('/workspace')} className="flex h-7 w-7 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-lg border border-surface-700 text-surface-400 transition-all hover:bg-surface-800 hover:text-surface-200">
          <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
            <h1 className="text-base sm:text-xl lg:text-2xl font-bold text-surface-100 truncate">{workspace.name}</h1>
            <span className={'rounded-full px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-xs font-medium flex-shrink-0 ' + ROLE_BADGES[workspace.userRole].color}>
              {ROLE_BADGES[workspace.userRole].label}
            </span>
          </div>
          {workspace.description && (
            <p className="mt-0.5 text-[11px] sm:text-sm text-surface-400 truncate">{workspace.description}</p>
          )}
        </div>
      </div>

      <div className="flex gap-1 rounded-xl border border-surface-700 bg-surface-900/50 p-1 backdrop-blur-sm overflow-x-auto scrollbar-thin">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={
              'flex flex-1 items-center justify-center gap-1 sm:gap-2 rounded-lg px-1.5 sm:px-4 py-1.5 sm:py-2.5 text-[9px] sm:text-sm font-medium transition-all whitespace-nowrap ' +
              (activeTab === tab.key
                ? 'bg-primary-500/15 text-primary-400 shadow-sm'
                : 'text-surface-400 hover:text-surface-200')
            }
          >
            <tab.icon className="h-2.5 w-2.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-surface-700 bg-surface-900/50 p-3 sm:p-6 backdrop-blur-sm">
        {activeTab === 'overview' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="rounded-lg border border-surface-700 bg-surface-800/30 p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs text-surface-400">Plan</p>
                <p className="mt-0.5 sm:mt-1 text-sm sm:text-lg font-semibold text-surface-200 capitalize">{workspace.plan}</p>
              </div>
              <div className="rounded-lg border border-surface-700 bg-surface-800/30 p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs text-surface-400">Members</p>
                <p className="mt-0.5 sm:mt-1 text-sm sm:text-lg font-semibold text-surface-200">{workspace.memberCount}</p>
              </div>
              <div className="rounded-lg border border-surface-700 bg-surface-800/30 p-3 sm:p-4 col-span-2 sm:col-span-1">
                <p className="text-[10px] sm:text-xs text-surface-400">Created</p>
                <p className="mt-0.5 sm:mt-1 text-sm sm:text-lg font-semibold text-surface-200">{new Date(workspace.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div>
              <h3 className="mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-surface-200">
                <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-surface-400" />
                Recent Activity
              </h3>
              {activities.length === 0 ? (
                <div className="flex flex-col items-center py-6 sm:py-8 text-center">
                  <Clock className="mb-2 h-5 w-5 sm:h-6 sm:w-6 text-surface-600" />
                  <p className="text-xs sm:text-sm text-surface-400">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-1.5 sm:space-y-2">
                  {activities.slice(0, 10).map((a, i) => (
                    <div key={i} className="flex items-center gap-2 sm:gap-3 rounded-lg bg-surface-800/30 px-3 sm:px-4 py-2 sm:py-2.5">
                      <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-primary-500/10">
                        <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary-400" />
                      </div>
                      <p className="flex-1 text-[11px] sm:text-sm text-surface-300 truncate">{a.description} joined the workspace</p>
                      <span className="text-[10px] sm:text-xs text-surface-500 flex-shrink-0">{new Date(a.timestamp).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'repos' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-surface-200">
                <GitBranch className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-surface-400" />
                Linked Repositories ({repos.length})
              </h3>
            </div>
            {repos.length === 0 ? (
              <div className="flex flex-col items-center py-8 sm:py-12 text-center">
                <GitBranch className="mb-3 h-7 w-7 sm:h-8 sm:w-8 text-surface-600" />
                <p className="text-xs sm:text-sm text-surface-400">No repositories linked to this workspace</p>
                <p className="mt-1 text-[10px] sm:text-xs text-surface-500">
                  Go to{' '}
                  <button onClick={() => navigate('/github')} className="text-primary-400 hover:underline">
                    GitHub
                  </button>{' '}
                  to import and link repositories
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 sm:space-y-2">
                {repos.map((repo) => {
                  const status = repo.indexStatus || 'not_indexed';
                  return (
                    <div key={repo.id} className="flex flex-col justify-between gap-2 rounded-lg border border-surface-700 bg-surface-900/30 px-3 sm:flex-row sm:items-center sm:px-4 py-2.5 sm:py-3 transition-all hover:border-surface-600">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <GitBranch className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 text-surface-400" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-medium text-surface-200 truncate">{repo.fullName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {repo.language && (
                              <span className="text-[9px] sm:text-[10px] text-surface-400">{repo.language}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2 sm:ml-0 sm:gap-3">
                        <span className={
                          'rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-medium whitespace-nowrap ' +
                          (status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                           status === 'processing' || status === 'pending' ? 'bg-blue-500/10 text-blue-400' :
                           status === 'failed' ? 'bg-red-500/10 text-red-400' :
                           'bg-surface-800 text-surface-400')
                        }>
                          {status === 'completed' ? repo.indexedFiles + ' files' :
                           status === 'processing' ? 'Processing...' :
                           status === 'pending' ? 'Queued' :
                           status === 'failed' ? 'Failed' :
                           'Not indexed'}
                        </span>
                        <button
                          onClick={() => setRemoveRepo({ id: repo.id, name: repo.fullName })}
                          className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg text-surface-400 transition-all hover:bg-red-500/10 hover:text-red-400"
                          title="Remove repository"
                        >
                          <Trash2 className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                        </button>
                        {repo.url && (
                          <a href={repo.url} target="_blank" rel="noopener noreferrer"
                            className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg text-surface-400 transition-all hover:bg-surface-800 hover:text-surface-200"
                          >
                            <ExternalLink className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-6">
            {canManage && (
              <div className="rounded-lg border border-surface-700 bg-surface-800/30 p-3 sm:p-4">
                <h3 className="mb-3 flex items-center gap-2 text-xs sm:text-sm font-semibold text-surface-200">
                  <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-surface-400" />
                  Invite Member
                </h3>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-surface-400" />
                    <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full rounded-lg border border-surface-600 bg-surface-800 py-2 sm:py-2.5 pl-9 sm:pl-10 pr-3 sm:pr-4 text-xs sm:text-sm text-surface-100 placeholder-surface-500 focus:border-primary-500/50 focus:outline-none"
                    />
                  </div>
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value as WorkspaceRole)}
                    className="rounded-lg border border-surface-600 bg-surface-800 px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-surface-300 focus:border-primary-500/50 focus:outline-none"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="guest">Guest</option>
                  </select>
                  <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                    className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-white transition-all hover:bg-primary-700 disabled:opacity-50"
                  >
                    {inviting ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                    {inviting ? 'Inviting...' : 'Invite'}
                  </button>
                </div>
              </div>
            )}

            {canManage && invitations.length > 0 && (
              <div className="rounded-lg border border-surface-700 bg-surface-800/30 p-3 sm:p-4">
                <h3 className="mb-3 flex items-center gap-2 text-xs sm:text-sm font-semibold text-surface-200">
                  <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-surface-400" />
                  Pending Invitations ({invitations.length})
                </h3>
                <div className="space-y-2">
                  {invitations.map((invite) => (
                    <div key={invite.id} className="flex items-center gap-2 sm:gap-3 rounded-lg bg-surface-900/40 px-3 py-2.5">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-surface-200 truncate">{invite.email}</p>
                        <p className="text-[10px] text-surface-400">
                          {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)} · sent {new Date(invite.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRevokeInvitation(invite.id)}
                        disabled={revokingInvite === invite.id}
                        className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-surface-600 px-2.5 py-1.5 text-[10px] font-medium text-surface-300 transition-all hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                        title="Revoke invitation"
                      >
                        {revokingInvite === invite.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserMinus className="h-3 w-3" />}
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5 sm:space-y-2">
              {members.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Users className="mb-2 h-6 w-6 text-surface-600" />
                  <p className="text-xs sm:text-sm text-surface-400">No members found</p>
                </div>
              ) : (
                members.map((member) => (
                  <div key={member.id} className="flex items-center gap-2 sm:gap-4 rounded-lg border border-surface-700 bg-surface-900/30 px-3 sm:px-4 py-2.5 sm:py-3 transition-all hover:border-surface-600">
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-[10px] sm:text-xs font-medium text-white">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-surface-200 truncate">{member.name}</p>
                      <p className="text-[10px] sm:text-xs text-surface-400 truncate">{member.email}</p>
                    </div>
                    {canManage && member.role !== 'owner' ? (
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        <select value={member.role} onChange={e => handleRoleChange(member.userId, e.target.value as WorkspaceRole)}
                          className="rounded-lg border border-surface-600 bg-surface-800 px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs text-surface-300 focus:border-primary-500/50 focus:outline-none"
                        >
                          {ROLES_FOR_SELECT.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                        </select>
                        <button onClick={() => setRemoveTarget({ id: member.userId, name: member.name })}
                          className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-surface-400 transition-all hover:bg-red-500/10 hover:text-red-400"
                        >
                          <UserMinus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className={'rounded-full px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-xs font-medium flex-shrink-0 ' + ROLE_BADGES[member.role].color}>
                        {ROLE_BADGES[member.role].label}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {removeTarget && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setRemoveTarget(null)}>
                <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                  className="w-full max-w-sm rounded-xl border border-surface-700 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold text-surface-200">Remove Member?</h3>
                  <p className="mt-2 text-sm text-surface-300">Are you sure you want to remove <strong>{removeTarget.name}</strong> from this workspace?</p>
                  <div className="mt-5 flex justify-end gap-3">
                    <button onClick={() => setRemoveTarget(null)} className="rounded-lg border border-surface-600 px-4 py-2 text-sm text-surface-300 hover:bg-surface-800">Cancel</button>
                    <button onClick={handleRemoveMember} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                      <UserMinus className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-8">
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-200">
                <Edit3 className="h-4 w-4 text-surface-400" />
                General Settings
              </h3>
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm text-surface-300">Workspace Name</label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2.5 text-sm text-surface-100 focus:border-primary-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm text-surface-300">Description</label>
                    <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
                      className="w-full resize-none rounded-lg border border-surface-600 bg-surface-800 px-3 py-2.5 text-sm text-surface-100 focus:border-primary-500/50 focus:outline-none"
                      placeholder="Workspace description..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleSaveSettings} disabled={saving}
                      className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-primary-700 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button onClick={() => { setIsEditing(false); setEditName(workspace.name); setEditDesc(workspace.description); }}
                      className="rounded-lg border border-surface-600 px-4 py-2 text-sm text-surface-300 transition-all hover:bg-surface-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-surface-700 bg-surface-800/30 p-4">
                    <p className="text-xs text-surface-400">Name</p>
                    <p className="mt-1 text-sm text-surface-200">{workspace.name}</p>
                  </div>
                  <div className="rounded-lg border border-surface-700 bg-surface-800/30 p-4">
                    <p className="text-xs text-surface-400">Slug</p>
                    <p className="mt-1 text-sm text-surface-200">{workspace.slug}</p>
                  </div>
                  {workspace.description && (
                    <div className="rounded-lg border border-surface-700 bg-surface-800/30 p-4">
                      <p className="text-xs text-surface-400">Description</p>
                      <p className="mt-1 text-sm text-surface-200">{workspace.description}</p>
                    </div>
                  )}
                  {canManage && (
                    <button onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2 rounded-lg border border-surface-600 px-4 py-2 text-sm text-surface-300 transition-all hover:bg-surface-800 hover:text-surface-100"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit Workspace
                    </button>
                  )}
                </div>
              )}
            </div>

            {isOwner && (
              <div className="rounded-xl border border-red-900/40 bg-red-950/10 p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-red-400">
                  <ShieldAlert className="h-4 w-4" />
                  Danger Zone
                </h3>
                <p className="mt-1 text-xs text-red-400/70">Irreversible actions &mdash; proceed with caution</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={() => setShowArchiveConfirm(true)}
                    className="flex items-center gap-2 rounded-lg border border-red-900/40 px-4 py-2 text-sm text-red-400 transition-all hover:bg-red-500/10"
                  >
                    <Archive className="h-4 w-4" />
                    Archive Workspace
                  </button>
                  <button onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 rounded-lg bg-red-600/20 px-4 py-2 text-sm font-medium text-red-400 transition-all hover:bg-red-600/30"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Workspace
                  </button>
                </div>
              </div>
            )}

            {showArchiveConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowArchiveConfirm(false)}>
                <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                  className="w-full max-w-sm rounded-xl border border-surface-700 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold text-surface-200">Archive Workspace?</h3>
                  <p className="mt-2 text-sm text-surface-300">The workspace will be hidden. You can unarchive it later.</p>
                  <div className="mt-5 flex justify-end gap-3">
                    <button onClick={() => setShowArchiveConfirm(false)} className="rounded-lg border border-surface-600 px-4 py-2 text-sm text-surface-300 hover:bg-surface-800">Cancel</button>
                    <button onClick={handleArchive} disabled={archiving} className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                      {archiving && <Loader2 className="h-4 w-4 animate-spin" />}
                      Archive
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {removeRepo && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setRemoveRepo(null)}>
                <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                  className="w-full max-w-sm rounded-xl border border-surface-700 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold text-red-400">Remove Repository?</h3>
                  <p className="mt-2 text-sm text-surface-300">
                    This will permanently remove <strong>{removeRepo.name}</strong> and all its indexed data (files, chunks, reports).
                  </p>
                  <div className="mt-5 flex justify-end gap-3">
                    <button onClick={() => setRemoveRepo(null)}
                      className="rounded-lg border border-surface-600 px-4 py-2 text-sm text-surface-300 hover:bg-surface-800"
                    >
                      Cancel
                    </button>
                    <button onClick={handleRemoveRepo} disabled={removingRepo}
                      className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {removingRepo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      {removingRepo ? 'Removing...' : 'Remove Permanently'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {showDeleteConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowDeleteConfirm(false)}>
                <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                  className="w-full max-w-sm rounded-xl border border-surface-700 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold text-red-400">Delete Workspace?</h3>
                  <p className="mt-2 text-sm text-surface-300">This will permanently delete the workspace and all associated data.</p>
                  <div className="mt-5 flex justify-end gap-3">
                    <button onClick={() => setShowDeleteConfirm(false)} className="rounded-lg border border-surface-600 px-4 py-2 text-sm text-surface-300 hover:bg-surface-800">Cancel</button>
                    <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      {deleting ? 'Deleting...' : 'Delete Permanently'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
