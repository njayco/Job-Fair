import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { LogOut, Mail, Camera, CheckCircle, AlertCircle } from 'lucide-react';
import { updateProfile, uploadAvatar, deleteAvatar } from '../api';

const FIELD_STYLE: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#0A0F1E',
  border: '1px solid #1E293B',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.75rem',
  color: '#F0F4FF',
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.875rem',
  outline: 'none',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontFamily: "'JetBrains Mono', monospace",
  color: '#94A3B8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.375rem',
};

export default function AccountPage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    desired_occupation: user?.desired_occupation ?? '',
    industry: user?.industry ?? '',
    location: user?.location ?? '',
    interests: user?.interests ?? '',
  });

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarRemoving, setAvatarRemoving] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarKey, setAvatarKey] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        desired_occupation: user.desired_occupation ?? '',
        industry: user.industry ?? '',
        location: user.location ?? '',
        interests: user.interests ?? '',
      });
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setSaveStatus('idle');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus('idle');
    setSaveError('');
    try {
      await updateProfile(form);
      await refreshUser();
      setSaveStatus('success');
    } catch (err: unknown) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarRemoving(true);
    setAvatarError('');
    try {
      await deleteAvatar();
      await refreshUser();
      setAvatarKey(k => k + 1);
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to remove photo');
    } finally {
      setAvatarRemoving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError('');
    try {
      await uploadAvatar(file);
      await refreshUser();
      setAvatarKey(k => k + 1);
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!user) return null;

  const displayName = user.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : user.email;

  const initials = user.first_name
    ? (user.first_name[0] + (user.last_name?.[0] ?? '')).toUpperCase()
    : user.email.slice(0, 2).toUpperCase();

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#F0F4FF' }}
          >
            Account
          </h1>
          <p style={{ color: '#94A3B8', marginTop: '0.25rem' }}>Manage your profile and session.</p>
        </div>

        {/* Avatar + identity */}
        <div
          className="rounded-xl border p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6"
          style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}
        >
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold border-2"
              style={{
                backgroundColor: '#1E293B',
                borderColor: '#3B82F6',
                color: '#F0F4FF',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              {user.has_avatar ? (
                <img
                  key={avatarKey}
                  src={`/api/profile/avatar?v=${avatarKey}`}
                  alt="Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                initials
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading || avatarRemoving}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors"
              style={{
                backgroundColor: '#3B82F6',
                borderColor: '#0F172A',
                color: '#fff',
                cursor: (avatarUploading || avatarRemoving) ? 'wait' : 'pointer',
              }}
              title="Change photo"
            >
              <Camera size={13} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div
              className="font-bold text-lg truncate"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#F0F4FF' }}
            >
              {displayName}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5" style={{ color: '#94A3B8', fontSize: '0.813rem' }}>
              <Mail size={12} />
              {user.email}
            </div>
            <div
              className="text-xs mt-1"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}
            >
              ID #{user.id} · {user.account_type === 'employer' ? 'Employer' : 'Job Seeker'}
              {user.is_admin && <span style={{ color: '#F59E0B' }}> · Admin</span>}
            </div>
            {(avatarUploading || avatarRemoving) && (
              <div className="text-xs mt-1" style={{ color: '#3B82F6', fontFamily: "'JetBrains Mono', monospace" }}>
                {avatarRemoving ? 'Removing photo...' : 'Uploading photo...'}
              </div>
            )}
            {avatarError && (
              <div className="text-xs mt-1" style={{ color: '#EF4444' }}>{avatarError}</div>
            )}
            {!avatarUploading && !avatarRemoving && (
              <div className="flex items-center gap-3 mt-1">
                <div className="text-xs" style={{ color: '#94A3B8' }}>
                  Click the camera icon to change your photo (max 5 MB)
                </div>
                {user.has_avatar && (
                  <button
                    type="button"
                    onClick={handleAvatarRemove}
                    className="text-xs"
                    style={{ color: '#EF4444', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#F87171')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#EF4444')}
                  >
                    Remove photo
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Profile form */}
        <form onSubmit={handleSave}>
          <div
            className="rounded-xl border p-6 space-y-5"
            style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}
          >
            <h2
              className="text-base font-semibold"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#F0F4FF' }}
            >
              Profile Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label style={LABEL_STYLE}>First Name</label>
                <input
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="e.g. Jordan"
                  style={FIELD_STYLE}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#1E293B')}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Last Name</label>
                <input
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="e.g. Smith"
                  style={FIELD_STYLE}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#1E293B')}
                />
              </div>
            </div>

            <div>
              <label style={LABEL_STYLE}>Desired Occupation</label>
              <input
                name="desired_occupation"
                value={form.desired_occupation}
                onChange={handleChange}
                placeholder="e.g. Senior Product Manager"
                style={FIELD_STYLE}
                onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                onBlur={e => (e.currentTarget.style.borderColor = '#1E293B')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label style={LABEL_STYLE}>Industry</label>
                <input
                  name="industry"
                  value={form.industry}
                  onChange={handleChange}
                  placeholder="e.g. Technology"
                  style={FIELD_STYLE}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#1E293B')}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Location</label>
                <input
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="e.g. New York, NY"
                  style={FIELD_STYLE}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#1E293B')}
                />
              </div>
            </div>

            <div>
              <label style={LABEL_STYLE}>Interests</label>
              <textarea
                name="interests"
                value={form.interests}
                onChange={handleChange}
                rows={3}
                placeholder="e.g. machine learning, distributed systems, team leadership..."
                style={{ ...FIELD_STYLE, resize: 'vertical', lineHeight: '1.5' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                onBlur={e => (e.currentTarget.style.borderColor = '#1E293B')}
              />
            </div>

            <div className="flex items-center gap-4 pt-2">
              <Button
                type="submit"
                disabled={saving}
                className="font-mono"
                style={{
                  backgroundColor: '#3B82F6',
                  color: '#fff',
                  opacity: saving ? 0.7 : 1,
                  cursor: saving ? 'wait' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
              {saveStatus === 'success' && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: '#10B981' }}>
                  <CheckCircle size={15} /> Saved
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: '#EF4444' }}>
                  <AlertCircle size={15} /> {saveError}
                </span>
              )}
            </div>
          </div>
        </form>

        {/* Sign out */}
        <div
          className="rounded-xl border p-6"
          style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}
        >
          <h2
            className="text-base font-semibold mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#F0F4FF' }}
          >
            Session
          </h2>
          <Button variant="danger" onClick={handleLogout} className="gap-2 font-mono">
            <LogOut className="w-4 h-4" />
            SIGN OUT
          </Button>
        </div>
      </div>
    </Layout>
  );
}
