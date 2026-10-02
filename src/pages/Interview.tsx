import { useEffect, useRef, useState } from 'react';
import { VoicePlayer } from '../components/VoicePlayer';
import { useConfirm } from '../ui/alert-dialog';
import { speak, ttsConfigured } from '../lib/tts';
import {
  MOCK_TEST_01,
  deleteMockSession,
  listMockSessions,
  saveMockSession,
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

/* ---------------- audio played exactly once (exam rule) ---------------- */
function OnceAudio({ text, label, onPlayed }: { text: string; label: string; onPlayed?: () => void }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'done'>('idle');
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function play() {
    setError('');
    setState('loading');
    try {
      const url = await speak(text);
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

function SectionHead({ n, title, rule }: { n: string; title: string; rule: string }) {
  return (
    <div style={{ margin: '26px 0 10px' }}>
      <span className="topic">{n}</span>
      <h3 style={{ margin: '6px 0 4px' }}>{title}</h3>
      <p className="hint" style={{ margin: 0 }}>{rule}</p>
    </div>
  );
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
    <div className="svar-card">
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

export default function Interview() {
  const ask = useConfirm();
  const [t0] = useState(() => Date.now());
  const [answers, setAnswers] = useState(0);
  const [history, setHistory] = useState<MockSession[]>(() => listMockSessions());
  const [playedCtx, setPlayedCtx] = useState<Record<string, boolean>>({});
  const [showKeys, setShowKeys] = useState(false);

  const bump = () => setAnswers((a) => a + 1);
  const heard = (id: string) => setPlayedCtx((p) => ({ ...p, [id]: true }));

  function saveSession() {
    const s: MockSession = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(),
      answers,
      durationSec: Math.round((Date.now() - t0) / 1000),
    };
    setHistory(saveMockSession(s));
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

      <SectionHead n="Part A • Short answers" title="Listen once, answer in ONE sentence" rule="Scenario plays once • 15 seconds per answer • base answers only on what you heard." />
      {T.part_a.map((s) => (
        <div className="svar-card" key={s.id}>
          <span className="topic">Scenario</span>
          <OnceAudio text={s.context} label="Play scenario" onPlayed={() => heard('a' + s.id)} />
          {s.questions.map((qq, qi) => (
            <div key={qi} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
              <div style={{ fontWeight: 600 }}>Q{qi + 1}. {qq.q}</div>
              <TimedRecorder seconds={15} armed={!!playedCtx['a' + s.id]} onDone={(u) => u && bump()} />
            </div>
          ))}
        </div>
      ))}

      <SectionHead n="Part B • Situations" title="Workplace comprehension, spoken back" rule="Detailed scenario, played once • answer each factual question in a full coherent sentence • 15 seconds each." />
      {T.part_b.map((s) => (
        <div className="svar-card" key={s.id}>
          <span className="topic">Situation</span>
          <OnceAudio text={s.context} label="Play situation" onPlayed={() => heard('b' + s.id)} />
          {s.questions.map((qq, qi) => (
            <div key={qi} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
              <div style={{ fontWeight: 600 }}>Q{qi + 1}. {qq.q}</div>
              <TimedRecorder seconds={15} armed={!!playedCtx['b' + s.id]} onDone={(u) => u && bump()} />
            </div>
          ))}
        </div>
      ))}

      <SectionHead n="Part C • Read aloud" title="Fluency on screen" rule="Sentences shown one by one • read each aloud clearly and naturally • 12 seconds each." />
      {T.part_c.map((r) => (
        <div className="svar-card" key={r.id}>
          <div className="svar-sentence">“{r.text}”</div>
          <div className="svar-tip"><b>Coach tip:</b> {r.tip}</div>
          <TimedRecorder seconds={12} armed onDone={(u) => u && bump()} />
        </div>
      ))}

      <SectionHead n="Part D • Repeat" title="Listen once, repeat verbatim" rule="No text on screen • audio plays once • repeat exactly, pronunciation + intonation • 12 seconds." />
      {T.part_d.map((r) => (
        <div className="svar-card" key={r.id}>
          <OnceAudio text={r.text} label="Play sentence" onPlayed={() => heard('d' + r.id)} />
          <TimedRecorder seconds={12} armed={!!playedCtx['d' + r.id]} onDone={(u) => u && bump()} />
        </div>
      ))}

      <SectionHead n="Part E • Extempore" title="Think, then hold the floor" rule="30 seconds to prepare, then 60 seconds of fluent speaking. Opening, two points, closing line." />
      {T.part_e.map((e) => (
        <Extempore key={e.id} item={e} onDone={bump} />
      ))}

      <SectionHead n="Part F • Fill the blank" title="Hear the dash, say the whole line" rule="Audio contains a missing word (“dash”) • identify it, then speak the ENTIRE complete sentence • 15 seconds." />
      {T.part_f.map((f) => (
        <div className="svar-card" key={f.id}>
          <OnceAudio text={f.audio} label="Play sentence" onPlayed={() => heard('f' + f.id)} />
          <TimedRecorder seconds={15} armed={!!playedCtx['f' + f.id]} onDone={(u) => u && bump()} />
        </div>
      ))}

      <SectionHead n="Part G • Fix the error" title="Catch it, correct it, say it" rule="One grammar mistake per sentence • speak the ENTIRE corrected sentence • 15 seconds." />
      {T.part_g.map((g) => (
        <div className="svar-card" key={g.id}>
          <OnceAudio text={g.audio} label="Play sentence" onPlayed={() => heard('g' + g.id)} />
          <TimedRecorder seconds={15} armed={!!playedCtx['g' + g.id]} onDone={(u) => u && bump()} />
        </div>
      ))}

      <div className="card" style={{ marginTop: 18, textAlign: 'center' }}>
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

      <h3>Past sessions {history.length > 0 && <span className="hint">• {history.length} saved</span>}</h3>
      {history.length === 0 && <p className="hint">No sessions yet — finish one above and it lands here.</p>}
      {history.map((h) => (
        <div className="t-row" key={h.id}>
          <div className="ring" style={{ '--p': Math.min(100, h.answers * 4) } as any}><span>{h.answers}</span></div>
          <div className="meta">
            <div style={{ fontWeight: 700 }}>{h.answers} answers • {Math.floor(h.durationSec / 60)}m {h.durationSec % 60}s run</div>
            <div className="hint">{new Date(h.at).toLocaleString()} • {MOCK_TEST_01.test_id}</div>
          </div>
          <div className="btnrow" style={{ marginTop: 0 }}>
            <button className="btn-ghost" onClick={() => remove(h.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
