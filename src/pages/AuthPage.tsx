import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useAuthActions } from '../auth/actions';
import { LoginButtons } from '../components/AuthWidgets';
import '../landing/landing.css';

function friendly(e: any): string {
  const m = String(e?.message || 'Something went wrong. Try again.');
  if (/already registered|already exists|duplicate/i.test(m)) return 'This email is already registered — log in instead.';
  if (/invalid login|invalid credentials|wrong|incorrect/i.test(m)) return 'Wrong email or password. Try again.';
  if (/not confirmed|confirm.*email|verify.*email/i.test(m)) return 'Email not confirmed yet — check your inbox for the link.';
  if (/breach|pwned|common|unsafe|weak|short/i.test(m)) return 'That password is too weak — choose a longer one.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts — wait a minute and retry.';
  return m.length > 220 ? m.slice(0, 220) + '…' : m;
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

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing">
        <header className="hero" style={{ minHeight: '100vh', overflow: 'hidden' }}>
          <div className="hero-grid" />
          <motion.div
            className="orb"
            style={{ left: '6%', top: '-160px', width: 480, height: 480, background: 'rgba(77,124,254,.28)' }}
            animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="orb"
            style={{ right: '4%', top: '30%', width: 380, height: 380, background: 'rgba(56,189,248,.20)' }}
            animate={{ x: [0, -50, 0], y: [0, 55, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            style={{ position: 'relative', zIndex: 2, maxWidth: 480, margin: '0 auto', padding: '56px 18px' }}
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          >
            <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#9fb0cc', fontSize: 14, cursor: 'pointer', padding: 0 }}>
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
                <h1 className="display" style={{ fontSize: 32, margin: '14px 0 6px' }}>
                  {stage === 'mfa' ? 'Two-factor check' : stage === 'confirm' ? 'Check your email' : mode === 'login' ? 'Welcome back' : 'Create your account'}
                </h1>
                <p style={{ color: '#9fb0cc', fontSize: 14.5, margin: '0 0 20px', lineHeight: 1.6 }}>
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
              className="demo-card"
              style={{ textAlign: 'left' }}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, type: 'spring', stiffness: 110, damping: 17 }}
            >
              {stage === 'mfa' ? (
                <>
                  <div className="field">
                    <label>6-digit code</label>
                    <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric"
                      onKeyDown={(e) => { if (e.key === 'Enter') submitMfa(); }} />
                  </div>
                  <AnimatePresence>{msg && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <div className="err">{msg}</div>
                    </motion.div>
                  )}</AnimatePresence>
                  <div className="btnrow">
                    <motion.button className="btn-primary" style={{ flex: 1 }} disabled={busy} onClick={submitMfa} whileTap={{ scale: 0.98 }}>
                      {busy ? 'Verifying…' : 'Verify & log in'}
                    </motion.button>
                  </div>
                  <p className="hint" style={{ marginBottom: 0 }}>
                    Lost your authenticator?{' '}
                    <button onClick={() => { setStage('form'); setCode(''); setMsg(''); }} style={{ background: 'none', border: 'none', color: '#1b4fa0', cursor: 'pointer', padding: 0, fontSize: 13 }}>
                      Back to log in
                    </button>
                  </p>
                </>
              ) : stage === 'confirm' ? (
                <>
                  {msg && <div className="err">{msg}</div>}
                  <div className="btnrow">
                    <button className="btn-primary" style={{ flex: 1 }} disabled={busy} onClick={resend}>
                      {busy ? 'Sending…' : 'Resend confirmation email'}
                    </button>
                  </div>
                  <p className="hint" style={{ marginBottom: 0 }}>
                    Confirmed already?{' '}
                    <button onClick={() => { setStage('form'); setMode('login'); setMsg(''); }} style={{ background: 'none', border: 'none', color: '#1b4fa0', cursor: 'pointer', padding: 0, fontSize: 13 }}>
                      Log in
                    </button>
                  </p>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, position: 'relative' }}>
                    {(['login', 'register'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setMode(m); setMsg(''); }}
                        style={{
                          flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                          border: 'none', background: 'transparent', color: mode === m ? '#16213a' : '#8a97b3',
                          position: 'relative',
                        }}
                      >
                        {mode === m && (
                          <motion.span
                            layoutId="auth-tab"
                            style={{ position: 'absolute', inset: 0, background: '#eaf0fd', border: '1.5px solid #1b4fa0', borderRadius: 8, zIndex: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                          />
                        )}
                        <span style={{ position: 'relative', zIndex: 1 }}>{m === 'login' ? 'Log in' : 'Register'}</span>
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
                        <div className="field">
                          <label>Your name</label>
                          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" maxLength={40} />
                        </div>
                      )}
                      <div className="field">
                        <label>Email</label>
                        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" />
                      </div>
                      <div className="field">
                        <label>Password</label>
                        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Minimum 6 characters"
                          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
                      </div>
                    </motion.div>
                  </AnimatePresence>
                  <AnimatePresence>{msg && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <div className="err">{msg}</div>
                    </motion.div>
                  )}</AnimatePresence>
                  <div className="btnrow">
                    <motion.button className="btn-primary" style={{ flex: 1 }} disabled={busy} onClick={submit} whileTap={{ scale: 0.98 }}>
                      {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
                    </motion.button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 10px' }}>
                    <div style={{ flex: 1, height: 1, background: '#dfe6f2' }} />
                    <span className="hint">or continue with</span>
                    <div style={{ flex: 1, height: 1, background: '#dfe6f2' }} />
                  </div>
                  <LoginButtons column />
                </>
              )}
            </motion.div>
          </motion.div>
        </header>
      </div>
    </MotionConfig>
  );
}
