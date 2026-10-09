import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  calcConsistency,
  calcStats,
  countChars,
  deleteTypingTest,
  genWords,
  listTypingTests,
  newId,
  saveTypingTest,
  typingCloudStatus,
  CONCENTRIX_PASSAGES,
  type TypingMode,
  type TypingTest,
} from '../lib/typing';
import { useSession } from '../stores/session';
import { useUi } from '../stores/ui';
import { useConfirm } from '../ui/alert-dialog';
import { bumpQuota, quotaStatus } from '../lib/usage';
import '../typing.css';

const TIME_OPTS = [15, 30, 60];
const WORD_OPTS = [10, 25, 50];

type Phase = 'idle' | 'running' | 'done';

export default function Typing() {
  const userId = useSession((s) => s.userId);
  const tier = useSession((s) => s.profile?.tier ?? 'free');
  const email = useSession((s) => s.email);
  const profile = useSession((s) => s.profile);
  const ask = useConfirm();

  const [mode, setMode] = useState<TypingMode>('time');
  const [amount, setAmount] = useState(30);
  const [words, setWords] = useState<string[]>(() => genWords('time', 30));
  const [wordIdx, setWordIdx] = useState(0);
  const [current, setCurrent] = useState('');
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<TypingTest | null>(null);
  const [history, setHistory] = useState<TypingTest[]>([]);
  const [focused, setFocused] = useState(true);
  const [cloudOk, setCloudOk] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState('');
  const [leftT, setLeftT] = useState<number | null>(null);

  const boxRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(0);
  const keysRef = useRef(0);
  const samplesRef = useRef<number[]>([]);
  const savedRef = useRef(false);
  const doneRef = useRef(false);
  const finishRef = useRef((_e: number) => {});
  const setLeaveGuard = useUi((s) => s.setLeaveGuard);

  const owner = userId || 'guest';

  const load = useCallback(() => {
    listTypingTests(userId).then(setHistory);
  }, [userId]);

  /** Free-tier gate: checked before effort starts, never after. */
  async function refreshTypingQuota(): Promise<boolean> {
    if (!userId) {
      setBlocked('');
      setLeftT(null);
      return true;
    }
    try {
      const q = await quotaStatus('typing', userId, tier);
      setLeftT(q.offline ? null : q.remaining);
      if (!q.allowed && !q.offline) {
        setBlocked(`Free plan: ${q.limit} typing tests per day — back tomorrow. Your history stays available.`);
        return false;
      }
      setBlocked('');
      return true;
    } catch {
      return true;
    }
  }

  useEffect(() => {
    load();
    refreshTypingQuota();
    typingCloudStatus().then(setCloudOk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const counts = useMemo(
    () => countChars(words, submitted, wordIdx, current),
    [words, submitted, wordIdx, current]
  );
  const minutes = Math.max(elapsed, 0.5) / 60;
  const liveWpm = Math.round(counts.correct / 5 / minutes);
  const liveAcc = (() => {
    const t = counts.correct + counts.incorrect + counts.extra;
    return t === 0 ? 100 : Math.round((counts.correct / t) * 100);
  })();
  const remain = mode === 'time' ? Math.max(0, Math.ceil(amount - elapsed)) : undefined;

  const finish = useCallback(
    (finalElapsed: number) => {
      if (doneRef.current) return;
      doneRef.current = true;
      const c = countChars(words, submitted, wordIdx, current);
      const stats = calcStats(c, keysRef.current, finalElapsed);
      const consistency = calcConsistency(samplesRef.current);
      const t: TypingTest = {
        id: `${Date.now().toString(36)}${newId()}`,
        userId: owner,
        createdAt: Date.now(),
        mode,
        amount,
        durationSec: Math.round(finalElapsed * 10) / 10,
        wpm: stats.wpm,
        raw: stats.raw,
        acc: stats.acc,
        consistency,
        correct: stats.correct,
        incorrect: stats.incorrect,
        extra: stats.extra,
        missed: stats.missed,
      };
      setResult(t);
      setPhase('done');
      if (!savedRef.current) {
        savedRef.current = true;
        saveTypingTest(t).then(load).catch(() => load());
        if (userId) {
          bumpQuota('typing', userId)
            .then(() => refreshTypingQuota())
            .catch(() => {});
        }
      }
    },
    [words, submitted, wordIdx, current, mode, amount, owner, load]
  );

  // Leaving mid-test submits it: typed words stand, the rest count as missed,
  // and the finish path saves + counts the quota. doneRef keeps it once-only.
  finishRef.current = finish;
  useEffect(() => {
    if (phase !== 'running') {
      setLeaveGuard(null);
      return;
    }
    setLeaveGuard({
      confirmLeave: () => finishRef.current(Math.max(0, (Date.now() - startRef.current) / 1000)),
    });
    return () => setLeaveGuard(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, setLeaveGuard]);

  // ticking clock + end-of-time + per-tick samples
  useEffect(() => {
    if (phase !== 'running') return;
    const t = window.setInterval(() => {
      const e = (Date.now() - startRef.current) / 1000;
      setElapsed(e);
      const c = countChars(words, submitted, wordIdx, current);
      const mins = Math.max(e, 0.5) / 60;
      samplesRef.current.push(c.correct / 5 / mins);
      if (mode === 'time' && e >= amount) finish(e);
    }, 250);
    return () => window.clearInterval(t);
  }, [phase, mode, amount, words, submitted, wordIdx, current, finish]);

  // keep the active word visible
  useEffect(() => {
    boxRef.current?.querySelector(`[data-w="${wordIdx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [wordIdx]);

  async function restart(nextMode: TypingMode = mode, nextAmount: number = amount) {
    if (!(await refreshTypingQuota())) return;
    setMode(nextMode);
    setAmount(nextAmount);
    setWords(genWords(nextMode, nextAmount));
    setWordIdx(0);
    setCurrent('');
    setSubmitted([]);
    setPhase('idle');
    setElapsed(0);
    setResult(null);
    keysRef.current = 0;
    samplesRef.current = [];
    savedRef.current = false;
    doneRef.current = false;
    requestAnimationFrame(() => boxRef.current?.focus());
  }

  function begin() {
    if (phase !== 'idle') return;
    void refreshTypingQuota().then((ok) => {
      if (!ok || phase !== 'idle') return;
      startRef.current = Date.now();
      setPhase('running');
    });
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      restart();
      return;
    }
    if (blocked) return;
    if (phase === 'done') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const word = words[wordIdx];
    if (!word) return;

    if (e.key === 'Backspace') {
      if (current.length > 0) {
        setCurrent(current.slice(0, -1));
      } else if (wordIdx > 0) {
        const prev = submitted[wordIdx - 1] || '';
        setSubmitted((s) => s.slice(0, -1));
        setWordIdx(wordIdx - 1);
        setCurrent(prev);
      }
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (current.length === 0) return; // no skipping words
      begin();
      const next = [...submitted];
      next[wordIdx] = current;
      setSubmitted(next);
      if (mode === 'words' && wordIdx === words.length - 1) {
        setWordIdx(wordIdx + 1);
        setCurrent('');
        finish((Date.now() - startRef.current) / 1000);
        return;
      }
      setWordIdx(wordIdx + 1);
      setCurrent('');
      return;
    }

    if (/^[a-z]$/i.test(e.key)) {
      e.preventDefault();
      if (current.length >= word.length + 10) return;
      begin();
      keysRef.current += 1;
      const next = current + e.key.toLowerCase();
      setCurrent(next);
      if (mode === 'words' && wordIdx === words.length - 1 && next.length >= word.length) {
        const all = [...submitted];
        all[wordIdx] = next;
        setSubmitted(all);
        finish((Date.now() - startRef.current) / 1000);
      }
    }
  }

  function renderWord(w: string, i: number) {
    const isCurrent = i === wordIdx;
    const isDone = i < wordIdx;
    let cls = 't-word todo';
    if (isDone) cls = 't-word done';
    else if (isCurrent) cls = 't-word current';
    const typed = isDone ? submitted[i] || '' : isCurrent ? current : '';
    const chars: React.ReactNode[] = [];
    const caretAt = isCurrent ? Math.min(current.length, w.length + (current.length > w.length ? 0 : 0)) : -1;
    const showLen = isDone || isCurrent ? Math.max(w.length, typed.length) : w.length;
    for (let j = 0; j < showLen; j++) {
      const a = w[j];
      const b = typed[j];
      let c = 't-char todo';
      if (isDone || isCurrent) {
        if (a === undefined) c = 't-char extra';
        else if (b === undefined) c = 't-char todo';
        else c = a === b ? 't-char ok' : 't-char bad';
      }
      if (j === caretAt) chars.push(<span key={`c${j}`} className="t-caret" />);
      chars.push(<span key={j} className={c}>{a === undefined ? b : a}</span>);
    }
    if (isCurrent && caretAt >= showLen) chars.push(<span key="cend" className="t-caret" />);
    return (
      <span key={i} data-w={i} className={cls}>
        {chars}
      </span>
    );
  }

  const best = history.length ? Math.max(...history.map((h) => h.wpm)) : null;
  const avg = history.length ? Math.round(history.reduce((a, h) => a + h.wpm, 0) / history.length) : null;

  return (
    <div>
      <div className="page-hero">
        <h2>Typing arena</h2>
        <p>Concentrix typing rounds reward clean speed. Timer starts on your first key — Tab restarts anytime.</p>
      </div>

      <div className="type-config">
        <button className={`radio-pill ${mode === 'time' ? 'active' : ''}`} onClick={() => restart('time', 30)}>⏱ time</button>
        <button className={`radio-pill ${mode === 'words' ? 'active' : ''}`} onClick={() => restart('words', 25)}>ƒ words</button>
        <button className={`radio-pill ${mode === 'passage' ? 'active' : ''}`} onClick={() => restart('passage', 0)}>📄 Concentrix passages</button>
        <span className="sep" />
        {mode === 'passage' ? (
          CONCENTRIX_PASSAGES.map((p, i) => (
            <button key={p.id} className={`radio-pill ${amount === i ? 'active' : ''}`} onClick={() => restart('passage', i)} title={p.description}>
              Passage {i + 1}
            </button>
          ))
        ) : (
          (mode === 'time' ? TIME_OPTS : WORD_OPTS).map((a) => (
            <button key={a} className={`radio-pill ${amount === a ? 'active' : ''}`} onClick={() => restart(mode, a)}>
              {a}{mode === 'time' ? 's' : ''}
            </button>
          ))
        )}
        <span className="sep" />
        <button className="radio-pill" onClick={() => restart()}>↻ restart (tab)</button>
        {leftT !== null && <span className="hint">{tier === 'pro' ? 'Pro plan: unlimited tests.' : `${leftT} of 10 tests left today`}</span>}
      </div>
      {mode === 'passage' && (
        <div style={{ margin: '8px 0', fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>
          📝 {CONCENTRIX_PASSAGES[amount]?.title} — <span style={{ color: '#64748b', fontWeight: 400 }}>{CONCENTRIX_PASSAGES[amount]?.description}</span>
        </div>
      )}
      {blocked && <div className="err" style={{ marginBottom: 10 }}>{blocked}</div>}

      {phase !== 'done' ? (
        <>
          <div className="t-live">
            <div><span className="v">{mode === 'time' ? remain : `${Math.min(wordIdx + (current ? 1 : 0), words.length)}/${words.length}`}</span><span className="l">{mode === 'time' ? 'seconds left' : 'words'}</span></div>
            <div><span className="v">{phase === 'idle' ? 0 : liveWpm}</span><span className="l">wpm live</span></div>
            <div><span className="v">{liveAcc}%</span><span className="l">accuracy</span></div>
          </div>
          <div
            className="t-stage"
            ref={boxRef}
            tabIndex={0}
            onKeyDown={onKey}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onClick={() => boxRef.current?.focus()}
          >
            <div className="t-words">{words.map(renderWord)}</div>
            {!focused && (
              <div className="t-focus" onClick={() => boxRef.current?.focus()}>
                👆 Click here to focus and start typing
              </div>
            )}
          </div>
          <p className="hint">Timer starts on first key • backspace works across words • extra letters count against accuracy</p>
        </>
      ) : (
        result && (
          <>
            <div className="t-results">
              <div className="t-stat hero"><b>{result.wpm}</b><span>wpm</span></div>
              <div className="t-stat"><b>{result.acc}%</b><span>accuracy</span></div>
              <div className="t-stat"><b>{result.raw}</b><span>raw wpm</span></div>
              <div className="t-stat"><b>{result.consistency}%</b><span>consistency</span></div>
            </div>
            <div className="card" style={{ marginBottom: 12 }}>
              <b>Characters:</b>{' '}
              <span className="chip green">{result.correct} correct</span>{' '}
              <span className="chip red">{result.incorrect} wrong</span>{' '}
              <span className="chip amber">{result.extra} extra</span>{' '}
              <span className="chip">{result.missed} missed</span>{' '}
              <span className="hint">• {result.mode === 'time' ? `${result.amount}s test` : `${result.amount} words`} in {result.durationSec}s • saved ✓</span>
              <div className="btnrow">
                <button className="btn-big" onClick={() => restart()}>Next test →</button>
              </div>
            </div>
          </>
        )
      )}

      <h3>Your tests {history.length > 0 && <span className="hint">• best {best} wpm • avg {avg} wpm • {history.length} saved</span>}</h3>
      {history.length === 0 && <p className="hint">No tests yet — finish one above and it lands here automatically.</p>}
      {history.map((h) => (
        <div className="t-row" key={h.id}>
          <div className="ring" style={{ '--p': Math.min(100, h.wpm) } as any}><span>{h.wpm}</span></div>
          <div className="meta">
            <div style={{ fontWeight: 700 }}>
              {h.wpm} wpm • {h.acc}% acc • {h.consistency}% cons {best !== null && h.wpm === best && <span className="t-crown">👑 best</span>}
            </div>
            <div className="hint">
              {new Date(h.createdAt).toLocaleString()} • {h.mode === 'time' ? `⏱${h.amount}s` : `${h.amount}w`} • raw {h.raw} • {h.correct}✓ {h.incorrect}✗ {h.extra}+ {h.missed}−
            </div>
          </div>
          <div className="btnrow" style={{ marginTop: 0 }}>
            <button className="btn-ghost" onClick={async () => {
              const ok = await ask({
                title: 'Delete this typing test?',
                description: 'It will be removed here and in the cloud. This cannot be undone.',
                actionLabel: 'Delete',
                danger: true,
              });
              if (ok) {
                await deleteTypingTest(h);
                load();
              }
            }}>Delete</button>
          </div>
        </div>
      ))}
      <p className="hint">
        Signed in as {profile?.username || email || 'you'} — tests save in this browser
        {cloudOk === true ? ' and in your cloud account ✓' : cloudOk === false ? ' — cloud backup will switch on automatically when available' : '…'}
        .
      </p>
    </div>
  );
}
