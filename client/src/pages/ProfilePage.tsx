import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { UserCircle, Camera, Loader2, Save, AtSign, Mail, CheckCircle2 } from 'lucide-react';
import apiClient from '../api/axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store';

export function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [email, setEmail] = useState(user?.email || '');
  const [joinedAt, setJoinedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiClient.get('/auth/me')
      .then((res) => {
        const u = res.data.data?.user;
        if (u) {
          setName(u.name || '');
          setUsername(u.username || '');
          setBio(u.bio || '');
          setAvatar(u.avatar || null);
          setEmail(u.email || '');
          setJoinedAt(u.createdAt || '');
        }
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false));
  }, []);

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/upload/avatar', formData, { headers: { 'Content-Type': undefined } });
      const url = res.data.data?.avatar?.url;
      if (url) {
        setAvatar(url);
        toast.success('Avatar uploaded — save your profile to apply it');
      }
    } catch {
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        username: username.trim(),
        bio: bio.trim(),
      };
      if (avatar) body.avatar = avatar;
      const res = await apiClient.patch('/auth/profile', body);
      const updated = res.data.data?.user;
      if (updated) {
        setUser({
          id: updated.id || updated._id,
          email: updated.email,
          name: updated.name,
          role: updated.role || user?.role || 'user',
        });
        toast.success('Profile updated!');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-400" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-surface-100">
          <UserCircle className="h-5 w-5 sm:h-6 sm:w-6 text-primary-400" />
          Profile Settings
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-surface-400">Manage your personal information and avatar</p>
      </div>

      <div className="rounded-xl border border-surface-700 bg-surface-900/50 p-4 sm:p-6">
        {/* Avatar */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white">
              {avatar ? <img src={avatar} alt="Avatar" className="h-full w-full object-cover" /> : (name?.charAt(0)?.toUpperCase() || 'D')}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-surface-600 bg-surface-800 text-surface-300 transition-colors hover:bg-surface-700 disabled:opacity-50"
              title="Upload avatar"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-200">{name || 'Your name'}</p>
            <p className="flex items-center gap-1.5 text-xs text-surface-400 mt-0.5">
              <AtSign className="h-3 w-3" />
              {username || 'username'}
            </p>
            {joinedAt && (
              <p className="mt-0.5 text-[10px] text-surface-500">Member since {new Date(joinedAt).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-surface-300">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2.5 text-sm text-surface-100 focus:border-primary-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-surface-300">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2.5 text-sm text-surface-100 focus:border-primary-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-surface-300">Email</label>
            <div className="flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2.5 text-sm text-surface-500">
              <Mail className="h-4 w-4" />
              {email}
              <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-surface-300">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell the team a little about yourself..."
              className="w-full resize-none rounded-lg border border-surface-600 bg-surface-800 px-3 py-2.5 text-sm text-surface-100 placeholder-surface-500 focus:border-primary-500/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !username.trim()}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
