import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthActions, type OAuthProvider } from '../auth/actions';
import { useSession } from '../stores/session';
import { isDbConfigured } from '../lib/supabase';
import { AVATARS, avatarById } from '../data/avatars';
import { isUsernameTaken, validUsername } from '../lib/store';
import { FacebookLogo, GithubLogo, GoogleLogo } from './BrandLogos';

export function AvatarFace({ id, size = 40 }: { id: number; size?: number }) {
  const a = avatarById(id);
  return (
    <span
      title={a.label}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: a.bg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.52,
        flexShrink: 0,
      }}
    >
      {a.glyph}
    </span>
  );
}

export function LoginButtons({ column = false }: { column?: boolean }) {
  const cloud = isDbConfigured();
  const { login } = useAuthActions();
  const btns = [
    { p: 'google' as OAuthProvider, label: 'Google', Logo: GoogleLogo },
    { p: 'github' as OAuthProvider, label: 'GitHub', Logo: GithubLogo },
    { p: 'facebook' as OAuthProvider, label: 'Facebook', Logo: FacebookLogo },
  ];
  return (
    <div className={column ? 'oauth-col' : 'btnrow'}>
      {btns.map((b, i) => (
        <motion.button
          key={b.p}
          type="button"
          className="oauth-btn"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.08 }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { login(b.p).catch((e) => console.warn(e)); }}
        >
          <b.Logo size={19} />
          <span>Continue with {b.label}</span>
        </motion.button>
      ))}
    </div>
  );
}

export function UsernameModal() {
  const needsUsername = useSession((s) => s.needsUsername);
  const email = useSession((s) => s.email);
  const applyProfile = useSession((s) => s.applyProfile);
  const syncNote = useSession((s) => s.syncNote);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  if (!needsUsername) return null;

  async function save() {
    setMsg('');
    const err = validUsername(name);
    if (err) {
      setMsg(err);
      return;
    }
    setBusy(true);
    try {
      if (await isUsernameTaken(name)) {
        setMsg('That username is taken — try another.');
        return;
      }
      await applyProfile(name, avatar);
    } catch (e: any) {
      setMsg(e?.message || 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,40,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div className="card" style={{ maxWidth: 460, width: '100%' }}>
        <h3 style={{ marginTop: 0 }}>Pick your username</h3>
        <p className="hint">Logged in as <b>{email || 'OAuth user'}</b>. Usernames are unique — first come, first served.</p>
        <div className="field">
          <label>Username</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. priya_practises" maxLength={20} />
        </div>
        <div className="field">
          <label>Avatar (16 to choose from)</label>
          <AvatarGrid value={avatar} onPick={setAvatar} />
        </div>
        {msg && <div className="err">{msg}</div>}
        {syncNote && <p className="hint">{syncNote}</p>}
        <div className="btnrow">
          <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save & continue'}</button>
        </div>
      </div>
    </div>
  );
}

export function AvatarGrid({ value, onPick }: { value: number; onPick: (id: number) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
      {AVATARS.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onPick(a.id)}
          title={a.label}
          style={{
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: value === a.id ? '2px solid #1b4fa0' : '2px solid transparent',
            borderRadius: '50%',
            padding: 0,
            background: 'none',
            cursor: 'pointer',
          }}
        >
          <AvatarFace id={a.id} size={38} />
        </button>
      ))}
    </div>
  );
}
