import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { authClient } from '../lib/supabase';
import type { Identity } from '../auth/actions';
import { confirmEnroll, enrollTotp, listVerifiedTotp, removeTotp, type TotpEnrollment } from '../lib/mfa';
import { genBackupCodes, listBackupCodes, replaceBackupCodes, revokeAllBackupCodes } from '../lib/backupCodes';
import { Badge, Button, Card, CardDesc, CardTitle, Field, Input, Skeleton } from '../ui/primitives';
import { useNavigate } from 'react-router-dom';
import { useAuthActions } from '../auth/actions';
import { AvatarFace, AvatarGrid } from '../components/AuthWidgets';
import { useConfirm } from '../ui/alert-dialog';
import { isUsernameTaken, validUsername } from '../lib/store';
import { useSession } from '../stores/session';

export default function Settings() {
  const navigate = useNavigate();
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
  const [factors, setFactors] = useState<{ id: string; createdAt: string }[] | null>(null);
  const [mfaMode, setMfaMode] = useState<'idle' | 'enroll' | 'disable'>('idle');
  const [enroll, setEnroll] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [mfaMsg, setMfaMsg] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rcodes, setRcodes] = useState<{ id: string; used: boolean; createdAt: number }[]>([]);
  const [fresh, setFresh] = useState<string[] | null>(null);
  const [savedAck, setSavedAck] = useState(false);
  const [rcBusy, setRcBusy] = useState(false);
  const [rcMsg, setRcMsg] = useState('');
  const [rcCopied, setRcCopied] = useState(false);

  async function loadCodes() {
    try {
      if (userId) setRcodes(await listBackupCodes(userId));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadCodes();
  }, [userId]);

  async function generateCodes() {
    if (!userId) return;
    setRcMsg('');
    setRcBusy(true);
    try {
      const c = genBackupCodes(8);
      await replaceBackupCodes(userId, c);
      setFresh(c);
      setSavedAck(false);
      setRcodes(await listBackupCodes(userId));
    } catch (e: any) {
      setRcMsg(e?.message || 'Could not generate. Try again.');
    } finally {
      setRcBusy(false);
    }
  }

  async function revokeCodes() {
    if (!userId) return;
    const ok = await ask({
      title: 'Revoke all backup codes?',
      description: 'Every unused code stops working immediately. Generate a new set right after if you still need a way back in.',
      actionLabel: 'Revoke all',
      danger: true,
    });
    if (!ok) return;
    setRcBusy(true);
    try {
      await revokeAllBackupCodes(userId);
      setFresh(null);
      setRcodes([]);
    } catch (e: any) {
      setRcMsg(e?.message || 'Could not revoke. Try again.');
    } finally {
      setRcBusy(false);
    }
  }

  function copyAllCodes() {
    if (!fresh) return;
    try {
      navigator.clipboard?.writeText(fresh.join('\n'));
      setRcCopied(true);
      window.setTimeout(() => setRcCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function loadFactors() {
    try {
      setFactors(await listVerifiedTotp());
    } catch {
      setFactors([]);
    }
  }

  useEffect(() => {
    loadFactors();
  }, [userId]);

  async function startEnroll() {
    setMfaMsg('');
    setMfaBusy(true);
    try {
      setEnroll(await enrollTotp());
      setCode('');
      setMfaMode('enroll');
    } catch (e: any) {
      setMfaMsg(e?.message || 'Could not start enrollment. Try again.');
    } finally {
      setMfaBusy(false);
    }
  }

  async function confirm() {
    if (!enroll) return;
    if (code.trim().length < 6) {
      setMfaMsg('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setMfaMsg('');
    setMfaBusy(true);
    try {
      await confirmEnroll(enroll.factorId, code.trim());
      setEnroll(null);
      setCode('');
      setMfaMode('idle');
      await loadFactors();
    } catch (e: any) {
      setMfaMsg(/totp|expired|invalid/i.test(String(e?.message)) ? 'Wrong or expired code — codes refresh every 30 seconds.' : e?.message || 'Verification failed. Try again.');
    } finally {
      setMfaBusy(false);
    }
  }

  async function disable() {
    const f = factors?.[0];
    if (!f) return;
    if (code.trim().length < 6) {
      setMfaMsg('Enter a fresh code from your authenticator to confirm it’s you.');
      return;
    }
    setMfaMsg('');
    setMfaBusy(true);
    try {
      await removeTotp(f.id, code.trim());
      setCode('');
      setMfaMode('idle');
      await loadFactors();
    } catch (e: any) {
      setMfaMsg(/totp|expired|invalid/i.test(String(e?.message)) ? 'Wrong or expired code — codes refresh every 30 seconds.' : e?.message || 'Could not disable. Try again.');
    } finally {
      setMfaBusy(false);
    }
  }

  function copySecret() {
    if (!enroll) return;
    try {
      navigator.clipboard?.writeText(enroll.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }
  const [identities, setIdentities] = useState<Identity[]>([]);

  useEffect(() => {
    authClient()?.auth.getUser().then(({ data }) => {
      const ids = (data.user?.identities || []).map((i: any) => ({
        provider: String(i.provider || 'email'),
        email: String(i.identity_data?.email || email),
      }));
      setIdentities(ids.length ? ids : email ? [{ provider: 'email + password', email }] : []);
    });
  }, [userId, email]);

  useEffect(() => {
    setName(profile?.username || '');
    setAvatar(profile?.avatarId ?? 0);
  }, [profile?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: 17, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{profile?.username || '…'}</b>
            <div className="hint" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
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
      <p className="hint">Google/GitHub logins sharing a verified email stay on one account — one history everywhere.</p>

      <h4>Two-factor authentication</h4>
      <Card>
        {factors === null ? (
          <Skeleton style={{ height: 60 }} />
        ) : factors.length === 0 && mfaMode !== 'enroll' ? (
          <>
            <CardTitle>Authenticator app</CardTitle>
            <CardDesc>Add a 6-digit code step to logins. Works with Google Authenticator, Authy, 1Password and any TOTP app.</CardDesc>
            <div style={{ marginTop: 12 }}>
              <Button disabled={mfaBusy} onClick={startEnroll}>Enable authenticator app</Button>
            </div>
          </>
        ) : factors.length > 0 && mfaMode !== 'disable' ? (
          <>
            <CardTitle>Authenticator app</CardTitle>
            <CardDesc>
              On — a code is required at every login{ factors[0]?.createdAt ? ` (linked ${new Date(factors[0].createdAt).toLocaleDateString()})` : ''}.
            </CardDesc>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge tone="success">Protected</Badge>
              <Button variant="outline" size="sm" onClick={() => { setMfaMode('disable'); setCode(''); setMfaMsg(''); }}>Disable</Button>
            </div>
          </>
        ) : null}

        {mfaMode === 'enroll' && enroll && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 16 }}>
            <p style={{ fontSize: 14, margin: '0 0 8px' }}><b>1.</b> Scan this with your authenticator app:</p>
            <div style={{ background: '#fff', padding: 12, borderRadius: 12, display: 'inline-block', border: '1px solid var(--border)' }}>
              {enroll.qrCode.startsWith('data:image') ? (
                <img src={enroll.qrCode} alt="Authenticator QR code" style={{ width: 180, height: 180, display: 'block' }} />
              ) : (
                <span dangerouslySetInnerHTML={{ __html: enroll.qrCode }} />
              )}
            </div>
            <p style={{ fontSize: 14, margin: '12px 0 8px' }}>
              <b>2.</b> Can’t scan? Enter this secret manually: <code>{enroll.secret}</code>{' '}
              <Button variant="ghost" size="sm" onClick={copySecret}>{copied ? 'Copied ✓' : 'Copy'}</Button>
            </p>
            <Field label="3. Enter the 6-digit code it shows now">
              <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" />
            </Field>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Button disabled={mfaBusy} onClick={confirm}>{mfaBusy ? 'Verifying…' : 'Verify & enable'}</Button>
              <Button variant="ghost" onClick={() => { setMfaMode('idle'); setEnroll(null); setCode(''); setMfaMsg(''); }}>Cancel</Button>
            </div>
          </motion.div>
        )}

        {mfaMode === 'disable' && factors?.[0] && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 16 }}>
            <Field label="Enter a fresh code to confirm it’s you">
              <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" />
            </Field>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Button variant="danger" disabled={mfaBusy} onClick={disable}>{mfaBusy ? 'Removing…' : 'Verify & disable'}</Button>
              <Button variant="ghost" onClick={() => { setMfaMode('idle'); setCode(''); setMfaMsg(''); }}>Cancel</Button>
            </div>
          </motion.div>
        )}

        {mfaMsg && <div className="err" style={{ marginTop: 12 }}>{mfaMsg}</div>}
      </Card>
      <p className="hint">Keep the authenticator app — there are no recovery codes in this version, so losing it means an account reset.</p>

      <h4>Backup codes</h4>
      <Card>
        <CardTitle>Lost authenticator? These get you back in</CardTitle>
        <CardDesc>8 single-use codes. Each one buys an emailed login link, then burns forever. Generating a new set kills the old one. Only salted hashes are stored — never the codes themselves.</CardDesc>
        {fresh ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 12 }}>
            <div className="banner warn">Write these down NOW — they will never be shown again.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, margin: '12px 0', fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>
              {fresh.map((c) => (
                <div key={c} style={{ background: '#f6f8fc', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>{c}</div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button variant="outline" size="sm" onClick={copyAllCodes}>{rcCopied ? 'Copied ✓' : 'Copy all'}</Button>
              <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={savedAck} onChange={(e) => setSavedAck(e.target.checked)} /> I saved them somewhere safe
              </label>
              <Button size="sm" disabled={!savedAck} onClick={() => { setFresh(null); setSavedAck(false); }}>Done</Button>
            </div>
          </motion.div>
        ) : (
          <>
            {rcodes.length > 0 && (
              <div style={{ margin: '10px 0' }}>
                {rcodes.map((r) => (
                  <span key={r.id} className="chip" style={r.used ? { opacity: 0.55 } : undefined}>
                    {r.used ? '✓ used' : '○ live'} · {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <Button disabled={rcBusy} onClick={generateCodes}>{rcBusy ? 'Working…' : rcodes.length ? 'Generate new set (revokes old)' : 'Generate backup codes'}</Button>
              {rcodes.length > 0 && <Button variant="ghost" onClick={revokeCodes}>Revoke all</Button>}
            </div>
          </>
        )}
        {rcMsg && <div className="err" style={{ marginTop: 12 }}>{rcMsg}</div>}
      </Card>

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
      
    </div>
  );
}
