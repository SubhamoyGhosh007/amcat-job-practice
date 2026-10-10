import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BatteryMedium,
  LayoutGrid,
  Mic,
  MicOff,
  Pause,
  PhoneOff,
  Play,
  Signal,
  UserPlus,
  Video,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import {
  EXTEMPORE_TOPICS,
  JUMBLED_SENTENCES_BANK,
  LISTEN_BANK,
  MOCK_CALL_SCENARIOS,
  READ_BANK,
  REPEAT_BANK,
  SHORT_ANSWER_BANK,
} from '../data/svar';
import {
  CALL_MAX_TURNS,
  CALL_MIN_TURNS,
  fallbackCustomerLine,
  gradeCall,
  nextCustomerTurn,
  type CallGrade,
  type CallTurn,
} from '../lib/callJudge';
import { ttsConfigured, speak } from '../lib/tts';
import { bumpQuota, quotaStatus } from '../lib/usage';
import { rotatingSubset, shuffle } from '../lib/genUtils';
import {
  gradeJam,
  readJamGrade,
  saveJamGrade,
  saveReview,
  scoreAttempt,
  surpriseTopic,
  transcribeAudio,
  type JamGrade,
  type SpeechReview,
} from '../lib/speechReview';
import { friendlyError } from '../lib/friendly';
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

type Tab = 'session' | 'listen' | 'short' | 'jumbled' | 'extempore' | 'mockcall';

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
  // Rotating subset: 6 fresh items per visit, unseen-first. Same bank, new set.
  const [order, setOrder] = useState(() => rotatingSubset(LISTEN_BANK, 6, 'amcat_listen_seen'));
  const [plays, setPlays] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const [subErr, setSubErr] = useState('');

  function newSet() {
    setOrder(rotatingSubset(LISTEN_BANK, 6, 'amcat_listen_seen'));
    setPlays({});
    setPicked({});
    setDone(false);
    setSubErr('');
    window.scrollTo({ top: 0 });
  }

  function played(id: string) {
    setPlays((p) => ({ ...p, [id]: (p[id] || 0) + 1 }));
    bump({ plays: readStats().plays + 1 });
  }

  const score = order.filter((q) => picked[q.id] === q.answerIndex).length;

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
      <div className="btnrow" style={{ justifyContent: 'flex-end', marginBottom: 4 }}>
        <button className="btn-ghost" onClick={newSet}>↻ New listen set (6 fresh)</button>
      </div>
      {order.map((q, i) => {
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
          <b style={{ fontSize: 20 }}>You scored {score}/{order.length}</b>
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

/* ---------------- tab 3: short answers (Versant / SVAR style) ---------------- */
function ShortAnswersTab() {
  // Rotating 8-subset: unseen-first. Same bank, new questions.
  const [order, setOrder] = useState(() => rotatingSubset(SHORT_ANSWER_BANK, 8, 'amcat_short_seen'));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  function newSet() {
    setOrder(rotatingSubset(SHORT_ANSWER_BANK, 8, 'amcat_short_seen'));
    setAnswers({});
    setChecked({});
    window.scrollTo({ top: 0 });
  }

  function check(id: string) {
    setChecked((prev) => ({ ...prev, [id]: true }));
  }

  return (
    <div>
      <TtsGate />
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px' }}>Short Answer Questions (Versant & SVAR)</h3>
        <p className="hint" style={{ margin: 0 }}>
          Listen to the question once and give a direct, one-or-two word answer immediately. In actual AI scoring, questions move after 3 to 6 seconds of silence.
        </p>
      </div>
      <div className="btnrow" style={{ justifyContent: 'flex-end', marginBottom: 4 }}>
        <button className="btn-ghost" onClick={newSet}>↻ New 8 questions</button>
      </div>

      {order.map((item, idx) => {
        const val = answers[item.id] || '';
        const isDone = checked[item.id];
        const normVal = val.toLowerCase().trim();
        const normAns = item.answer.toLowerCase().trim();
        const words = normAns.replace(/[^a-z0-9 ]/g, '').split(' ');
        const isMatch = normVal.length > 0 && words.some((w) => w.length > 2 && normVal.includes(w));

        return (
          <div className="svar-card" key={item.id}>
            <div className="qnum">Question {idx + 1} of {order.length}</div>
            <PlayButton text={item.prompt} label="Play question audio" />
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 500,
                color: isDone ? '#fff' : '#9fb0cc',
                margin: '10px 0 14px',
                padding: '10px 14px',
                borderRadius: 8,
                background: isDone ? 'rgba(77,124,254,0.08)' : 'rgba(255,255,255,0.02)',
                border: '1px dashed var(--border)',
              }}
            >
              {isDone ? (
                <><b>Spoken question:</b> “{item.prompt}”</>
              ) : (
                <>🎧 <b>Listening mode:</b> Play the question audio above and respond without reading text on screen.</>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Type your answer (e.g. marker, cold)..."
                value={val}
                disabled={isDone}
                onChange={(e) => setAnswers({ ...answers, [item.id]: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isDone) check(item.id);
                }}
                style={{
                  flex: 1,
                  minWidth: 220,
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 14,
                }}
              />
              {!isDone ? (
                <button className="btn-primary" onClick={() => check(item.id)}>
                  Check answer ✓
                </button>
              ) : (
                <button className="btn-ghost" onClick={() => setChecked({ ...checked, [item.id]: false })}>
                  Retry ↻
                </button>
              )}
            </div>

            {isDone && (
              <div className={`rev ${isMatch ? 'correct' : 'wrong'}`} style={{ marginTop: 12 }}>
                <div className="qnum">{isMatch ? '✅ Correct' : '💡 Model Answer'}</div>
                <div className="exp" style={{ fontSize: 15, fontWeight: 700 }}>
                  Expected: <span style={{ color: '#38bdf8' }}>{item.answer}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- tab 4: sentence builds (jumbled sentences) ---------------- */
function SentenceBuildsTab() {
  // Rotating 9-subset: unseen-first, reshuffled on demand. Same bank, new order.
  const [order, setOrder] = useState(() => rotatingSubset(JUMBLED_SENTENCES_BANK, 9, 'amcat_jumble_seen'));
  const [activeIdx, setActiveIdx] = useState(0);
  const [builtWords, setBuiltWords] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);

  function newSet() {
    setOrder(rotatingSubset(JUMBLED_SENTENCES_BANK, 9, 'amcat_jumble_seen'));
    setActiveIdx(0);
    setBuiltWords([]);
    setChecked(false);
    window.scrollTo({ top: 0 });
  }

  const curr = order[activeIdx];
  const chips = curr.jumbled.split(' / ');

  const remainingChips = chips.filter((c, i) => {
    const countInBuilt = builtWords.filter((w) => w === c).length;
    const countInChipsSoFar = chips.slice(0, i + 1).filter((w) => w === c).length;
    return countInChipsSoFar > countInBuilt;
  });

  function addWord(word: string) {
    if (checked) return;
    setBuiltWords([...builtWords, word]);
  }

  function undo() {
    if (checked) return;
    setBuiltWords(builtWords.slice(0, -1));
  }

  function reset() {
    setBuiltWords([]);
    setChecked(false);
  }

  function next() {
    if (activeIdx < order.length - 1) {
      setActiveIdx(activeIdx + 1);
      setBuiltWords([]);
      setChecked(false);
    }
  }

  function prev() {
    if (activeIdx > 0) {
      setActiveIdx(activeIdx - 1);
      setBuiltWords([]);
      setChecked(false);
    }
  }

  const builtSentence = builtWords.join(' ');
  const cleanBuilt = builtSentence.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanSol = curr.solution.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isCorrect = cleanBuilt === cleanSol;

  return (
    <div>
      <TtsGate />
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px' }}>Sentence Builds & Jumbled Drills</h3>
        <p className="hint" style={{ margin: 0 }}>
          Rearrange the jumbled segments to form a grammatically correct sentence. In Versant & SVAR, you hear jumbled phrases and speak the complete sentence.
        </p>
      </div>

      <div className="svar-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span className="qnum">Sentence {activeIdx + 1} of {order.length}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-ghost" disabled={activeIdx === 0} onClick={prev} style={{ padding: '4px 10px', fontSize: 12 }}>← Previous</button>
            <button className="btn-ghost" disabled={activeIdx === order.length - 1} onClick={next} style={{ padding: '4px 10px', fontSize: 12 }}>Next →</button>
          </div>
        </div>
        <div className="btnrow" style={{ justifyContent: 'flex-end', marginTop: 0, marginBottom: 10 }}>
          <button className="btn-ghost" onClick={newSet} style={{ padding: '4px 10px', fontSize: 12 }}>↻ New 9 (unseen first)</button>
        </div>

        <div style={{ fontSize: 14, color: '#9fb0cc', marginBottom: 8 }}>Jumbled components:</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {chips.map((chip, idx) => {
            const isUsed = !remainingChips.includes(chip);
            return (
              <button
                key={idx}
                disabled={isUsed || checked}
                onClick={() => addWord(chip)}
                className={`radio-pill ${isUsed ? '' : 'active'}`}
                style={{
                  opacity: isUsed ? 0.4 : 1,
                  cursor: isUsed || checked ? 'default' : 'pointer',
                  padding: '7px 14px',
                  fontSize: 14,
                }}
              >
                {chip}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 14, color: '#9fb0cc', marginBottom: 6 }}>Your constructed sentence:</div>
        <div
          style={{
            minHeight: 52,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(77,124,254,0.06)',
            border: '1px dashed var(--border)',
            fontSize: 17,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          {builtSentence || <span style={{ color: '#6b7280', fontWeight: 400, fontStyle: 'italic' }}>Click the phrase chips above in order...</span>}
        </div>

        <div className="btnrow" style={{ marginTop: 0 }}>
          <button className="btn-ghost" disabled={!builtWords.length || checked} onClick={undo}>
            ↶ Undo
          </button>
          <button className="btn-ghost" disabled={!builtWords.length} onClick={reset}>
            ↻ Reset
          </button>
          {!checked ? (
            <button className="btn-primary" disabled={remainingChips.length > 0} onClick={() => setChecked(true)}>
              Check Sentence ✓
            </button>
          ) : (
            <button className="btn-big" onClick={next} disabled={activeIdx === order.length - 1}>
              Next sentence →
            </button>
          )}
        </div>

        {checked && (
          <div className={`rev ${isCorrect ? 'correct' : 'wrong'}`} style={{ marginTop: 16 }}>
            <div className="qnum">{isCorrect ? '✅ Well done! Sentence is correct.' : '❌ Incorrect word order'}</div>
            <div className="exp" style={{ marginTop: 6 }}>
              <b>Model Answer:</b> “{curr.solution}”
            </div>
            <div style={{ marginTop: 8 }}>
              <PlayButton text={curr.solution} label="Hear correct pronunciation" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- tab 5: extempore (JAM - Just A Minute) ---------------- */
function ExtemporeTab() {
  const userId = useSession((s) => s.userId);
  const tier = useSession((s) => s.profile?.tier ?? 'free');
  // Random topic on arrival; timers fire automatically: 30s prep → 60s speak.
  const [topicIdx, setTopicIdx] = useState(() => Math.floor(Math.random() * EXTEMPORE_TOPICS.length));
  const [custom, setCustom] = useState<{ topic: string; structure: string } | null>(null);
  const [surprising, setSurprising] = useState(false);
  const [phase, setPhase] = useState<'prep' | 'speak' | 'done'>('prep');
  const [prepLeft, setPrepLeft] = useState(30);
  const [grade, setGrade] = useState<JamGrade | null>(null);
  const [grading, setGrading] = useState(false);
  const [gradeErr, setGradeErr] = useState('');
  const [showModel, setShowModel] = useState(false);
  const recorder = useRecorder();

  const topic = custom || EXTEMPORE_TOPICS[topicIdx];
  const modelAnswer: string | undefined = (topic as { modelAnswer?: string }).modelAnswer;
  const topicKey = custom ? `ai:${custom.topic}` : `bank:${EXTEMPORE_TOPICS[topicIdx].topic}`;

  function pickRandom() {
    let n = topicIdx;
    while (EXTEMPORE_TOPICS.length > 1 && n === topicIdx) n = Math.floor(Math.random() * EXTEMPORE_TOPICS.length);
    setTopicIdx(n);
    setCustom(null);
  }

  async function surprise() {
    setSurprising(true);
    try {
      const s = await surpriseTopic(EXTEMPORE_TOPICS.map((t) => t.topic));
      setCustom(s);
    } finally {
      setSurprising(false);
    }
  }

  // New topic (or mount): reset everything, prep countdown fires on its own.
  useEffect(() => {
    recorder.reset();
    setGrade(readJamGrade(custom ? `ai:${custom.topic}` : `bank:${EXTEMPORE_TOPICS[topicIdx].topic}`));
    setGradeErr('');
    setPhase('prep');
    setPrepLeft(30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicIdx, custom?.topic]);

  // Prep countdown → auto-start recording. No gesture means the browser may
  // refuse the mic; the manual button below covers that case.
  useEffect(() => {
    if (phase !== 'prep') return;
    const end = Date.now() + 30 * 1000;
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setPrepLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(interval);
        setPhase('speak');
        recorder.start(60).catch(() => {});
      }
    }, 250);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, topicIdx, custom?.topic]);

  // Recording finished (auto-stop at 60s or manual) → ready to grade.
  useEffect(() => {
    if (phase === 'speak' && recorder.url) setPhase('done');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.url]);

  async function runGrade() {
    if (!recorder.blob || grading) return;
    setGradeErr('');
    setGrading(true);
    try {
      if (userId) {
        const q = await quotaStatus('speaking', userId, tier);
        if (!q.allowed && !q.offline) throw new Error(`Free plan: ${q.limit} voice sessions per day — back tomorrow.`);
      }
      const { text } = await transcribeAudio(recorder.blob);
      const g = await gradeJam(topic.topic, text, recorder.secs);
      saveJamGrade(topicKey, g);
      setGrade(g);
      if (userId) bumpQuota('speaking', userId).catch(() => {});
    } catch (e) {
      setGradeErr(friendlyError(e));
    } finally {
      setGrading(false);
    }
  }

  return (
    <div>
      <TtsGate />
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px' }}>Extempore & Just-A-Minute (JAM) Practice</h3>
        <p className="hint" style={{ margin: 0 }}>
          30 seconds to structure your thoughts, then 45 to 60 seconds to speak without freezing. Follow the proven Concentrix 4-step framework.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <button className="btn-primary" onClick={pickRandom}>🎲 New random topic</button>
        <button className="btn-ghost" disabled={surprising} onClick={surprise}>
          {surprising ? 'Dreaming one up…' : '✨ AI surprise topic'}
        </button>
        <span className="hint">{custom ? 'AI-given topic' : `Topic ${topicIdx + 1} of ${EXTEMPORE_TOPICS.length}`}</span>
      </div>

      <div className="svar-card">
        <span className="topic">Extempore Speech • 30s prep → 60s speak (auto)</span>
        <h2 style={{ fontSize: 24, margin: '8px 0 12px', color: '#16213a' }}>“{topic.topic}”</h2>

        <div style={{ background: '#122550', borderRadius: 10, padding: '14px 18px', margin: '14px 0', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ color: '#38d98a', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Recommended 4-Step Framework
          </div>
          <div style={{ fontSize: 14.5, color: '#eaf1ff', marginTop: 6, fontWeight: 500 }}>
            {topic.structure}
          </div>
        </div>

        {/* Phase 1: 30s prep, fires automatically */}
        <div style={{ margin: '18px 0', padding: '14px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <b>Step 1: 30-Second Thinking Timer</b>
              <div className="hint">Starts on its own — plan your opening, two points, and one example.</div>
            </div>
            <div>
              {phase === 'prep' ? (
                <>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#f5a623' }}>⏳ {prepLeft}s thinking…</span>{' '}
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setPhase('speak');
                      recorder.start(60).catch(() => {});
                    }}
                  >
                    Skip prep →
                  </button>
                </>
              ) : (
                <span style={{ fontSize: 15, fontWeight: 700, color: '#38d98a' }}>✅ Prep done</span>
              )}
            </div>
          </div>
        </div>

        {/* Phase 2: 60s speech, recording auto-starts */}
        <div style={{ margin: '18px 0', padding: '14px 18px', borderRadius: 10, border: '1px solid var(--border)' }}>
          <b>Step 2: Speak for up to 60 Seconds</b>
          <div className="hint" style={{ marginBottom: 12 }}>Recording starts by itself when prep ends. Speak smoothly, land word endings clearly.</div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {recorder.recording ? (
              <button
                className="btn-big"
                onClick={recorder.stop}
                style={{ background: '#d64545', borderColor: '#d64545' }}
              >
                ⏹️ Stop ({recorder.secs}s / 60s)
              </button>
            ) : recorder.url ? (
              <button
                className="btn-ghost"
                onClick={() => {
                  recorder.reset();
                  setPhase('speak');
                  recorder.start(60).catch(() => {});
                }}
              >
                ↻ Re-record
              </button>
            ) : phase === 'speak' ? (
              <button className="btn-big" onClick={() => recorder.start(60).catch(() => {})}>
                🎙️ Tap to start speaking
              </button>
            ) : (
              <span className="hint">Waiting for prep to finish…</span>
            )}

            {recorder.url && (
              <audio controls src={recorder.url} style={{ height: 38 }} />
            )}
          </div>
          {recorder.error && <div className="err" style={{ marginTop: 8 }}>{recorder.error}</div>}
        </div>

        {/* Step 3: grading */}
        {phase === 'done' && recorder.url && (
          <div style={{ marginTop: 8 }}>
            {!grade ? (
              <>
                <button className="btn-big" disabled={grading} onClick={runGrade}>
                  {grading ? (<><span className="spinner" /> Transcribing & grading…</>) : ('⭐ Grade my speech')}
                </button>
                {gradeErr && <div className="err" style={{ marginTop: 8 }}>{gradeErr}</div>}
              </>
            ) : (
              <div className="rev correct" style={{ marginTop: 4 }}>
                <div className="qnum">
                  ⭐ {grade.marks}/10 • content {grade.content}/10 • language {grade.language}/10 • delivery {grade.delivery}%
                  {grade.estimated ? ' • estimated' : ''}
                </div>
                <div style={{ fontSize: 13.5, margin: '6px 0' }}>
                  <div>Content {grade.content}/10 • Language {grade.language}/10 • Delivery {grade.delivery}%</div>
                  <div className="hint">Pace {grade.wpm} wpm • {grade.fillers} filler sounds</div>
                </div>
                <div className="exp" style={{ overflowWrap: 'anywhere' }}>
                  <b>You said:</b> “{grade.transcript}”
                </div>
                <div className="exp" style={{ marginTop: 6 }}>
                  <b>Coach feedback:</b>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {grade.feedback.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Model comparison (bank topics carry a model speech) */}
        {modelAnswer && (
        <div style={{ marginTop: 20 }}>
          <button className="btn-ghost" onClick={() => setShowModel(!showModel)}>
            {showModel ? 'Hide Model Answer ▲' : 'Show Coach Model Speech ▼'}
          </button>
          {showModel && (
            <div style={{ marginTop: 12, background: 'rgba(77,124,254,0.08)', border: '1px solid rgba(125,160,255,0.25)', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: 6 }}>Word-for-Word Concentrix Model Speech:</div>
              <p style={{ margin: '0 0 10px', fontStyle: 'italic', fontSize: 15, color: '#eaf1ff', lineHeight: 1.65 }}>
                “{modelAnswer}”
              </p>
              <PlayButton text={modelAnswer} label="Listen to model delivery" />
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- tab 6: mock call roleplay simulator ---------------- */
function CallBtn({
  label,
  icon,
  onClick,
  active,
  dim,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  active?: boolean;
  dim?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={`callbtn${active ? ' active' : ''}${dim ? ' dim' : ''}`}
      onClick={onClick}
      disabled={disabled || dim}
      aria-label={dim ? `${label} (not in practice mode)` : label}
      title={dim ? 'Not in practice mode' : label}
    >
      <span className="callbtn-ic">{icon}</span>
      <span className="callbtn-lb">{label}</span>
    </button>
  );
}

function MockCallTab() {
  const userId = useSession((s) => s.userId);
  const tier = useSession((s) => s.profile?.tier ?? 'free');
  const [scenarioIdx, setScenarioIdx] = useState(0);
  // 'idle' → pick & answer. 'live' → fully automatic voice loop. 'ended' → marks.
  const [phase, setPhase] = useState<'idle' | 'live' | 'ended'>('idle');
  // status drives the phone screen: ai = customer speaking, user = your turn.
  const [status, setStatus] = useState<'ai' | 'user' | 'thinking' | 'paused'>('ai');
  const [turns, setTurns] = useState<CallTurn[]>([]);
  const [err, setErr] = useState('');
  const [grade, setGrade] = useState<CallGrade | null>(null);
  const [grading, setGrading] = useState(false);
  const [misses, setMisses] = useState(0);
  const [held, setHeld] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [keypad, setKeypad] = useState(false);
  const [callSecs, setCallSecs] = useState(0);
  const [clock, setClock] = useState('');
  const recorder = useRecorder();
  const turnsRef = useRef<CallTurn[]>([]);
  turnsRef.current = turns;
  const heldRef = useRef(false);
  heldRef.current = held;
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const submittedRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingRef = useRef<null | { kind: 'user' } | { kind: 'ai'; blob: Blob }>(null);

  const scenario = MOCK_CALL_SCENARIOS[scenarioIdx];
  const agentTurns = turns.filter((t) => t.speaker === 'agent').length;

  // Live clock + call timer.
  useEffect(() => {
    if (phase !== 'live') return;
    const tick = () => {
      const n = new Date();
      setClock(`${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`);
    };
    tick();
    const t = window.setInterval(() => {
      tick();
      setCallSecs((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  // Stop everything on unmount.
  useEffect(
    () => () => {
      try {
        audioRef.current?.pause();
      } catch {
        /* ignore */
      }
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function stopAudio() {
    try {
      audioRef.current?.pause();
      audioRef.current = null;
    } catch {
      /* ignore */
    }
  }

  /** Play customer voice. Falls back to a timed estimate if autoplay blocks. */
  async function playCustomer(text: string, onDone: () => void) {
    stopAudio();
    const estMs = Math.min(20000, 1500 + text.split(/\s+/).length * 420);
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      onDone();
    };
    try {
      const url = await speak(text, { voice: 'high' });
      const a = new Audio(url);
      audioRef.current = a;
      a.volume = speakerOn ? 1 : 0.35;
      a.onended = done;
      window.setTimeout(done, estMs + 4000);
      await a.play();
    } catch {
      window.setTimeout(done, estMs);
    }
  }

  // Update volume of currently playing audio when speakerOn changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = speakerOn ? 1 : 0.35;
    }
  }, [speakerOn]);

  function startUserRec() {
    submittedRef.current = null;
    recorder.reset();
    setStatus('user');
    beep();
    recorder.start(30).catch(() => {});
  }

  /** Pause the auto-flow; resume() continues the exact pending step. */
  function pauseFor(p: { kind: 'user' } | { kind: 'ai'; blob: Blob }) {
    pendingRef.current = p;
    setStatus('paused');
  }

  function resumePending() {
    const p = pendingRef.current;
    pendingRef.current = null;
    if (!p) return;
    if (p.kind === 'user') {
      if (mutedRef.current || heldRef.current) {
        pendingRef.current = p;
        setStatus('paused');
        return;
      }
      startUserRec();
    } else {
      void submitReply(p.blob);
    }
  }

  function afterAiSpeech() {
    if (heldRef.current || mutedRef.current) pauseFor({ kind: 'user' });
    else startUserRec();
  }

  async function customerReply(history: CallTurn[]) {
    setStatus('thinking');
    setErr('');
    try {
      const n = await nextCustomerTurn(scenario.title, scenario.description, history);
      const done = n.satisfied && agentTurns + 1 >= CALL_MIN_TURNS;
      const entry: CallTurn = { speaker: 'customer', text: n.customerSay, coachNote: n.coachNote };
      const next = [...turnsRef.current, entry];
      setTurns(next);
      setStatus('ai');
      await playCustomer(n.customerSay, () => {
        if (done) {
          void endCall(next, true);
          return;
        }
        if (next.filter((t) => t.speaker === 'agent').length >= CALL_MAX_TURNS) {
          void endCall(next, false, true);
          return;
        }
        afterAiSpeech();
      });
    } catch (e) {
      setErr(friendlyError(e));
      // AI turn failed: hand the mic over anyway so the call never stalls.
      if (heldRef.current || mutedRef.current) pauseFor({ kind: 'user' });
      else startUserRec();
    }
  }

  async function startCall() {
    setErr('');
    if (userId) {
      try {
        const q = await quotaStatus('speaking', userId, tier);
        if (!q.allowed && !q.offline) {
          setErr(`Free plan: ${q.limit} voice sessions per day — back tomorrow.`);
          return;
        }
      } catch {
        /* grace */
      }
    }
    // Unlock audio on the tap gesture so autoplay works through the call.
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        if (ctx.state === 'suspended') await ctx.resume();
        ctx.close().catch(() => {});
      }
    } catch {
      /* ignore */
    }
    const opening: CallTurn = { speaker: 'customer', text: scenario.steps[0].customer };
    turnsRef.current = [opening];
    setTurns([opening]);
    setGrade(null);
    setMisses(0);
    setHeld(false);
    setMuted(false);
    setKeypad(false);
    pendingRef.current = null;
    submittedRef.current = null;
    setCallSecs(0);
    setPhase('live');
    setStatus('ai');
    recorder.reset();
    await playCustomer(opening.text, afterAiSpeech);
  }

  async function submitReply(blob: Blob) {
    if (submittedRef.current === 'busy') return;
    submittedRef.current = 'busy';
    setErr('');
    setStatus('thinking');
    let heard = '';
    try {
      const r = await transcribeAudio(blob);
      heard = r.text;
    } catch (e) {
      heard = '';
    }
    if (heard.trim().split(/\s+/).filter(Boolean).length < 3) {
      // Silence / unheard reply: customer asks to repeat. Counts as a turn —
      // the cap still guarantees termination.
      const m = misses + 1;
      setMisses(m);
      const entry: CallTurn = { speaker: 'agent', text: '(no clear reply heard)' };
      const retry: CallTurn = { speaker: 'customer', text: fallbackCustomerLine(m) };
      const next = [...turnsRef.current, entry, retry];
      setTurns(next);
      setStatus('ai');
      await playCustomer(retry.text, () => {
        if (next.filter((t) => t.speaker === 'agent').length >= CALL_MAX_TURNS) {
          void endCall(next, false, true);
          return;
        }
        afterAiSpeech();
      });
      return;
    }
    setMisses(0);
    const next = [...turnsRef.current, { speaker: 'agent', text: heard } as CallTurn];
    setTurns(next);
    recorder.reset();
    await customerReply(next);
  }

  // Recorder finished on its own (auto-stop at 30s): submit unless paused.
  useEffect(() => {
    if (phase !== 'live' || status !== 'user' || !recorder.url || !recorder.blob) return;
    if (submittedRef.current) return;
    if (heldRef.current || mutedRef.current) {
      pauseFor({ kind: 'ai', blob: recorder.blob });
      return;
    }
    void submitReply(recorder.blob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.url]);

  // Unmuting resumes a mic-paused turn.
  useEffect(() => {
    if (!muted && phase === 'live' && status === 'paused' && !heldRef.current) resumePending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  function toggleHold() {
    if (phase !== 'live') return;
    if (held) {
      setHeld(false);
      if (status === 'paused') resumePending();
    } else {
      setHeld(true);
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
      if (status === 'user' || status === 'thinking' || status === 'ai') {
        stopAudio();
        setStatus('paused');
      }
    }
  }

  async function endCall(history: CallTurn[], satisfied: boolean, capped = false) {
    stopAudio();
    try {
      recorder.stop();
    } catch {
      /* ignore */
    }
    pendingRef.current = null;
    setGrading(true);
    try {
      const g = await gradeCall(scenario.title, history);
      setGrade({ ...g, feedback: capped ? ['Call reached the 8-turn cap — resolve faster next time.', ...g.feedback].slice(0, 3) : g.feedback });
    } catch {
      setGrade(null);
    } finally {
      setGrading(false);
    }
    setPhase('ended');
    try {
      const prev: string[] = JSON.parse(localStorage.getItem('amcat_call_last') || '[]');
      localStorage.setItem('amcat_call_last', JSON.stringify([{ at: Date.now(), satisfied, turns: history.length }, ...prev].slice(0, 10)));
    } catch {
      /* ignore */
    }
    if (userId) bumpQuota('speaking', userId).catch(() => {});
    void satisfied;
  }

  function resetCall(idx?: number) {
    if (typeof idx === 'number') setScenarioIdx(idx);
    stopAudio();
    turnsRef.current = [];
    pendingRef.current = null;
    submittedRef.current = null;
    setTurns([]);
    setGrade(null);
    setErr('');
    setMisses(0);
    setHeld(false);
    setMuted(false);
    setKeypad(false);
    setCallSecs(0);
    recorder.reset();
    setPhase('idle');
  }

  const mmss = `${String(Math.floor(callSecs / 60)).padStart(2, '0')}:${String(callSecs % 60).padStart(2, '0')}`;
  const yourTurn = phase === 'live' && status === 'user';
  // Short beep the moment the mic opens — the audible "your turn" cue.
  function beep() {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.15;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      window.setTimeout(() => {
        o.stop();
        ctx.close().catch(() => {});
      }, 220);
    } catch {
      /* ignore */
    }
  }
  const statusText =
    phase !== 'live'
      ? ''
      : status === 'ai'
        ? 'Customer speaking… listen'
        : status === 'thinking'
          ? 'Waiting for response…'
          : status === 'paused'
            ? held
              ? 'On hold — tap Hold to resume'
              : 'Muted — unmute to answer'
            : recorder.recording
              ? `🎙 SPEAK NOW (${recorder.secs}s / 30s)`
              : 'Getting your mic…';
  const waving = phase === 'live' && (status === 'ai' || recorder.recording);

  function dtmf(key: string) {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const freqs: Record<string, [number, number]> = {
        '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
        '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
        '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
        '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
      };
      const [f1, f2] = freqs[key] || [697, 1209];
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      o1.frequency.value = f1;
      o2.frequency.value = f2;
      g.gain.value = 0.12;
      o1.connect(g);
      o2.connect(g);
      g.connect(ctx.destination);
      o1.start();
      o2.start();
      window.setTimeout(() => {
        o1.stop();
        o2.stop();
        ctx.close().catch(() => {});
      }, 160);
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <TtsGate />
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px' }}>Live Customer Call — speak, don’t pick</h3>
        <p className="hint" style={{ margin: 0 }}>
          A real voice loop: the customer speaks, you answer out loud, the AI judges every reply and ends the call
          when satisfied (max {CALL_MAX_TURNS} exchanges — it can never loop forever).
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {MOCK_CALL_SCENARIOS.map((sc, idx) => (
          <button
            key={sc.id}
            className={`radio-pill ${scenarioIdx === idx ? 'active' : ''}`}
            onClick={() => resetCall(idx)}
          >
            {sc.title}
          </button>
        ))}
      </div>

      {phase === 'idle' && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 40 }}>📞</div>
          <h3 style={{ margin: '12px 0 6px' }}>{scenario.title}</h3>
          <p className="hint">{scenario.description}</p>
          <div className="btnrow" style={{ justifyContent: 'center' }}>
            <button className="btn-big" onClick={startCall}>Answer the call →</button>
          </div>
          <p className="hint">One call = one voice session. The customer hangs up when satisfied.</p>
        </div>
      )}

      {phase !== 'idle' && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="callphone" aria-label="Simulated phone call">
            <div className="callphone-screen">
            <div className="callphone-status">
              <span>{phase === 'live' ? clock || '--:--' : mmss}</span>
              <span className="callphone-sicons">
                <Signal size={14} />
                <Wifi size={14} />
                <BatteryMedium size={16} />
              </span>
            </div>
            <div className="callphone-contact">
              <span className="callphone-avatar">C</span>
              <b>Customer Care</b>
              <small>{scenario.title}</small>
            </div>
            <div className="callphone-state">
              {phase === 'live' ? (
                <span className={yourTurn && recorder.recording ? 'yourturn' : ''}>
                  {status === 'thinking' && <span className="callphone-count">{agentTurns + 1}</span>} {statusText}
                </span>
              ) : (
                <>Call ended • {mmss}</>
              )}
            </div>
            {phase === 'live' && yourTurn && recorder.recording && (
              <div className="callphone-turnbar">
                <div className="callphone-turnfill" style={{ width: `${Math.min(100, Math.round((recorder.secs / 30) * 100))}%` }} />
                <button className="callphone-done" onClick={() => recorder.stop()}>
                  Done answering ✓ ({30 - recorder.secs}s left)
                </button>
              </div>
            )}
            <div className={`callwave${waving ? '' : ' still'}`} aria-hidden="true">
              {[0.5, 0.9, 0.65, 1, 0.75, 0.55, 0.95, 0.6, 0.8, 0.5, 0.7, 0.9].map((h, i) => (
                <span key={i} style={{ height: `${Math.round(h * 34)}px`, animationDelay: `${(i % 6) * 0.12}s` }} />
              ))}
            </div>
            <div className="callphone-grid">
              <CallBtn
                label={muted ? 'Unmute' : 'Mute'}
                active={muted}
                onClick={() => setMuted((m) => !m)}
                icon={muted ? <MicOff size={22} /> : <Mic size={22} />}
              />
              <CallBtn label="Keypad" active={keypad} onClick={() => setKeypad((k) => !k)} icon={<LayoutGrid size={22} />} />
              <CallBtn
                label="Speaker"
                active={speakerOn}
                onClick={() => setSpeakerOn((s) => !s)}
                icon={speakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
              />
              <CallBtn
                label={held && status === 'paused' ? 'Resume' : 'Hold'}
                active={held}
                disabled={phase !== 'live'}
                onClick={toggleHold}
                icon={held ? <Play size={22} /> : <Pause size={22} />}
              />
              <CallBtn label="Video" dim icon={<Video size={22} />} />
              <CallBtn label="Add call" dim icon={<UserPlus size={22} />} />
            </div>
            {keypad && phase === 'live' && (
              <div className="callphone-keys">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => (
                  <button key={k} onClick={() => dtmf(k)}>{k}</button>
                ))}
              </div>
            )}
            {phase === 'live' ? (
              <button className="callphone-end" onClick={() => endCall(turnsRef.current, false)} aria-label="End call">
                <PhoneOff size={30} />
              </button>
            ) : (
              <div style={{ height: 8 }} />
            )}
            <div className="callphone-foot">
              exchange {Math.min(Math.max(agentTurns, 1), CALL_MAX_TURNS)} of {CALL_MAX_TURNS}
              {phase === 'live' && recorder.error && <div className="err" style={{ marginTop: 8 }}>{recorder.error}</div>}
              {phase === 'live' && !recorder.error && recorder.url === null && status === 'user' && !recorder.recording && (
                <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => recorder.start(30).catch(() => {})}>
                  Enable microphone
                </button>
              )}
              {err && phase === 'live' && <div className="err" style={{ marginTop: 8 }}>{err}</div>}
            </div>
            </div>
          </div>
        </div>
      )}

      {phase === 'ended' && (
            <>
              {grading ? (
                <p className="hint"><span className="spinner" /> Writing your call report…</p>
              ) : grade ? (
                <div className="rev correct" style={{ marginTop: 4 }}>
                  <div className="qnum">
                    ⭐ {grade.marks}/10 • empathy {grade.empathy} • resolution {grade.resolution} • professionalism {grade.professionalism}
                    {grade.estimated ? ' • estimated' : ''}
                  </div>
                  <div className="exp" style={{ marginTop: 6 }}>
                    <b>Coach feedback:</b>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {grade.feedback.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="hint">Call ended — grading unavailable offline.</p>
              )}
              <div className="btnrow" style={{ marginTop: 12 }}>
                <button className="btn-big" onClick={() => resetCall()}>Call again →</button>
              </div>
            </>
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

/** Static fallback — always available offline. Shuffled per session so repeats vary. */
function staticItems(): SessionItem[] {
  return shuffle([
    ...READ_BANK.map((r) => ({ key: `read-${r.id}`, kind: 'read' as const, id: r.id, text: r.text, tip: r.tip, limit: SPEAK_LIMITS.read })),
    ...REPEAT_BANK.map((r) => ({ key: `repeat-${r.id}`, kind: 'repeat' as const, id: r.id, text: r.text, limit: SPEAK_LIMITS.repeat })),
  ]);
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
  // Escape hatch: checked between items so scoring can never trap the page.
  const cancelRef = useRef(false);
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
    // Voice pool tiers are free/pro only — premium shares the pro pool.
    const poolTier = tier === 'premium' ? 'pro' : tier;
    const built: SessionItem[] = [];
    for (const kind of ['read', 'repeat'] as const) {
      const limit = SPEAK_LIMITS[kind];
      const pooled = await fetchUnattemptedSamples(userId, kind, WANT, poolTier);
      for (const p of pooled) {
        built.push({ key: `pool-${p.id}`, kind, id: p.id, text: p.text, tip: p.tip, limit, poolId: p.id });
      }
      const short = WANT - pooled.length;
      if (short > 0) {
        try {
          const fresh = await generateVoiceBatch(kind, short);
          const published = await publishSamples(
            fresh.map((f) => ({ kind, text: f.text, tip: f.tip })),
            poolTier
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
      const bankSource = kind === 'read' ? READ_BANK : REPEAT_BANK;
      const needed = Math.max(0, WANT - have);
      const bank = rotatingSubset(bankSource, needed, `amcat_svar_fallback_${kind}`);
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
    cancelRef.current = false;
    setPhase('scoring');
    setScoring({ done: 0, total: keys.length });
    const reportItems: SpeakingReport['items'] = [];
    // The report ALWAYS builds — per-item race timeouts plus a cancel button
    // mean a hung transcription can delay scoring but never trap the page.
    const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
      Promise.race([p, new Promise<T>((_, rej) => window.setTimeout(() => rej(new Error('Timed out')), ms))]);
    try {
      for (const key of keys) {
        if (cancelRef.current) break;
        const item = items.find((i) => i.key === key);
        if (!item) {
          setScoring((s) => ({ ...s, done: s.done + 1 }));
          continue;
        }
        const rec = recs[key];
        // Fresh recordings are always transcribed fresh; saved reports never re-call.
        let review = null;
        try {
          const { text } = await withTimeout(transcribeAudio(rec.blob), 75_000);
          review = scoreAttempt(item.text, text, rec.secs);
          saveReview(key, review);
        } catch (e) {
          review = null;
        }
        reportItems.push({ key, kind: item.kind, text: item.text, secs: rec.secs, review, poolId: item.poolId });
        setScoring((s) => ({ ...s, done: s.done + 1 }));
      }
    } finally {
      const rep = speakingReportFromItems(
        { userId: userId!, username: profile?.username || (email ? email.split('@')[0] : 'friend') },
        reportItems
      );
      setReport(rep);
      setPhase('report');
      window.scrollTo({ top: 0 });
      // Pool samples scored in this finished session count as completed —
      // unfinished old ones keep coming back until done.
      recordSampleCompletions(
        userId,
        reportItems.filter((i) => i.poolId && i.review).map((i) => i.poolId as string)
      ).catch(() => {});
      saveSpeakingReport(rep)
        .then(() => listSpeakingReports(userId).then(setHistory).catch(() => {}))
        .catch(() => {});
      if (userId) bumpQuota('speaking', userId).catch(() => {});
      refreshQuota();
      bump({ done: readStats().done + 1 });
      setStats(readStats());
    }
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
          {tier !== 'free' ? (
            <span className="chip green">{tier === 'premium' ? 'Premium • unlimited' : 'Pro • unlimited'}</span>
          ) : (
            leftS !== null && <span className="chip green">Free • {leftS} of 5 left</span>
          )}
        </div>
      </div>

      <div className="svar-tabs">
        {(
          [
            ['session', '🎙️ Read & Repeat (Graded)'],
            ['listen', '👂 Listen & Answer'],
            ['short', '⚡ Short Answers'],
            ['jumbled', '🧩 Sentence Builds'],
            ['extempore', '⏱️ Extempore (JAM)'],
            ['mockcall', '📞 Customer Mock Call'],
          ] as Array<[Tab, string]>
        ).map(([t, label]) => (
          <button
            key={t}
            className={`radio-pill ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
            style={{ fontWeight: 600, padding: '8px 14px' }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="banner warn" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {tab === 'listen' && <ListenTab refresh={refresh} />}
      {tab === 'short' && <ShortAnswersTab />}
      {tab === 'jumbled' && <SentenceBuildsTab />}
      {tab === 'extempore' && <ExtemporeTab />}
      {tab === 'mockcall' && <MockCallTab />}

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
            <span className="topic">
              {item.kind === 'read' ? `Read aloud • ${item.limit}s max` : `Repeat after me • ${item.limit}s max`}
            </span>
            {item.kind === 'read' ? (
              <>
                <div className="svar-sentence">“{item.text}”</div>
                {item.tip && <div className="svar-tip"><b>Coach tip:</b> {item.tip}</div>}
              </>
            ) : (
              <>
                <div style={{ marginTop: 8 }}>
                  <PlayButton text={item.text} label="Play sentence audio" onPlayed={() => bump({ plays: readStats().plays + 1 })} />
                </div>
                <div
                  className="svar-sentence"
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: '#9fb0cc',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px dashed var(--border)',
                    borderRadius: 10,
                    padding: '14px 18px',
                    margin: '12px 0',
                  }}
                >
                  🎧 <b>Auditory retention mode:</b> The sentence text is hidden to simulate official SVAR testing. Listen to the audio above, then repeat the exact sentence verbatim into your microphone.
                </div>
                {item.tip && <div className="svar-tip"><b>Coach tip:</b> {item.tip}</div>}
              </>
            )}
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
          <div className="btnrow" style={{ justifyContent: 'center', marginTop: 16, marginBottom: 0 }}>
            <button className="btn-ghost" onClick={() => { cancelRef.current = true; }}>
              Cancel scoring — keep what’s done
            </button>
          </div>
          <p className="hint">Slow connection? Cancel builds the report from finished items only.</p>
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
