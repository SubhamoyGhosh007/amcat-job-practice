import { useEffect, useRef, useState } from 'react';
import {
  EXTEMPORE_TOPICS,
  JUMBLED_SENTENCES_BANK,
  LISTEN_BANK,
  MOCK_CALL_SCENARIOS,
  READ_BANK,
  REPEAT_BANK,
  SHORT_ANSWER_BANK,
} from '../data/svar';
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

/* ---------------- tab 3: short answers (Versant / SVAR style) ---------------- */
function ShortAnswersTab() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});

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

      {SHORT_ANSWER_BANK.map((item, idx) => {
        const val = answers[item.id] || '';
        const isDone = checked[item.id];
        const normVal = val.toLowerCase().trim();
        const normAns = item.answer.toLowerCase().trim();
        const words = normAns.replace(/[^a-z0-9 ]/g, '').split(' ');
        const isMatch = normVal.length > 0 && words.some((w) => w.length > 2 && normVal.includes(w));

        return (
          <div className="svar-card" key={item.id}>
            <div className="qnum">Question {idx + 1} of {SHORT_ANSWER_BANK.length}</div>
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
  const [activeIdx, setActiveIdx] = useState(0);
  const [builtWords, setBuiltWords] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);

  const curr = JUMBLED_SENTENCES_BANK[activeIdx];
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
    if (activeIdx < JUMBLED_SENTENCES_BANK.length - 1) {
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
          <span className="qnum">Sentence {activeIdx + 1} of {JUMBLED_SENTENCES_BANK.length}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-ghost" disabled={activeIdx === 0} onClick={prev} style={{ padding: '4px 10px', fontSize: 12 }}>← Previous</button>
            <button className="btn-ghost" disabled={activeIdx === JUMBLED_SENTENCES_BANK.length - 1} onClick={next} style={{ padding: '4px 10px', fontSize: 12 }}>Next →</button>
          </div>
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
            <button className="btn-big" onClick={next} disabled={activeIdx === JUMBLED_SENTENCES_BANK.length - 1}>
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
  const [topicIdx, setTopicIdx] = useState(0);
  const [prepLeft, setPrepLeft] = useState<number | null>(null);
  const [prepRunning, setPrepRunning] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const recorder = useRecorder();

  const topic = EXTEMPORE_TOPICS[topicIdx];

  useEffect(() => {
    if (!prepRunning) return;
    setPrepLeft(30);
    const end = Date.now() + 30 * 1000;
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setPrepLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(interval);
        setPrepRunning(false);
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [prepRunning]);

  return (
    <div>
      <TtsGate />
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px' }}>Extempore & Just-A-Minute (JAM) Practice</h3>
        <p className="hint" style={{ margin: 0 }}>
          30 seconds to structure your thoughts, then 45 to 60 seconds to speak without freezing. Follow the proven Concentrix 4-step framework.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {EXTEMPORE_TOPICS.map((t, idx) => (
          <button
            key={idx}
            className={`radio-pill ${topicIdx === idx ? 'active' : ''}`}
            onClick={() => {
              setTopicIdx(idx);
              setPrepRunning(false);
              setPrepLeft(null);
              setShowModel(false);
              recorder.reset();
            }}
          >
            {t.topic}
          </button>
        ))}
      </div>

      <div className="svar-card">
        <span className="topic">Topic #{topicIdx + 1} • Extempore Speech</span>
        <h2 style={{ fontSize: 24, margin: '8px 0 12px', color: '#fff' }}>“{topic.topic}”</h2>

        <div style={{ background: '#122550', borderRadius: 10, padding: '14px 18px', margin: '14px 0', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ color: '#38d98a', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Recommended 4-Step Framework
          </div>
          <div style={{ fontSize: 14.5, color: '#eaf1ff', marginTop: 6, fontWeight: 500 }}>
            {topic.structure}
          </div>
        </div>

        {/* Phase 1: 30s Prep Timer */}
        <div style={{ margin: '18px 0', padding: '14px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <b>Step 1: 30-Second Thinking Timer</b>
              <div className="hint">Take 30 seconds to plan your opening, two points, and one example.</div>
            </div>
            <div>
              {prepLeft === null ? (
                <button className="btn-primary" onClick={() => setPrepRunning(true)}>
                  ⏱️ Start 30s Prep Timer
                </button>
              ) : prepRunning ? (
                <span style={{ fontSize: 20, fontWeight: 800, color: '#f5a623' }}>
                  ⏳ {prepLeft}s thinking...
                </span>
              ) : (
                <span style={{ fontSize: 15, fontWeight: 700, color: '#38d98a' }}>
                  ✅ Prep time finished! Now speak.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Phase 2: Speech Recorder */}
        <div style={{ margin: '18px 0', padding: '14px 18px', borderRadius: 10, border: '1px solid var(--border)' }}>
          <b>Step 2: Record Your Speech (45–60 Seconds)</b>
          <div className="hint" style={{ marginBottom: 12 }}>Speak smoothly at a steady pace. Land word endings clearly.</div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {!recorder.recording ? (
              <button className="btn-big" onClick={() => recorder.start(60)}>
                🎙️ Start speaking ({recorder.url ? 'record again' : 'record'})
              </button>
            ) : (
              <button
                className="btn-big"
                onClick={recorder.stop}
                style={{ background: '#d64545', borderColor: '#d64545' }}
              >
                ⏹️ Stop recording ({recorder.secs}s / 60s)
              </button>
            )}

            {recorder.url && (
              <audio controls src={recorder.url} style={{ height: 38 }} />
            )}
          </div>
          {recorder.error && <div className="err" style={{ marginTop: 8 }}>{recorder.error}</div>}
        </div>

        {/* Step 3: Model comparison */}
        <div style={{ marginTop: 20 }}>
          <button className="btn-ghost" onClick={() => setShowModel(!showModel)}>
            {showModel ? 'Hide Model Answer ▲' : 'Show Coach Model Speech ▼'}
          </button>
          {showModel && (
            <div style={{ marginTop: 12, background: 'rgba(77,124,254,0.08)', border: '1px solid rgba(125,160,255,0.25)', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: 6 }}>Word-for-Word Concentrix Model Speech:</div>
              <p style={{ margin: '0 0 10px', fontStyle: 'italic', fontSize: 15, color: '#eaf1ff', lineHeight: 1.65 }}>
                “{topic.modelAnswer}”
              </p>
              <PlayButton text={topic.modelAnswer} label="Listen to model delivery" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- tab 6: mock call roleplay simulator ---------------- */
function MockCallTab() {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; text: string } | null>(null);

  const scenario = MOCK_CALL_SCENARIOS[scenarioIdx];
  const step = scenario.steps[currentStep];

  function handleSelect(idx: number) {
    if (feedback?.isCorrect) return;
    setSelectedOpt(idx);
    setFeedback(null);
  }

  function submitChoice() {
    if (selectedOpt === null) return;
    const opt = step.agentOptions[selectedOpt];
    setFeedback({ isCorrect: opt.isCorrect, text: opt.feedback });
  }

  function nextStep() {
    setSelectedOpt(null);
    setFeedback(null);
    if (currentStep < scenario.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }

  function resetScenario(idx: number) {
    setScenarioIdx(idx);
    setCurrentStep(0);
    setSelectedOpt(null);
    setFeedback(null);
  }

  const isComplete = currentStep === scenario.steps.length - 1 && feedback?.isCorrect;

  return (
    <div>
      <TtsGate />
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px' }}>Interactive Customer Mock Call Simulation</h3>
        <p className="hint" style={{ margin: 0 }}>
          Real Concentrix support call scenarios. Practice applying the 4-step model (Listen, Empathise, Resolve, Confirm) under live customer interactions.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {MOCK_CALL_SCENARIOS.map((sc, idx) => (
          <button
            key={sc.id}
            className={`radio-pill ${scenarioIdx === idx ? 'active' : ''}`}
            onClick={() => resetScenario(idx)}
          >
            {sc.title}
          </button>
        ))}
      </div>

      <div className="svar-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span className="qnum">Step {currentStep + 1} of {scenario.steps.length}</span>
          <span className="chip ghost">{scenario.title}</span>
        </div>

        {/* Customer bubble */}
        <div style={{ background: '#122550', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '16px 18px', margin: '14px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ color: '#f5a623', fontWeight: 700, fontSize: 13, textTransform: 'uppercase' }}>
              👤 Customer on line
            </span>
            <PlayButton text={step.customer} label="Hear customer voice" />
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#fff', lineHeight: 1.5 }}>
            “{step.customer}”
          </div>
        </div>

        {/* Agent options */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#9fb0cc', marginBottom: 10 }}>
            🎧 Your response as Concentrix Support Agent (Choose the most professional):
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {step.agentOptions.map((opt, i) => (
              <label
                key={i}
                className={`opt ${selectedOpt === i ? 'selected' : ''}`}
                style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  cursor: feedback?.isCorrect ? 'default' : 'pointer',
                  fontSize: 14.5,
                  lineHeight: 1.55,
                }}
              >
                <input
                  type="radio"
                  name="agent-opt"
                  checked={selectedOpt === i}
                  disabled={feedback?.isCorrect}
                  onChange={() => handleSelect(i)}
                />
                <span>{opt.text}</span>
              </label>
            ))}
          </div>

          <div className="btnrow" style={{ marginTop: 16 }}>
            {!feedback?.isCorrect ? (
              <button className="btn-primary" disabled={selectedOpt === null} onClick={submitChoice}>
                Submit Agent Response ✓
              </button>
            ) : isComplete ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ color: '#38d98a', fontWeight: 800 }}>🎉 Call successfully resolved!</span>
                <button className="btn-big" onClick={() => resetScenario((scenarioIdx + 1) % MOCK_CALL_SCENARIOS.length)}>
                  Next Scenario →
                </button>
              </div>
            ) : (
              <button className="btn-big" onClick={nextStep}>
                Customer continues → Next Turn
              </button>
            )}
          </div>

          {feedback && (
            <div className={`rev ${feedback.isCorrect ? 'correct' : 'wrong'}`} style={{ marginTop: 16 }}>
              <div className="qnum">{feedback.isCorrect ? '✅ Excellent Response' : '⚠ Coaching Feedback'}</div>
              <div className="exp" style={{ marginTop: 4, fontSize: 14 }}>{feedback.text}</div>
            </div>
          )}
        </div>
      </div>
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
    const reportItems: SpeakingReport['items'] = [];
    for (const key of keys) {
      const item = items.find((i) => i.key === key);
      if (!item) continue;
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
      reportItems.push({ key, kind: item.kind, text: item.text, secs: rec.secs, review, poolId: item.poolId });
      setScoring((s) => ({ ...s, done: s.done + 1 }));
    }
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
