import { useEffect, useRef, useState } from 'react';
import { LISTEN_BANK, READ_BANK, REPEAT_BANK } from '../data/svar';
import { speak, ttsConfigured } from '../lib/tts';
import { bumpQuota, quotaStatus } from '../lib/usage';
import { useSession } from '../stores/session';
import { TTSVoicePlayer as PlayButton, VoicePlayer } from '../components/VoicePlayer';
import '../svar.css';

type Tab = 'listen' | 'read' | 'repeat';

interface SvarStats {
  plays: number;
  records: number;
  done: number;
  lastAt: number;
}

const SKEY = 'amcat_svar';

function readStats(): SvarStats {
  try {
    return { plays: 0, records: 0, done: 0, lastAt: 0, ...JSON.parse(localStorage.getItem(SKEY) || '{}') };
  } catch {
    return { plays: 0, records: 0, done: 0, lastAt: 0 };
  }
}

function bump(patch: Partial<SvarStats>) {
  try {
    const s = readStats();
    localStorage.setItem(SKEY, JSON.stringify({ ...s, ...patch, lastAt: Date.now() }));
  } catch {
    /* ignore */
  }
}

/* PlayButton = reactive TTSVoicePlayer (see components/VoicePlayer) — model audio
   plays through the voice-reactive visualizer, recordings use <VoicePlayer/>. */

/* ---------------- mic recording ---------------- */
function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [secs, setSecs] = useState(0);
  const ref = useRef<{ stop: () => void } | null>(null);

  async function start(maxSec = 90) {
    setError('');
    try {
      if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
        setError('Recording isn’t supported in this browser — try Chrome on Android or desktop.');
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
        setUrl(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })));
        setRecording(false);
      };
      const t0 = Date.now();
      const timer = window.setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 500);
      const stopAll = () => {
        window.clearInterval(timer);
        if (rec.state !== 'inactive') rec.stop();
      };
      window.setTimeout(() => {
        if (rec.state !== 'inactive') stopAll();
      }, maxSec * 1000);
      ref.current = { stop: stopAll };
      setSecs(0);
      rec.start();
      setRecording(true);
    } catch {
      setError('Microphone blocked — allow mic access in the browser and retry.');
    }
  }

  function stop() {
    ref.current?.stop();
  }

  useEffect(
    () => () => {
      try {
        ref.current?.stop();
      } catch {
        /* ignore */
      }
    },
    []
  );

  return { recording, url, secs, error, start, stop };
}

function RecordBlock({ onRecorded }: { onRecorded: () => void }) {
  const r = useRecorder();
  const fired = useRef(false);
  const cb = useRef(onRecorded);
  cb.current = onRecorded;
  useEffect(() => {
    if (r.url && !fired.current) {
      fired.current = true;
      cb.current();
    }
  }, [r.url]);

  return (
    <div>
      <div className="svar-audio">
        {!r.recording ? (
          <button className="btn-ghost" onClick={() => r.start()}>🎙 Start recording</button>
        ) : (
          <button className="btn-ghost" onClick={r.stop}>
            <span className="svar-rec"><span className="live" /> Stop ({r.secs}s)</span>
          </button>
        )}
        {r.url && <VoicePlayer src={r.url} />}
      </div>
      {r.error && <div className="err">{r.error}</div>}
    </div>
  );
}

function TtsGate() {
  if (ttsConfigured()) return null;
  return (
    <div className="banner warn" style={{ marginBottom: 12 }}>
      Voice server not configured — add <b>VITE_TTS_URL</b> (+ <b>VITE_TTS_TOKEN</b>) to .env and rebuild.
      Recording-only practice below still works.
    </div>
  );
}

/* ---------------- tab 1: listen & answer ---------------- */
function ListenTab({ refresh }: { refresh: () => void }) {
  const userId = useSession((s) => s.userId);
  const tier = useSession((s) => s.profile?.tier ?? 'free');
  const [plays, setPlays] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const [subErr, setSubErr] = useState('');

  function played(id: string) {
    setPlays((p) => ({ ...p, [id]: (p[id] || 0) + 1 }));
    bump({ plays: readStats().plays + 1 });
  }

  const score = LISTEN_BANK.filter((q) => picked[q.id] === q.answerIndex).length;

  function submit() {
    setSubErr('');
    void (async () => {
      if (userId) {
        try {
          const q = await quotaStatus('speaking', userId, tier);
          if (!q.allowed && !q.offline) {
            setSubErr(`Free plan: ${q.limit} voice sessions per day — back tomorrow.`);
            return;
          }
        } catch {
          /* grace */
        }
      }
      setDone(true);
      bump({ done: readStats().done + 1 });
      if (userId) bumpQuota('speaking', userId).catch(() => {});
      refresh();
    })();
  }

  return (
    <div>
      <TtsGate />
      {LISTEN_BANK.map((q, i) => {
        const mine = picked[q.id];
        const ok = done && mine === q.answerIndex;
        return (
          <div className="svar-card" key={q.id}>
            <div className="qnum">Q{i + 1} • {plays[q.id] ? `played ${plays[q.id]}×` : 'not played yet'}</div>
            <PlayButton text={q.say} label="Play the audio" onPlayed={() => played(q.id)} />
            <div style={{ fontWeight: 600, marginTop: 8 }}>{q.question}</div>
            {q.options.map((op, oi) => (
              <label key={oi} className={`opt ${mine === oi ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name={q.id}
                  disabled={done}
                  checked={mine === oi}
                  onChange={() => setPicked((p) => ({ ...p, [q.id]: oi }))}
                />
                <span><b>{'ABCD'[oi]}.</b> {op}</span>
              </label>
            ))}
            {done && (
              <div className={`rev ${ok ? 'correct' : 'wrong'}`} style={{ marginTop: 8 }}>
                <div className="qnum">{ok ? '✅ Correct' : '❌ Wrong'} • transcript: “{q.say}”</div>
                <div className="exp"><b>Why:</b> {q.explanation}</div>
              </div>
            )}
          </div>
        );
      })}
      {!done ? (
        <>
          {subErr && <div className="err" style={{ marginBottom: 10 }}>{subErr}</div>}
          <div className="btnrow">
          <button className="btn-big" onClick={submit}>Check answers ✓</button>
        </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          <b style={{ fontSize: 20 }}>You scored {score}/{LISTEN_BANK.length}</b>
          <p className="hint">Transcripts revealed above — replay any audio and shadow the speaker.</p>
          <div className="btnrow" style={{ justifyContent: 'center' }}>
            <button
              className="btn-ghost"
              onClick={() => {
                setPicked({});
                setDone(false);
              }}
            >
              Try again ↻
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- tab 2: read aloud ---------------- */
function ReadTab({ refresh }: { refresh: () => void }) {
  const userId = useSession((s) => s.userId);
  const tier = useSession((s) => s.profile?.tier ?? 'free');
  const [doneIds, setDoneIds] = useState<Record<string, boolean>>({});
  const [qerr, setQerr] = useState('');

  function recorded() {
    bump({ records: readStats().records + 1 });
    refresh();
  }

  function markDone(id: string) {
    if (doneIds[id]) return;
    setQerr('');
    void (async () => {
      if (userId) {
        try {
          const q = await quotaStatus('speaking', userId, tier);
          if (!q.allowed && !q.offline) {
            setQerr(`Free plan: ${q.limit} voice sessions per day — back tomorrow.`);
            return;
          }
        } catch {
          /* grace */
        }
      }
      setDoneIds((d) => ({ ...d, [id]: true }));
      bump({ done: readStats().done + 1 });
      if (userId) bumpQuota('speaking', userId).catch(() => {});
      refresh();
    })();
  }

  return (
    <div>
      {qerr && <div className="err" style={{ marginBottom: 10 }}>{qerr}</div>}
      {READ_BANK.map((r) => (
        <div className="svar-card" key={r.id}>
          <span className="topic">Read aloud {doneIds[r.id] ? '• ✅ practised' : ''}</span>
          <div className="svar-sentence">“{r.text}”</div>
          <div className="svar-tip"><b>Coach tip:</b> {r.tip}</div>
          <RecordBlock onRecorded={recorded} />
          <div className="btnrow">
            <button className="btn-ghost" disabled={doneIds[r.id]} onClick={() => markDone(r.id)}>
              {doneIds[r.id] ? 'Done ✓' : 'Sounds good — mark done'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- tab 3: repeat after me ---------------- */
function RepeatTab({ refresh }: { refresh: () => void }) {
  const userId = useSession((s) => s.userId);
  const tier = useSession((s) => s.profile?.tier ?? 'free');
  const [doneIds, setDoneIds] = useState<Record<string, boolean>>({});
  const [qerr, setQerr] = useState('');

  function played() {
    bump({ plays: readStats().plays + 1 });
  }

  function recorded() {
    bump({ records: readStats().records + 1 });
    refresh();
  }

  function markDone(id: string) {
    if (doneIds[id]) return;
    setQerr('');
    void (async () => {
      if (userId) {
        try {
          const q = await quotaStatus('speaking', userId, tier);
          if (!q.allowed && !q.offline) {
            setQerr(`Free plan: ${q.limit} voice sessions per day — back tomorrow.`);
            return;
          }
        } catch {
          /* grace */
        }
      }
      setDoneIds((d) => ({ ...d, [id]: true }));
      bump({ done: readStats().done + 1 });
      if (userId) bumpQuota('speaking', userId).catch(() => {});
      refresh();
    })();
  }

  return (
    <div>
      <TtsGate />
      {qerr && <div className="err" style={{ marginBottom: 10 }}>{qerr}</div>}
      {REPEAT_BANK.map((r) => (
        <div className="svar-card" key={r.id}>
          <span className="topic">Repeat after me {doneIds[r.id] ? '• ✅ practised' : ''}</span>
          <div className="svar-duo" style={{ marginTop: 10 }}>
            <div className="cell">
              <b>1 · Model</b>
              <PlayButton text={r.text} label="Hear it" onPlayed={played} />
            </div>
            <div className="cell">
              <b>2 · You</b>
              <RecordBlock onRecorded={recorded} />
            </div>
          </div>
          <div className="svar-tip"><b>Coach tip:</b> {r.tip}</div>
          <div className="btnrow">
            <button className="btn-ghost" disabled={doneIds[r.id]} onClick={() => markDone(r.id)}>
              {doneIds[r.id] ? 'Done ✓' : 'Matched it — mark done'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Svar() {
  const userId = useSession((s) => s.userId);
  const tier = useSession((s) => s.profile?.tier ?? 'free');
  const [tab, setTab] = useState<Tab>('listen');
  const [stats, setStats] = useState<SvarStats>(() => readStats());
  const [leftS, setLeftS] = useState<number | null>(null);

  async function refreshQuota() {
    if (!userId) {
      setLeftS(null);
      return;
    }
    try {
      const q = await quotaStatus('speaking', userId, tier);
      setLeftS(q.offline ? null : q.remaining);
    } catch {
      setLeftS(null);
    }
  }

  const refresh = () => {
    setStats(readStats());
    refreshQuota();
  };

  useEffect(() => {
    refreshQuota();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <div>
      <div className="page-hero">
        <h2>Speaking & listening lab</h2>
        <p>SVAR-style practice on your own voice server — listen, read aloud, repeat. Nothing is auto-graded; your ears are the examiner.</p>
        <div style={{ marginTop: 10 }}>
          <span className="chip ghost">🔊 {stats.plays} plays</span>{' '}
          <span className="chip ghost">🎙 {stats.records} recordings</span>{' '}
          <span className="chip ghost">✅ {stats.done} marked done</span>
        </div>
        {leftS !== null && <p className="hint" style={{ marginTop: 8 }}>{tier === 'pro' ? 'Pro plan: unlimited voice sessions.' : <>Free plan: <b>{leftS} of 5</b> voice sessions left today.</>}</p>}
      </div>
      <div className="svar-tabs">
        {(['listen', 'read', 'repeat'] as Tab[]).map((t) => (
          <button key={t} className={`radio-pill ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'listen' ? '👂 Listen & answer' : t === 'read' ? '🗣 Read aloud' : '🔁 Repeat after me'}
          </button>
        ))}
      </div>
      {tab === 'listen' && <ListenTab refresh={refresh} />}
      {tab === 'read' && <ReadTab refresh={refresh} />}
      {tab === 'repeat' && <RepeatTab refresh={refresh} />}
    </div>
  );
}
