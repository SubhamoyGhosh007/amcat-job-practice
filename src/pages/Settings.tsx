import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useAuthActions } from '../auth/actions';
import { AvatarFace, AvatarGrid } from '../components/AuthWidgets';
import { useConfirm } from '../ui/alert-dialog';
import { isUsernameTaken, validUsername } from '../lib/store';
import { useSession } from '../stores/session';

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { logout } = useAuthActions();
  const userId = useSession((s) => s.userId);
  const email = useSession((s) => s.email);
  const profile = useSession((s) => s.profile);
  const applyProfile = useSession((s) => s.applyProfile);
  const ask = useConfirm();

  const [name, setName] = useState(profile?.username || '');
  const [avatar, setAvatar] = useState(profile?.avatarId ?? 0);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(profile?.username || '');
    setAvatar(profile?.avatarId ?? 0);
  }, [profile?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const identities = [
    ...((user?.externalAccounts || []).map((a: any) => ({
      provider: String(a.provider || '').replace('oauth_', ''),
      email: String(a.emailAddress || ''),
    })) as { provider: string; email: string }[]),
    ...(user?.passwordEnabled ? [{ provider: 'email + password', email }] : []),
  ];

  async function save() {
    setMsg('');
    setOk('');
    const err = validUsername(name);
    if (err) {
      setMsg(err);
      return;
    }
    setBusy(true);
    try {
      if (!userId) {
        setMsg('Log in first to save a cloud profile.');
        return;
      }
      if (name.trim().toLowerCase() !== (profile?.username || '').toLowerCase() && (await isUsernameTaken(name, userId))) {
        setMsg('That username is taken — try another.');
        return;
      }
      await applyProfile(name, avatar);
      setOk('Profile updated ✓ (synced wherever the cloud is reachable)');
    } catch (e: any) {
      setMsg(e?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    await logout().catch(() => {});
    navigate('/', { replace: true });
  }

  return (
    <div className="card set-sec">
      <h3 style={{ marginTop: 0 }}>Settings</h3>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
        <AvatarFace id={profile?.avatarId ?? 0} size={56} />
        <div>
          <b style={{ fontSize: 17 }}>@{profile?.username || '…'}</b>
          <div className="hint">{email}</div>
        </div>
      </div>
      <div className="field">
        <label>Username (unique across all users)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder={profile?.username} />
      </div>
      <div className="field">
        <label>Avatar</label>
        <AvatarGrid value={avatar} onPick={setAvatar} />
      </div>
      {msg && <div className="err">{msg}</div>}
      {ok && <p className="hint">{ok}</p>}
      <div className="btnrow">
        <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save settings'}</button>
      </div>

      <h4>Linked logins</h4>
      {identities.length ? (
        <div>
          {identities.map((i, k) => (
            <span key={k} className="chip">{i.provider}{i.email ? ` • ${i.email}` : ''}</span>
          ))}
        </div>
      ) : (
        <p className="hint">No linked-provider details available.</p>
      )}
      <p className="hint">Clerk merges Google/GitHub/Facebook/LinkedIn logins that share a verified email into one account automatically — one history everywhere.</p>

      <h4>Account</h4>
      <div className="btnrow">
        <button className="btn-ghost" onClick={doLogout}>Log out</button>
        <button
          className="btn-ghost"
            onClick={async () => {
              const ok = await ask({
                title: 'Erase local practice data?',
                description: 'Score sheets, exam history and speaking stats in this browser will be removed. Your profile, typing history and cloud copies stay untouched.',
                actionLabel: 'Erase data',
                danger: true,
              });
              if (ok) {
                Object.keys(localStorage).filter((k) => k.startsWith('amcat_') && !k.startsWith('amcat_profile_') && k !== 'amcat_typing' && k !== 'amcat-ui').forEach((k) => localStorage.removeItem(k));
                location.reload();
              }
            }}
        >
          Erase local data
        </button>
      </div>
      <h4>Backend status</h4>
      <p className="hint">
        Moved to its own page — open <b>Health check</b> in the sidebar to test Auth, Database, AI and storage.
      </p>
    </div>
  );
}
