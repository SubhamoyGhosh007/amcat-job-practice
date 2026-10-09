import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useAuthActions } from '../auth/actions';
import { redeemBackupCode, sendRecoveryLink } from '../lib/backupCodes';
import { LoginButtons } from '../components/AuthWidgets';
import { friendlyError } from '../lib/friendly';
import './auth.css';

function friendly(e: any): string {
  const m = String(e?.message || 'Something went wrong. Try again.');
  if (/already registered|already exists|duplicate/i.test(m)) return 'This email is already registered — log in instead.';
  if (/invalid login|invalid credentials|wrong|incorrect/i.test(m)) return 'Wrong email or password. Try again.';
  if (/not confirmed|confirm.*email|verify.*email/i.test(m)) return 'Email not confirmed yet — check your inbox for the link.';
  if (/breach|pwned|common|unsafe|weak|short/i.test(m)) return 'That password is too weak — choose a longer one.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts — wait a minute and retry.';
  return friendlyError(e);
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { loginEmail, verifyMfa, registerEmail, resendConfirm } = useAuthActions();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [stage, setStage] = useState<'form' | 'confirm' | 'mfa'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [code, setCode] = useState('');
  const [recMode, setRecMode] = useState(false);
  const [recCode, setRecCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function goApp() {
    navigate('/app', { replace: true });
  }

  async function submit() {
    setMsg('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setMsg('Enter a valid email address.');
      return;
    }
    if (pw.length < 6) {
      setMsg('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const st = await loginEmail(email.trim(), pw);
        if (st === 'mfa') {
          setStage('mfa');
          setMsg('');
        } else {
          goApp();
        }
      } else {
        const st = await registerEmail(name.trim(), email.trim(), pw);
        if (st === 'confirm') {
          setStage('confirm');
          setMsg(`We emailed a confirmation link to ${email.trim()} — click it, then log in.`);
        } else {
          goApp();
        }
      }
    } catch (e) {
      setMsg(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {    setBusy(true);
    try {
      await resendConfirm(email.trim());
      setMsg('Confirmation email re-sent — check your inbox (and spam).');
    } catch (e) {
      setMsg(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitMfa() {
    setMsg('');
    if (code.trim().length < 6) {
      setMsg('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    try {
      await verifyMfa(code.trim());
      goApp();
    } catch (e) {
      setMsg(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitRecovery() {
    setMsg('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setMsg('Enter your account email first.');
      return;
    }
    if (recCode.replace(/[^A-Za-z0-9]/g, '').length < 8) {
      setMsg('Enter the full backup code (like AB12-CD34).');
      return;
    }
    setBusy(true);
    try {
      const ok = await redeemBackupCode(email.trim(), recCode);
      if (!ok) {
        setMsg('Invalid or already-used code. Each code works once — check for typos.');
        return;
      }
      await sendRecoveryLink(email.trim());
      setMsg('Code accepted — login link sent. Check your inbox (and spam), it expires soon.');
    } catch (e) {
      setMsg(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="au-shell">
        <aside className="au-panel">
          <div className="au-brand">
            <img src="/logo.jpg" alt="Concentrix AMCAT Practice logo" />
            <div>
              <b>AMCAT Practice</b>
              <small>Concentrix hiring prep</small>
            </div>
          </div>
          <h2>Walk in test-ready.<br />Clear your AMCAT drive.</h2>
          <ul className="au-points">
            <li><span className="tick">✓</span> Fresh AI question sets, daily</li>
            <li><span className="tick">✓</span> Answer scripts with explanations + PDFs</li>
            <li><span className="tick">✓</span> Typing, voice and mock interview arenas</li>
          </ul>
          <div className="au-fine">Free forever • No card • Unofficial practice project</div>
        </aside>
        <div className="au-form-col">
          <motion.div
            className="au-card"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          >
            <button className="au-back" onClick={() => navigate('/')}>
              ← Back to home
            </button>
            <AnimatePresence mode="wait">
              <motion.div
                key={stage + mode}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25 }}
              >
                <h1>
                  {stage === 'mfa' ? 'Two-factor check' : stage === 'confirm' ? 'Check your email' : mode === 'login' ? 'Welcome back' : 'Create your account'}
                </h1>
                <p className="au-sub">
                  {stage === 'mfa'
                    ? 'This account has 2FA on — open your authenticator app and enter the 6-digit code.'
                    : stage === 'confirm'
                    ? 'One click in that email activates your account.'
                    : mode === 'login'
                      ? 'Log in to continue your sets, sheets and PDFs.'
                      : 'One account holds every score sheet, on every device.'}
                </p>
              </motion.div>
            </AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, type: 'spring', stiffness: 110, damping: 17 }}
            >
              {stage === 'mfa' ? (
                recMode ? (
                  <>
                    <div className="au-field">
                      <label>Account email</label>
                      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" />
                    </div>
                    <div className="au-field">
                      <label>Backup code (single use)</label>
                      <input value={recCode} onChange={(e) => setRecCode(e.target.value.toUpperCase().slice(0, 9))} placeholder="AB12-CD34" inputMode="text"
                        onKeyDown={(e) => { if (e.key === 'Enter') submitRecovery(); }} />
                    </div>
                    <AnimatePresence>{msg && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <div className="au-err">{msg}</div>
                      </motion.div>
                    )}</AnimatePresence>
                    <motion.button className="au-submit" disabled={busy} onClick={submitRecovery} whileTap={{ scale: 0.98 }}>
                      {busy ? 'Checking…' : 'Send me a login link'}
                    </motion.button>
                    <p className="au-alt" style={{ marginBottom: 0 }}>
                      Found your authenticator?{' '}
                      <button onClick={() => { setRecMode(false); setRecCode(''); setMsg(''); }}>
                        Use a 6-digit code
                      </button>
                    </p>
                  </>
                ) : (
                <>
                  <div className="au-field">
                    <label>6-digit code</label>
                    <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric"
                      onKeyDown={(e) => { if (e.key === 'Enter') submitMfa(); }} />
                  </div>
                  <AnimatePresence>{msg && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <div className="au-err">{msg}</div>
                    </motion.div>
                  )}</AnimatePresence>
                  <motion.button className="au-submit" disabled={busy} onClick={submitMfa} whileTap={{ scale: 0.98 }}>
                    {busy ? 'Verifying…' : 'Verify & log in'}
                  </motion.button>
                  <p className="au-alt" style={{ marginBottom: 0 }}>
                    Lost your authenticator?{' '}
                    <button onClick={() => { setRecMode(true); setMsg(''); }}>
                      Use a backup code
                    </button>
                    {' '}•{' '}
                    <button onClick={() => { setStage('form'); setCode(''); setMsg(''); }}>
                      Back to log in
                    </button>
                  </p>
                </>
                )
              ) : stage === 'confirm' ? (
                <>
                  {msg && <div className="au-err">{msg}</div>}
                  <motion.button className="au-submit" disabled={busy} onClick={resend} whileTap={{ scale: 0.98 }}>
                    {busy ? 'Sending…' : 'Resend confirmation email'}
                  </motion.button>
                  <p className="au-alt" style={{ marginBottom: 0 }}>
                    Confirmed already?{' '}
                    <button onClick={() => { setStage('form'); setMode('login'); setMsg(''); }}>
                      Log in
                    </button>
                  </p>
                </>
              ) : (
                <>
                  <div className="au-tabs">
                    {(['login', 'register'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={mode === m ? 'on' : ''}
                        onClick={() => { setMode(m); setMsg(''); }}
                      >
                        {mode === m && (
                          <motion.span
                            layoutId="auth-tab"
                            className="pill-bg"
                            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                          />
                        )}
                        <span className="lbl">{m === 'login' ? 'Log in' : 'Register'}</span>
                      </button>
                    ))}
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={mode}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                    >
                      {mode === 'register' && (
                        <div className="au-field">
                          <label>Your name</label>
                          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" maxLength={40} />
                        </div>
                      )}
                      <div className="au-field">
                        <label>Email</label>
                        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" />
                      </div>
                      <div className="au-field">
                        <label>Password</label>
                        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Minimum 6 characters"
                          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
                      </div>
                    </motion.div>
                  </AnimatePresence>
                  <AnimatePresence>{msg && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <div className="au-err">{msg}</div>
                    </motion.div>
                  )}</AnimatePresence>
                  <motion.button className="au-submit" disabled={busy} onClick={submit} whileTap={{ scale: 0.98 }}>
                    {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
                  </motion.button>
                  <div className="au-divider">
                    <span>or continue with</span>
                  </div>
                  <LoginButtons column />
                </>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  );
}
