import { useEffect, useRef, useState } from 'react';
import { LISTEN_BANK, READ_BANK, REPEAT_BANK } from '../data/svar';
import { ttsConfigured } from '../lib/tts';
import { bumpQuota, quotaStatus } from '../lib/usage';
import {
  saveReview,
  scoreAttempt,
  transcribeAudio,
  type SpeechReview,
} from '../lib/speechReview';
import {
  SPEAK_LIMITS,
  deleteSpeakingReport,
  listSpeakingReports,
  saveSpeakingReport,
  speakingReportFromItems,
  type SpeakingReport,
} from '../lib/speakingStore';
import { fetchUnattemptedSamples, publishSamples, recordSampleCompletions } from '../lib/voicePool';
import { generateVoiceBatch } from '../lib/voiceGen';
import { downloadSpeakingReport } from '../lib/pdf';
import { useSession } from '../stores/session';
import { useUi } from '../stores/ui';
import { useConfirm } from '../ui/alert-dialog';
import { TTSVoicePlayer as PlayButton, VoicePlayer } from '../components/VoicePlayer';
import '../svar.css';

type Tab = 'listen' | 'session';

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

/* ---------------- mic recording ---------------- */
function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
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
        const b = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        setBlob(b);
        setUrl(URL.createObjectURL(b));
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

  function reset() {
    try {
      ref.current?.stop();
    } catch {
      /* ignore */
    }
    setUrl(null);
    setBlob(null);
    setSecs(0);
    setError('');
    setRecording(false);
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

  return { recording, url, blob, secs, error, start, stop, reset };
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

/* ---------------- tab 1: listen & answer (standalone practice) ---------------- */
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

/* ---------------- review card (per scored item) ---------------- */
function ReviewCard({ review }: { review: SpeechReview }) {
  const bar = (v: number) => (
    <span
      style={{
        display: 'inline-block',
        width: 90,
        height: 8,
        borderRadius: 99,
        background: '#e7ecf5',
        overflow: 'hidden',
        verticalAlign: 'middle',
      }}
    >
      <span
        style={{
          display: 'block',
          height: '100%',
          width: `${v}%`,
          background: v >= 70 ? '#1e9e62' : v >= 45 ? '#f5a623' : '#d64545',
          borderRadius: 99,
        }}
      />
    </span>
  );
  return (
    <div className="rev correct" style={{ marginTop: 10 }}>
      <div className="qnum">
        ⭐ {review.marks}/10 • clarity {review.accuracy}% • coverage {review.completeness}% • pace {review.wpm} wpm
      </div>
      <div style={{ fontSize: 13.5, margin: '6px 0' }}>
        <div>Clarity {bar(review.accuracy)} {review.accuracy}%</div>
        <div>Coverage {bar(review.completeness)} {review.completeness}%</div>
        <div>Fluency {bar(review.fluency)} {review.fluency}%</div>
      </div>
      <div className="exp" style={{ overflowWrap: 'anywhere' }}>
        <b>Heard:</b> “{review.transcript}”
      </div>
      <div style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.9, display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: '100%' }}>
        {review.words.map((w, i) => (
          <span
            key={i}
            title={w.status === 'correct' ? 'heard right' : w.status === 'substituted' ? `heard as “${w.heard}”` : 'skipped'}
            style={{
              padding: '1px 5px',
              borderRadius: 6,
              overflowWrap: 'anywhere',
              background: w.status === 'correct' ? '#e9f7ef' : w.status === 'substituted' ? '#fef4e2' : '#fdeeee',
              borderBottom: w.status === 'correct' ? 'none' : `2px solid ${w.status === 'substituted' ? '#f5a623' : '#d64545'}`,
            }}
          >
            {w.expected}
          </span>
        ))}
      </div>
      <div className="exp" style={{ marginTop: 6 }}>
        <b>Areas to improve:</b>
        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
          {review.improvements.map((im, i) => (
            <li key={i}>{im}</li>
          ))}
        </ul>
      </div>
      <p className="hint" style={{ margin: '6px 0 0' }}>
        Clarity = how accurately the recognizer heard each word (pronunciation proxy), not a true accent classifier.
      </p>
    </div>
  );
}

/* ---------------- session: fixed-limit recorder with progress ---------------- */
interface SessionItem {
  key: string;
  kind: 'read' | 'repeat';
  id: string;
  text: string;
  tip?: string;
  limit: number;
  /** Set when the item came from the shared voice pool (completion-tracked). */
  poolId?: string;
}

/** Static fallback — always available offline. Pool items replace these when served. */
function staticItems(): SessionItem[] {
  return [
    ...READ_BANK.map((r) => ({ key: `read-${r.id}`, kind: 'read' as const, id: r.id, text: r.text, tip: r.tip, limit: SPEAK_LIMITS.read })),
    ...REPEAT_BANK.map((r) => ({ key: `repeat-${r.id}`, kind: 'repeat' as const, id: r.id, text: r.text, limit: SPEAK_LIMITS.repeat })),
  ];
}

export interface SessionRec {
  url: string;
  blob: Blob;
  secs: number;
}

function SessionRecorder({
  limit,
  existing,
  onDone,
}: {
  limit: number;
  existing?: SessionRec | null;
  onDone: (r: SessionRec | null) => void;
}) {
  const r = useRecorder();
  const cb = useRef(onDone);
  cb.current = onDone;
  const sent = useRef(false);
  const [replacing, setReplacing] = useState(false);

  useEffect(() => {
    if (r.url && r.blob && !sent.current) {
      sent.current = true;
      cb.current({ url: r.url, blob: r.blob, secs: r.secs });
    }
  }, [r.url, r.blob, r.secs]);

  function retry() {
    sent.current = false;
    onDone(null);
    r.reset();
  }

  const pct = Math.min(100, Math.round((r.secs / limit) * 100));
  const autoStopped = !r.recording && r.url && r.secs >= limit;

  if (existing && !replacing && !r.url && !r.recording) {
    return (
      <div>
        <VoicePlayer src={existing.url} />
        <p className="hint">Recorded {existing.secs}s of {limit}s.</p>
        <div className="btnrow">
          <button className="btn-ghost" onClick={() => setReplacing(true)}>↻ Re-record</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!r.url && !r.recording && (
        <div className="btnrow" style={{ marginTop: 8 }}>
          <button className="btn-ghost" onClick={() => r.start(limit)}>🎙 Start recording ({limit}s max)</button>
        </div>
      )}
      {r.recording && (
        <div className="svar-audio" style={{ display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
            <span>🔴 {r.secs}s / {limit}s</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: '#e7ecf5', marginTop: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: pct >= 90 ? '#d64545' : '#1b4fa0', transition: 'width 0.5s linear' }} />
          </div>
          <div className="btnrow" style={{ marginTop: 8 }}>
            <button className="btn-ghost" onClick={r.stop}>Stop — I’m done ({r.secs}s)</button>
          </div>
          <p className="hint">Recording stops automatically at {limit}s.</p>
        </div>
      )}
      {r.url && (
        <>
          <VoicePlayer src={r.url} />
          <p className="hint">
            Recorded {r.secs}s of {limit}s{autoStopped ? ' (time limit reached)' : ''}.
          </p>
          <div className="btnrow">
            <button className="btn-ghost" onClick={retry}>↻ Re-record</button>
          </div>
        </>
      )}
      {r.error && <div className="err">{r.error}</div>}
    </div>
  );
}

/* ---------------- main page ---------------- */
type Phase = 'lobby' | 'running' | 'scoring' | 'report';

export default function Svar() {
  const ask = useConfirm();
  const userId = useSession((s) => s.userId);
  const email = useSession((s) => s.email);
  const profile = useSession((s) => s.profile);
  const tier = profile?.tier ?? 'free';
  const setLeaveGuard = useUi((s) => s.setLeaveGuard);
  const [tab, setTab] = useState<Tab>('session');
  const [stats, setStats] = useState<SvarStats>(() => readStats());
  const [leftS, setLeftS] = useState<number | null>(null);

  const [phase, setPhase] = useState<Phase>('lobby');
  const [stepIdx, setStepIdx] = useState(0);
  const [items, setItems] = useState<SessionItem[]>(() => staticItems());
  const [recs, setRecs] = useState<Record<string, SessionRec>>({});
  const [report, setReport] = useState<SpeakingReport | null>(null);
  const [scoring, setScoring] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<SpeakingReport[]>([]);

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
    listSpeakingReports(userId).then(setHistory).catch(() => {});
  };

  useEffect(() => {
    refreshQuota();
    listSpeakingReports(userId).then(setHistory).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Leaving a live session counts it: bump one voice session, drafts are lost.
  useEffect(() => {
    if (phase !== 'running') {
      setLeaveGuard(null);
      return;
    }
    setLeaveGuard({
      confirmLeave: () => {
        if (userId) bumpQuota('speaking', userId).catch(() => {});
      },
    });
    return () => setLeaveGuard(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, setLeaveGuard]);

  /**
   * Assemble the session: unattempted pool samples first (old unfinished ones
   * keep coming back until done), fresh AI batches for the shortfall
   * (published back to the pool), static bank filling whatever remains.
   */
  async function assembleItems(): Promise<SessionItem[]> {
    const WANT = 6;
    const built: SessionItem[] = [];
    for (const kind of ['read', 'repeat'] as const) {
      const limit = SPEAK_LIMITS[kind];
      const pooled = await fetchUnattemptedSamples(userId, kind, WANT, tier);
      for (const p of pooled) {
        built.push({ key: `pool-${p.id}`, kind, id: p.id, text: p.text, tip: p.tip, limit, poolId: p.id });
      }
      const short = WANT - pooled.length;
      if (short > 0) {
        try {
          const fresh = await generateVoiceBatch(kind, short);
          const published = await publishSamples(
            fresh.map((f) => ({ kind, text: f.text, tip: f.tip })),
            tier
          );
          const use = published.length ? published : fresh.map((f, i) => ({ ...f, id: `ai-${Date.now().toString(36)}-${i}` }));
          for (const u of use) {
            built.push({
              key: `pool-${u.id}`,
              kind,
              id: u.id,
              text: u.text,
              tip: (u as any).tip,
              limit,
              poolId: published.length ? u.id : undefined,
            });
          }
        } catch {
          /* AI unavailable — static fill below covers it */
        }
      }
      const have = built.filter((b) => b.kind === kind).length;
      const bank = (kind === 'read' ? READ_BANK : REPEAT_BANK).slice(0, Math.max(0, WANT - have));
      for (const r of bank as any[]) {
        built.push({
          key: `${kind}-${r.id}`,
          kind,
          id: r.id,
          text: r.text,
          tip: (r as any).tip,
          limit,
        });
      }
    }
    return built;
  }

  async function startSession() {
    setError('');
    if (userId) {
      try {
        const q = await quotaStatus('speaking', userId, tier);
        if (!q.allowed && !q.offline) {
          setError(`Free plan: ${q.limit} voice sessions per day — back tomorrow.`);
          return;
        }
      } catch {
        /* grace */
      }
    }
    setLoading(true);
    try {
      const assembled = await assembleItems();
      setItems(assembled.length ? assembled : staticItems());
    } catch {
      setItems(staticItems());
    } finally {
      setLoading(false);
    }
    setRecs({});
    setReport(null);
    setStepIdx(0);
    setPhase('running');
    window.scrollTo({ top: 0 });
  }

  function setRec(key: string, r: SessionRec | null) {
    setRecs((prev) => {
      const next = { ...prev };
      if (r) next[key] = r;
      else delete next[key];
      return next;
    });
  }

  async function finishSession() {
    setError('');
    const keys = Object.keys(recs);
    if (!keys.length) {
      setError('Record at least one item before finishing — empty sessions don’t count.');
      return;
    }
    setPhase('scoring');
    setScoring({ done: 0, total: keys.length });
    const items: SpeakingReport['items'] = [];
    for (const key of keys) {
      const item = items.find((i) => i.key === key)!;
      const rec = recs[key];
      // Fresh recordings are always transcribed fresh; saved reports never re-call.
      let review = null;
      try {
        const { text } = await transcribeAudio(rec.blob);
        review = scoreAttempt(item.text, text, rec.secs);
        saveReview(key, review);
      } catch (e) {
        review = null;
      }
      items.push({ key, kind: item.kind, text: item.text, secs: rec.secs, review, poolId: item.poolId });
      setScoring((s) => ({ ...s, done: s.done + 1 }));
    }
    const rep = speakingReportFromItems(
      { userId: userId!, username: profile?.username || (email ? email.split('@')[0] : 'friend') },
      items
    );
    setReport(rep);
    setPhase('report');
    window.scrollTo({ top: 0 });
    // Pool samples scored in this finished session count as completed —
    // unfinished old ones keep coming back until done.
    recordSampleCompletions(
      userId,
      items.filter((i) => i.poolId && i.review).map((i) => i.poolId as string)
    ).catch(() => {});
    saveSpeakingReport(rep)
      .then(() => listSpeakingReports(userId).then(setHistory).catch(() => {}))
      .catch(() => {});
    if (userId) bumpQuota('speaking', userId).catch(() => {});
    refreshQuota();
    bump({ done: readStats().done + 1 });
    setStats(readStats());
  }

  function openHistory(r: SpeakingReport) {
    setReport(r);
    setPhase('report');
    window.scrollTo({ top: 0 });
  }

  async function remove(id: string) {
    const ok = await ask({
      title: 'Delete this speaking report?',
      description: 'Its marks and sheet will be removed. This cannot be undone.',
      actionLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await deleteSpeakingReport(id);
    setHistory((h) => h.filter((x) => x.id !== id));
  }

  const item = items[stepIdx];
  const recordedCount = Object.keys(recs).length;

  return (
    <div>
      <div className="page-hero">
        <h2>Speaking & listening lab</h2>
        <p>SVAR-style speaking sessions on your own voice server — read aloud and repeat, each on a fixed timer. Finish the session for one marks report with pronunciation feedback.</p>
        <div style={{ marginTop: 10 }}>
          <span className="chip ghost">🎙 {items.length} spoken items</span>{' '}
          <span className="chip ghost">📄 report + PDF</span>{' '}
          {tier === 'pro' ? (
            <span className="chip green">Pro • unlimited</span>
          ) : (
            leftS !== null && <span className="chip green">Free • {leftS} of 5 left</span>
          )}
        </div>
      </div>

      <div className="svar-tabs">
        {(['listen', 'session'] as Tab[]).map((t) => (
          <button key={t} className={`radio-pill ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'listen' ? '👂 Listen & answer' : '🎙 Speaking session'}
          </button>
        ))}
      </div>

      {error && (
        <div className="banner warn" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {tab === 'listen' && <ListenTab refresh={refresh} />}

      {tab === 'session' && phase === 'lobby' && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 40 }}>🎙️</div>
          <h3 style={{ margin: '12px 0 6px' }}>Ready for a speaking session?</h3>
          <p className="hint">
            {READ_BANK.length} read-aloud ({SPEAK_LIMITS.read}s each) + {REPEAT_BANK.length} repeat-after-me ({SPEAK_LIMITS.repeat}s each).
            Recordings stop at the limit automatically — finish early and your actual time is what counts. Samples come
            from the shared pool: unfinished ones keep returning until you complete them. One report with marks at the end.
          </p>
          <div className="btnrow" style={{ justifyContent: 'center' }}>
            <button className="btn-big" disabled={loading} onClick={() => { setLoading(true); startSession().finally(() => setLoading(false)); }}>
              {loading ? 'Setting your samples…' : 'Start speaking session →'}
            </button>
          </div>
        </div>
      )}

      {tab === 'session' && phase === 'running' && item && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <b>Item {stepIdx + 1} of {items.length} • {recordedCount} recorded</b>
              <span className="hint">{Math.round(((stepIdx + 1) / items.length) * 100)}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: '#e7ecf5', marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${((stepIdx + 1) / items.length) * 100}%`, background: 'linear-gradient(90deg,#4d7cfe,#38bdf8)', borderRadius: 999 }} />
            </div>
            <div className="btnrow" style={{ marginBottom: 0 }}>
              <button className="btn-ghost" disabled={stepIdx === 0} onClick={() => { setStepIdx((i) => i - 1); window.scrollTo({ top: 0 }); }}>← Back</button>
              {stepIdx < items.length - 1 && (
                <button className="btn-primary" onClick={() => { setStepIdx((i) => i + 1); window.scrollTo({ top: 0 }); }}>Next →</button>
              )}
            </div>
          </div>

          <div className="svar-card">
            <span className="topic">{item.kind === 'read' ? `Read aloud • ${item.limit}s max` : `Repeat after me • ${item.limit}s max`}</span>
            {item.kind === 'repeat' && (
              <div style={{ marginTop: 8 }}>
                <PlayButton text={item.text} label="Hear it" onPlayed={() => bump({ plays: readStats().plays + 1 })} />
              </div>
            )}
            <div className="svar-sentence">“{item.text}”</div>
            {item.tip && <div className="svar-tip"><b>Coach tip:</b> {item.tip}</div>}
            <SessionRecorder key={item.key} limit={item.limit} existing={recs[item.key]} onDone={(r) => setRec(item.key, r)} />
          </div>

          <div className="card" style={{ textAlign: 'center' }}>
            <button className="btn-big" onClick={finishSession}>
              Finish & get my report ✓ ({recordedCount}/{items.length})
            </button>
            <p className="hint">Unrecorded items stay unscored. Leaving now counts one voice session.</p>
          </div>
        </>
      )}

      {tab === 'session' && phase === 'scoring' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 40 }}>⭐</div>
          <h3>Scoring your session…</h3>
          <p className="hint">Transcribing {scoring.done} of {scoring.total} recordings, then marking each one.</p>
          <div style={{ height: 8, borderRadius: 99, background: '#e7ecf5', marginTop: 12, overflow: 'hidden', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ height: '100%', width: scoring.total ? `${(scoring.done / scoring.total) * 100}%` : '0%', borderRadius: 99, background: 'linear-gradient(90deg,#4d7cfe,#38bdf8)' }} />
          </div>
        </div>
      )}

      {tab === 'session' && phase === 'report' && report && (
        <>
          <div className="card" style={{ textAlign: 'center', background: 'linear-gradient(135deg,#0b1e4b,#1b4fa0)', color: '#fff', border: 'none' }}>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{new Date(report.at).toLocaleString()} • {report.items.length} items</div>
            <div style={{ fontSize: 52, fontWeight: 800 }}>{report.marks}/10</div>
            <div className="btnrow" style={{ justifyContent: 'center', marginTop: 12, marginBottom: 0 }}>
              <button className="btn-ghost" onClick={() => downloadSpeakingReport(report)}>
                ⬇ Download report PDF
              </button>
              <button className="btn-big" onClick={() => { setPhase('lobby'); setReport(null); }}>
                New session →
              </button>
            </div>
          </div>
          {report.items.map((it, i) => (
            <div className="svar-card" key={it.key}>
              <span className="topic">Item {i + 1} • {it.kind === 'read' ? 'Read aloud' : 'Repeat'} • {it.secs}s</span>
              <div className="svar-sentence">“{it.text}”</div>
              {it.review ? <ReviewCard review={it.review} /> : <p className="hint">Couldn’t score this one — transcription failed. Your other marks stand.</p>}
            </div>
          ))}
        </>
      )}

      <h3>
        Past speaking reports {history.length > 0 && <span className="hint">• {history.length} saved</span>}
      </h3>
      {!history.length && <p className="hint">No reports yet — finish a session above and it lands here. Opening a saved report never re-calls the AI.</p>}
      {history.map((h) => (
        <div className="t-row" key={h.id}>
          <div className="ring" style={{ '--p': h.marks * 10 } as any}><span>{h.marks}</span></div>
          <div className="meta">
            <div style={{ fontWeight: 700 }}>{h.marks}/10 • {h.items.length} items</div>
            <div className="hint">{new Date(h.at).toLocaleString()}</div>
          </div>
          <div className="btnrow" style={{ marginTop: 0 }}>
            <button className="btn-ghost" onClick={() => openHistory(h)}>View report</button>
            <button className="btn-ghost" onClick={() => downloadSpeakingReport(h)}>PDF</button>
            <button className="btn-ghost" onClick={() => remove(h.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
