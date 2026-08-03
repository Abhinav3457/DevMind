import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Mail, UserPlus, Check, X, Loader2, Users, Clock,
  ShieldCheck, CalendarClock,
} from 'lucide-react';
import apiClient from '../api/axios';
import toast from 'react-hot-toast';

interface Invitation {
  id: string;
  workspaceId: string;
  workspaceName?: string;
  inviterName?: string;
  email: string;
  role: string;
  status: string;
  token?: string;
  expiresAt?: string;
  createdAt?: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  guest: 'Guest',
};

function InviteCard({ invite, onAccept, onDecline, busy }: {
  invite: Invitation;
  onAccept: (invite: Invitation) => void;
  onDecline: (invite: Invitation) => void;
  busy: string | null;
}) {
  const status = invite.status;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4 rounded-xl border border-surface-700 bg-surface-900/50 p-4 sm:flex-row sm:items-center sm:p-5 backdrop-blur-sm transition-all hover:border-primary-500/30"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
        <Users className="h-5 w-5 text-primary-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-100 truncate">
          {invite.workspaceName || 'Workspace'}
          <span className={'ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ' +
            (invite.role === 'admin' ? 'bg-blue-500/10 text-blue-400' : 'bg-surface-800 text-surface-300')}>
            {ROLE_LABELS[invite.role] || invite.role}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-surface-400">
          Invited by <span className="text-surface-300">{invite.inviterName || 'Someone'}</span>
          {invite.createdAt && (
            <span className="ml-1 inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {new Date(invite.createdAt).toLocaleDateString()}
            </span>
          )}
        </p>
      </div>

      {status === 'pending' && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onDecline(invite)}
            disabled={busy === invite.id}
            className="flex items-center gap-1.5 rounded-lg border border-surface-600 px-3.5 py-2 text-xs font-medium text-surface-300 transition-all hover:bg-surface-800 hover:text-surface-100 disabled:opacity-50"
          >
            {busy === invite.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Decline
          </button>
          <button
            onClick={() => onAccept(invite)}
            disabled={busy === invite.id}
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-primary-700 disabled:opacity-50"
          >
            {busy === invite.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Accept
          </button>
        </div>
      )}

      {status !== 'pending' && (
        <span className={'flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ' +
          (status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400' :
           status === 'declined' ? 'bg-red-500/10 text-red-400' :
           'bg-amber-500/10 text-amber-400')}>
          {status === 'accepted' ? 'Accepted' : status === 'declined' ? 'Declined' : 'Expired'}
        </span>
      )}
    </motion.div>
  );
}

export function InvitationsPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [singleInvite, setSingleInvite] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    try {
      const res = await apiClient.get('/invitations');
      setInvitations(res.data.data?.invitations || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const loadSingle = useCallback(async (inviteToken: string) => {
    try {
      const res = await apiClient.get('/invitations/' + inviteToken);
      setSingleInvite(res.data.data?.invitation || null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Invitation not found');
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (token) {
      loadSingle(token);
      // Email "decline" links carry ?action=decline
      if (searchParams.get('action') === 'decline') {
        apiClient.post('/invitations/' + token + '/decline')
          .then(() => toast.success('Invitation declined'))
          .catch((err: unknown) => {
            const e = err as { response?: { data?: { message?: string } } };
            toast.error(e?.response?.data?.message || 'Failed to decline invitation');
          })
          .finally(() => loadSingle(token));
      }
    } else {
      refreshList();
    }
  }, [token, searchParams, loadSingle, refreshList]);

  const handleAccept = async (invite: Invitation) => {
    // In the email-link view the server response omits the token, so fall
    // back to the token from the URL.
    const inviteToken = invite.token || token;
    if (!inviteToken) return;
    setBusy(invite.id);
    try {
      await apiClient.post('/invitations/' + inviteToken + '/accept');
      toast.success('Invitation accepted — welcome to the workspace!');
      navigate('/workspace/' + invite.workspaceId);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to accept invitation');
      if (!token) { refreshList(); }
    } finally { setBusy(null); }
  };

  const handleDecline = async (invite: Invitation) => {
    const inviteToken = invite.token || token;
    if (!inviteToken) return;
    setBusy(invite.id);
    try {
      await apiClient.post('/invitations/' + inviteToken + '/decline');
      toast.success('Invitation declined');
      if (token) {
        loadSingle(token);
      } else {
        refreshList();
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to decline invitation');
    } finally { setBusy(null); }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
      </div>
    );
  }

  const pending = invitations.filter((i) => i.status === 'pending');
  const responded = invitations.filter((i) => i.status !== 'pending');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-surface-100">Invitations</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-surface-400">Respond to workspace invitations you've received</p>
      </div>

      {token ? (
        singleInvite ? (
          <div className="max-w-xl space-y-3">
            <InviteCard invite={singleInvite} onAccept={handleAccept} onDecline={handleDecline} busy={busy} />
            {singleInvite.expiresAt && (
              <p className="flex items-center gap-1.5 text-xs text-surface-500">
                <CalendarClock className="h-3.5 w-3.5" />
                Invitation expires {new Date(singleInvite.expiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center py-16 text-center">
            <Mail className="mb-3 h-10 w-10 text-surface-600" />
            <p className="text-sm text-surface-400">Invitation not found or already responded to</p>
          </div>
        )
      
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <h3 className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-surface-200">
                <UserPlus className="h-4 w-4 text-surface-400" />
                Pending ({pending.length})
              </h3>
              {pending.map((invite) => (
                <InviteCard key={invite.id} invite={invite} onAccept={handleAccept} onDecline={handleDecline} busy={busy} />
              ))}
            </div>
          )}

          {responded.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <h3 className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-surface-400">
                <ShieldCheck className="h-4 w-4" />
                Responded
              </h3>
              {responded.map((invite) => (
                <InviteCard key={invite.id} invite={invite} onAccept={handleAccept} onDecline={handleDecline} busy={busy} />
              ))}
            </div>
          )}

          {pending.length === 0 && responded.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <Mail className="mb-3 h-10 w-10 text-surface-600" />
              <p className="text-sm font-medium text-surface-300">No invitations yet</p>
              <p className="mt-1 text-xs text-surface-500">When someone invites you to a workspace, it will show up here</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
