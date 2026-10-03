import { useEffect, useMemo, useRef, useState } from 'react';
import { VoicePlayer } from '../components/VoicePlayer';
import { useConfirm } from '../ui/alert-dialog';
import { speak, ttsConfigured } from '../lib/tts';
import { useSession } from '../stores/session';
import {
  MOCK_TEST_01,
  deleteMockSession,
  fetchTodayRun,
  getLastCompletion,
  listMockSessions,
  recordRun,
  saveMockSession,
  todayKey,
  type MockSession,
  type PartEItem,
} from '../data/mockInterview';
import '../svar.css';

const T = MOCK_TEST_01.sections;

/* ---------------- countdown ---------------- */
function useCountdown(seconds: number, active: boolean, onDone?: () => void) {
  const [left, setLeft] = useState(seconds);
  const cb = useRef(onDone);
  cb.current = onDone;
  useEffect(() => {
    if (!active) return;
    setLeft(seconds);
    const end = Date.now() + seconds * 1000;
    const t = window.setInterval(() => {
      const l = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) {
        window.clearInterval(t);
        cb.current?.();
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [active, seconds]);
  return left;
}

/* ---------------- audio played exactly once (exam rule, HIGH voice) ---------------- */
function OnceAudio({ text, label, onPlayed }: { text: string; label: string; onPlayed?: () => void }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'done'>('idle');
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function play() {
    setError('');
    setState('loading');
    try {
      const url = await speak(text, { voice: 'high' });
      const a = new Audio(url);
      audioRef.current = a;
      setState('playing');
      a.onended = () => {
        setState('done');
        onPlayed?.();
      };
      await a.play();
    } catch (e: any) {
      setState('idle');
      setError(e?.message || 'Voice error');
    }
  }

  useEffect(
    () => () => {
      try {
        audioRef.current?.pause();
      } catch {
        /* ignore */
      }
    },
    []
  );

  return (
    <span className="svar-audio" style={{ margin: 0 }}>
      <button className="btn-primary" disabled={state !== 'idle'} onClick={play}>
        {state === 'idle' && `▶ ${label} — play once`}
        {state === 'loading' && 'Loading voice…'}
        {state === 'playing' && '🔊 Playing… listen carefully'}
        {state === 'done' && '✅ Played — answer from memory'}
      </button>
      {error && <span className="err">{error}</span>}
    </span>
  );
}

/* ---------------- timed recorder: manual start, auto-stop at 0 ---------------- */
function TimedRecorder({ seconds, armed, hint, onDone }: { seconds: number; armed: boolean; hint?: string; onDone: (url: string | null) => void }) {
  const [phase, setPhase] = useState<'idle' | 'rec' | 'done'>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const recRef = useRef<{ stop: () => void } | null>(null);
  const doneRef = useRef(false);
  const cb = useRef(onDone);
  cb.current = onDone;

  const finish = (u: string | null) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (u) setUrl(u);
    setPhase('done');
    cb.current(u);
  };

  async function start() {
    setError('');
    try {
      if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
        setError('Recording isn’t supported in this browser — try Chrome on Android or desktop.');
        finish(null);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        finish(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })));
      };
      recRef.current = {
        stop: () => {
          if (rec.state !== 'inactive') rec.stop();
        },
      };
      rec.start();
      setPhase('rec');
    } catch {
      setError('Microphone blocked — allow mic access and retry.');
      finish(null);
    }
  }

  const left = useCountdown(seconds, phase === 'rec', () => recRef.current?.stop());

  useEffect(
    () => () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    },
    []
  );

  function retry() {
    doneRef.current = false;
    setUrl(null);
    setPhase('idle');
  }

  return (
    <div>
      {phase === 'idle' && (
        <div className="btnrow" style={{ marginTop: 8 }}>
          <button className="btn-ghost" disabled={!armed} onClick={start}>
            🎙 Start answering ({seconds}s){armed ? '' : ' — play the audio first'}
          </button>
        </div>
      )}
      {phase === 'rec' && (
        <div className="svar-audio">
          <span className="mock-timer low">⏱ {left}s</span>
          <button className="btn-ghost" onClick={() => recRef.current?.stop()}>Stop early</button>
        </div>
      )}
      {phase === 'done' && url && (
        <>
          <VoicePlayer src={url} />
          <div className="btnrow">
            <button className="btn-ghost" onClick={retry}>↻ Re-record</button>
          </div>
        </>
      )}
      {error && <div className="err">{error}</div>}
      {hint && phase === 'idle' && <p className="hint">{hint}</p>}
    </div>
  );
}

function TtsGate() {
  if (ttsConfigured()) return null;
  return (
    <div className="banner warn" style={{ marginBottom: 12 }}>
      Voice server not configured — add <b>VITE_TTS_URL</b> (+ <b>VITE_TTS_TOKEN</b>) to .env and rebuild. This whole interview needs audio.
    </div>
  );
}

/* ---------------- step model: exactly one screen per item ---------------- */
type Step =
  | { kind: 'scenario'; part: 'A' | 'B'; sid: string; context: string }
  | { kind: 'qa'; part: 'A' | 'B'; sid: string; qi: number; q: string; expected: string }
  | { kind: 'read'; id: string; text: string; tip: string }
  | { kind: 'repeat'; id: string; text: string }
  | { kind: 'extempore'; item: PartEItem }
  | { kind: 'cloze'; id: string; audio: string; missing: string[]; full: string }
  | { kind: 'correct'; id: string; audio: string; corrected: string; rule: string }
  | { kind: 'finish' };

const PART_LABEL: Record<string, string> = {
  A: 'Part A • Short answers',
  B: 'Part B • Situations',
  C: 'Part C • Read aloud',
  D: 'Part D • Repeat',
  E: 'Part E • Extempore',
  F: 'Part F • Fill the blank',
  G: 'Part G • Fix the error',
  finish: 'Review & finish',
};

function stepPart(s: Step): string {
  if (s.kind === 'scenario' || s.kind === 'qa') return s.part;
  if (s.kind === 'read') return 'C';
  if (s.kind === 'repeat') return 'D';
  if (s.kind === 'extempore') return 'E';
  if (s.kind === 'cloze') return 'F';
  if (s.kind === 'correct') return 'G';
  return 'finish';
}

function buildSteps(): Step[] {
  const steps: Step[] = [];
  (['a', 'b'] as const).forEach((ab) => {
    const part = ab.toUpperCase() as 'A' | 'B';
    (ab === 'a' ? T.part_a : T.part_b).forEach((s) => {
      steps.push({ kind: 'scenario', part, sid: s.id, context: s.context });
      s.questions.forEach((qq, qi) => steps.push({ kind: 'qa', part, sid: s.id, qi, q: qq.q, expected: qq.expected }));
    });
  });
  T.part_c.forEach((r) => steps.push({ kind: 'read', id: r.id, text: r.text, tip: r.tip }));
  T.part_d.forEach((r) => steps.push({ kind: 'repeat', id: r.id, text: r.text }));
  T.part_e.forEach((e) => steps.push({ kind: 'extempore', item: e }));
  T.part_f.forEach((f) => steps.push({ kind: 'cloze', id: f.id, audio: f.audio, missing: f.missing, full: f.full }));
  T.part_g.forEach((g) => steps.push({ kind: 'correct', id: g.id, audio: g.audio, corrected: g.corrected, rule: g.rule }));
  steps.push({ kind: 'finish' });
  return steps;
}

/* ---------------- Part E: prep then speak ---------------- */
function Extempore({ item, onDone }: { item: PartEItem; onDone: () => void }) {
  const [phase, setPhase] = useState<'ready' | 'prep' | 'speak'>('ready');
  const fired = useRef(false);
  const prepLeft = useCountdown(item.prepSec, phase === 'prep', () => setPhase('speak'));

  function done(url: string | null) {
    if (url && !fired.current) {
      fired.current = true;
      onDone();
    }
  }

  return (
    <div>
      <span className="topic">Topic</span>
      <div className="svar-sentence">“{item.topic}”</div>
      {phase === 'ready' && (
        <div className="btnrow">
          <button className="btn-primary" onClick={() => setPhase('prep')}>
            Start {item.prepSec}s preparation →
          </button>
        </div>
      )}
      {phase === 'prep' && (
        <div className="svar-audio">
          <span className="mock-timer">🧠 Think… {prepLeft}s</span>
          <button className="btn-ghost" onClick={() => setPhase('speak')}>Start speaking early</button>
        </div>
      )}
      {phase === 'speak' && (
        <>
          <p className="hint">Speak for up to {item.speakSec} seconds — structure it: opening, two points, closing line.</p>
          <TimedRecorder seconds={item.speakSec} armed onDone={done} />
        </>
      )}
    </div>
  );
}

function untilMidnight(now: number): string {
  const end = new Date();
  end.setHours(24, 0, 0, 0);
  const ms = Math.max(0, end.getTime() - now);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

function HistoryList({ history, remove }: { history: MockSession[]; remove: (id: string) => void }) {
  if (!history.length) return <p className="hint">No sessions yet — finish one above and it lands here.</p>;
  return (
    <>
      {history.map((h) => (
        <div className="t-row" key={h.id}>
          <div className="ring" style={{ '--p': Math.min(100, h.answers * 4) } as any}><span>{h.answers}</span></div>
          <div className="meta">
            <div style={{ fontWeight: 700 }}>{h.answers} answers • {Math.floor(h.durationSec / 60)}m {h.durationSec % 60}s run</div>
            <div className="hint">
              {new Date(h.at).toLocaleString()} • {MOCK_TEST_01.test_id}
              {typeof h.flags === 'number' && h.flags > 0 && <> • ⚠ {h.flags} tab {h.flags === 1 ? 'switch' : 'switches'}</>}
            </div>
          </div>
          <div className="btnrow" style={{ marginTop: 0 }}>
            <button className="btn-ghost" onClick={() => remove(h.id)}>Delete</button>
          </div>
        </div>
      ))}
    </>
  );
}

export default function Interview() {
  const ask = useConfirm();
  const userId = useSession((s) => s.userId);
  const [t0, setT0] = useState(() => Date.now());
  const [answers, setAnswers] = useState(0);
  const [history, setHistory] = useState<MockSession[]>(() => listMockSessions());
  const [playedCtx, setPlayedCtx] = useState<Record<string, boolean>>({});
  const [showKeys, setShowKeys] = useState(false);
  const [locked, setLocked] = useState<boolean | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'running'>('idle');
  const [cam, setCam] = useState<'checking' | 'ok' | 'missing'>('checking');
  const [camTick, setCamTick] = useState(0);
  const flagsRef = useRef(0);
  const dialogOpen = useRef(false);

  const steps = useMemo(buildSteps, []);
  const step = steps[stepIdx];

  const bump = () => setAnswers((a) => a + 1);
  const heard = (id: string) => setPlayedCtx((p) => ({ ...p, [id]: true }));

  // Daily gate: cloud row is truth, local mirror is instant. Paid tiers plug in here later.
  useEffect(() => {
    let live = true;
    (async () => {
      if (getLastCompletion(userId) === todayKey()) {
        if (live) setLocked(true);
        return;
      }
      const cloud = await fetchTodayRun(userId);
      if (live) setLocked(cloud);
    })();
    return () => {
      live = false;
    };
  }, [userId]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Camera presence check while waiting to start (labels need no permission).
  useEffect(() => {
    if (phase !== 'idle' || locked) return;
    let live = true;
    setCam('checking');
    (async () => {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) {
          if (live) setCam('missing');
          return;
        }
        const devs = await navigator.mediaDevices.enumerateDevices();
        if (live) setCam(devs.some((d) => d.kind === 'videoinput') ? 'ok' : 'missing');
      } catch {
        if (live) setCam('missing');
      }
    })();
    return () => {
      live = false;
    };
  }, [phase, locked, camTick]);

  // Monitoring: tab switch + fullscreen exit while running.
  useEffect(() => {
    if (phase !== 'running') return;
    const onVis = () => {
      if (document.hidden) void handleViolationLeave('tab');
    };
    const onFs = () => {
      if (!document.fullscreenElement) void handleViolationLeave('fullscreen');
    };
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('fullscreenchange', onFs);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function startInterview() {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* unsupported/denied — the run still starts monitored */
    }
    flagsRef.current = 0;
    setT0(Date.now());
    setStepIdx(0);
    setAnswers(0);
    setPlayedCtx({});
    setPhase('running');
  }

  async function handleViolationLeave(kind: 'tab' | 'fullscreen') {
    if (dialogOpen.current || phase !== 'running') return;
    dialogOpen.current = true;
    flagsRef.current += 1;
    const ok = await ask({
      title: kind === 'tab' ? 'You left the interview tab' : 'Fullscreen was exited',
      description: 'The screen is monitored during the mock. Cancel this mock test, or resume where you left off? Leaving is recorded on your session.',
      actionLabel: 'Cancel mock test',
      danger: true,
    });
    dialogOpen.current = false;
    if (ok) cancelAttempt();
  }

  function cancelAttempt() {
    setPhase('idle');
    setStepIdx(0);
    setAnswers(0);
    setPlayedCtx({});
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  function saveSession() {
    const durationSec = Math.round((Date.now() - t0) / 1000);
    const s: MockSession = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(),
      answers,
      durationSec,
      flags: flagsRef.current,
    };
    setHistory(saveMockSession(s));
    recordRun(userId, answers, durationSec).catch(() => {});
    setLocked(true);
    setPhase('idle');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  async function remove(id: string) {
    const ok = await ask({
      title: 'Delete this interview session?',
      description: 'Its record will be removed. This cannot be undone.',
      actionLabel: 'Delete',
      danger: true,
    });
    if (ok) setHistory(deleteMockSession(id));
  }

  if (locked === null) {
    return (
      <div>
        <div className="page-hero">
          <h2>Mock interview</h2>
          <p>Checking today’s slot…</p>
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <div>
        <div className="page-hero">
          <h2>Mock interview</h2>
          <p>Seven spoken parts, exam rules: scenario audio plays <b>once</b>, every answer on a timer, full sentences only.</p>
        </div>
        <div className="card" style={{ textAlign: 'center', marginTop: 6 }}>
          <h3 style={{ marginTop: 0 }}>Today’s mock is done ✓</h3>
          <p className="hint">One full interview per day keeps it exam-real. Next unlocks in <b>{untilMidnight(now)}</b>.</p>
          <p className="hint">Paid plans with extra categories are coming — your streak keeps counting meanwhile.</p>
        </div>
        <h3>Past sessions {history.length > 0 && <span className="hint">• {history.length} saved</span>}</h3>
        <HistoryList history={history} remove={remove} />
      </div>
    );
  }

  const part = stepPart(step);

  return (
    <div>
      <div className="page-hero">
        <h2>Mock interview</h2>
        <p>Seven spoken parts, exam rules: scenario audio plays <b>once</b>, every answer on a timer, full sentences only. Total run time ≈ 15 minutes.</p>
        <div style={{ marginTop: 10 }}>
          <span className="chip ghost">🎙 {answers} answers recorded</span>{' '}
          <span className="chip ghost">⏱ 15s answers • 12s drills • 30s + 60s extempore</span>
        </div>
      </div>

      <TtsGate />

      {phase === 'idle' ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 44 }}>🎙️</div>
          <h2 style={{ margin: '12px 0 6px' }}>Ready for your mock interview?</h2>
          <p className="hint">42 screens • all 7 parts • one item at a time • Back works, audio plays once</p>
          <div className="banner warn" style={{ textAlign: 'left', maxWidth: 540, margin: '16px auto' }}>
            <b>⚠ Monitored conditions —</b> your camera must stay connected, this tab stays in focus,
            and the test runs fullscreen. Leaving the tab or exiting fullscreen pauses with a warning:
            cancel the mock, or resume where you left off (leaves are counted on your session).
          </div>
          <div style={{ margin: '12px 0' }}>
            {cam === 'checking' && <span className="hint">Checking camera…</span>}
            {cam === 'ok' && <span className="chip green">📷 Camera connected</span>}
            {cam === 'missing' && (
              <>
                <span className="chip red">📷 No camera found</span>{' '}
                <button className="btn-ghost" onClick={() => setCamTick((t) => t + 1)}>Retry</button>
              </>
            )}
          </div>
          <button className="btn-big" disabled={cam !== 'ok'} onClick={startInterview}>
            Start mock interview →
          </button>
          {cam !== 'ok' && cam !== 'checking' && (
            <p className="hint">Start unlocks once a camera is detected.</p>
          )}
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <b>{PART_LABEL[part]} • item {stepIdx + 1} of {steps.length}</b>
              <span className="hint">{Math.round(((stepIdx + 1) / steps.length) * 100)}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: '#e7ecf5', marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${((stepIdx + 1) / steps.length) * 100}%`, background: 'linear-gradient(90deg,#4d7cfe,#38bdf8)', borderRadius: 999 }} />
            </div>
            <div className="btnrow" style={{ marginBottom: 0 }}>
              <button className="btn-ghost" disabled={stepIdx === 0} onClick={() => setStepIdx((i) => i - 1)}>← Back</button>
              {step.kind !== 'finish' && (
                <button className="btn-primary" onClick={() => setStepIdx((i) => Math.min(i + 1, steps.length - 1))}>Next →</button>
              )}
            </div>
          </div>

          {step.kind === 'scenario' && (
            <div className="svar-card">
              <span className="topic">Scenario — listen once</span>
              <div style={{ marginTop: 8 }}>
                <OnceAudio text={step.context} label="Play scenario" onPlayed={() => heard(step.part.toLowerCase() + step.sid)} />
              </div>
              <p className="hint">Play it once, hold the details in memory — the questions come next, one screen at a time.</p>
            </div>
          )}

          {step.kind === 'qa' && (
            <div className="svar-card">
              <span className="topic">{step.part === 'A' ? 'Short answer' : 'Situation'} • one full sentence</span>
              <div style={{ fontWeight: 700, fontSize: 18, margin: '8px 0 4px' }}>{step.q}</div>
              <TimedRecorder seconds={15} armed={!!playedCtx[step.part.toLowerCase() + step.sid]} onDone={(u) => u && bump()} />
            </div>
          )}

          {step.kind === 'read' && (
            <div className="svar-card">
              <span className="topic">Read aloud</span>
              <div className="svar-sentence">“{step.text}”</div>
              <div className="svar-tip"><b>Coach tip:</b> {step.tip}</div>
              <TimedRecorder seconds={12} armed onDone={(u) => u && bump()} />
            </div>
          )}

          {step.kind === 'repeat' && (
            <div className="svar-card">
              <span className="topic">Listen once, repeat verbatim</span>
              <div style={{ marginTop: 8 }}>
                <OnceAudio text={step.text} label="Play sentence" onPlayed={() => heard('d' + step.id)} />
              </div>
              <TimedRecorder seconds={12} armed={!!playedCtx['d' + step.id]} onDone={(u) => u && bump()} />
            </div>
          )}

          {step.kind === 'extempore' && (
            <div className="svar-card">
              <span className="topic">Extempore — 30s think, 60s speak</span>
              <div style={{ marginTop: 8 }}>
                <Extempore item={step.item} onDone={bump} />
              </div>
            </div>
          )}

          {step.kind === 'cloze' && (
            <div className="svar-card">
              <span className="topic">Fill the blank — say the WHOLE sentence</span>
              <div style={{ marginTop: 8 }}>
                <OnceAudio text={step.audio} label="Play sentence" onPlayed={() => heard('f' + step.id)} />
              </div>
              <TimedRecorder seconds={15} armed={!!playedCtx['f' + step.id]} onDone={(u) => u && bump()} />
            </div>
          )}

          {step.kind === 'correct' && (
            <div className="svar-card">
              <span className="topic">Fix the error — say the WHOLE corrected sentence</span>
              <div style={{ marginTop: 8 }}>
                <OnceAudio text={step.audio} label="Play sentence" onPlayed={() => heard('g' + step.id)} />
              </div>
              <TimedRecorder seconds={15} armed={!!playedCtx['g' + step.id]} onDone={(u) => u && bump()} />
            </div>
          )}

          {step.kind === 'finish' && (
            <div className="card" style={{ textAlign: 'center' }}>
              <h3 style={{ marginTop: 0 }}>Review & finish</h3>
              <p className="hint">{answers} answers recorded. Check the key, then save your session (once per day).</p>
              <div className="btnrow" style={{ justifyContent: 'center' }}>
                <button className="btn-ghost" onClick={() => setShowKeys((s) => !s)}>
                  {showKeys ? 'Hide answer key' : 'Show answer key'}
                </button>
                <button className="btn-big" onClick={saveSession}>Finish & save session ✓</button>
              </div>
              {showKeys && (
                <div style={{ textAlign: 'left', marginTop: 12 }}>
                  {T.part_a.concat(T.part_b).map((s) => (
                    <div key={s.id} style={{ marginBottom: 8 }}>
                      <b className="qnum">{s.id.toUpperCase()}</b>
                      {s.questions.map((qq, i) => (
                        <div key={i} style={{ fontSize: 13.5 }}><b>Q{i + 1}.</b> {qq.q} → <i>{qq.expected}</i></div>
                      ))}
                    </div>
                  ))}
                  {T.part_f.map((f) => (
                    <div key={f.id} style={{ fontSize: 13.5 }}><b className="qnum">{f.id.toUpperCase()}.</b> missing: <b>{f.missing.join(' / ')}</b> → <i>{f.full}</i></div>
                  ))}
                  {T.part_g.map((g) => (
                    <div key={g.id} style={{ fontSize: 13.5 }}><b className="qnum">{g.id.toUpperCase()}.</b> <i>{g.corrected}</i> — {g.rule}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <h3>Past sessions {history.length > 0 && <span className="hint">• {history.length} saved</span>}</h3>
      <HistoryList history={history} remove={remove} />
    </div>
  );
}
