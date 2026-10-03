import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { SECTIONS, type Question } from '../types';
import { saveScoreSheet, sheetFromExam } from '../lib/store';
import { recordAttempt } from '../lib/bank';
import { useConfirm } from '../ui/alert-dialog';
import { useExam } from '../stores/exam';
import { useSession } from '../stores/session';

export default function Exam() {
  const navigate = useNavigate();
  const activeSet = useExam((s) => s.activeSet);
  const finish = useExam((s) => s.finish);
  const proctored = useExam((s) => s.proctored);
  const violations = useExam((s) => s.violations);
  const logViolation = useExam((s) => s.logViolation);
  const setProctored = useExam((s) => s.setProctored);
  const userId = useSession((s) => s.userId);
  const email = useSession((s) => s.email);
  const profile = useSession((s) => s.profile);
  const ask = useConfirm();

  const [sectionIdx, setSectionIdx] = useState(0);
  const [qPos, setQPos] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(SECTIONS[0].minutes * 60);

  const section = SECTIONS[sectionIdx];
  const sectionQs: Question[] = useMemo(() => {
    if (!activeSet) return [];
    return activeSet.questions.filter((q) => q.section === section.id);
  }, [activeSet, section]);
  const currentQ = sectionQs[qPos];

  useEffect(() => {
    setTimeLeft(section.minutes * 60);
    setQPos(0);
  }, [sectionIdx, section.minutes]);

  useEffect(() => {
    if (!activeSet) return;
    if (timeLeft <= 0) {
      handleSubmitSection(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, activeSet]);

  const mmss = `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`;

  const [camError, setCamError] = useState(false);
  const [noFullscreen, setNoFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Proctoring: camera PiP + fullscreen lock + focus tracking. All on-device.
  useEffect(() => {
    if (!proctored) return;
    let alive = true;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 } }, audio: false });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
      } catch {
        if (alive) setCamError(true);
      }
    })();
    try {
      const p = document.documentElement.requestFullscreen() as any;
      if (p && p.catch) p.catch(() => alive && setNoFullscreen(true));
    } catch {
      setNoFullscreen(true);
    }
    setNoFullscreen(!document.fullscreenElement);
    const onFs = () => setNoFullscreen(!document.fullscreenElement);
    const onVis = () => {
      if (document.hidden) logViolation({ type: 'tab-switch', at: Date.now() });
    };
    const onBlur = () => logViolation({ type: 'window-blur', at: Date.now() });
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    return () => {
      alive = false;
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      stream?.getTracks().forEach((t) => t.stop());
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proctored]);

  // Face-presence AI (MediaPipe, on-device, lazy-loaded). Fails soft offline.
  useEffect(() => {
    if (!proctored || camError) return;
    let stop = false;
    let timer = 0;
    let detector: any = null;
    let absent = 0;
    (async () => {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const resolver = await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        if (stop) return;
        detector = await vision.FaceDetector.createFromOptions(resolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
            delegate: 'CPU',
          },
          runningMode: 'IMAGE',
        });
        const tick = () => {
          if (stop) return;
          try {
            const v = videoRef.current;
            if (v && v.readyState >= 2 && v.videoWidth > 0 && detector) {
              const n = detector.detect(v).detections.length;
              if (n === 0) {
                absent += 1;
                if (absent === 2) logViolation({ type: 'no-face', at: Date.now() });
              } else {
                absent = 0;
                if (n > 1) logViolation({ type: 'multiple-faces', at: Date.now() });
              }
            }
          } catch {
            /* transient frame — skip */
          }
          timer = window.setTimeout(tick, 2500);
        };
        tick();
      } catch {
        /* offline or blocked CDN — deterministic checks continue without face AI */
      }
    })();
    return () => {
      stop = true;
      window.clearTimeout(timer);
      try {
        detector?.close();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proctored, camError]);

  function owner() {
    return {
      userId: userId!,
      email: email || '',
      username: profile?.username || (email ? email.split('@')[0] : 'friend'),
    };
  }

  function finishExam() {
    if (!activeSet) return;
    const correct = activeSet.questions.filter((q) => answers[q.id] === q.answerIndex).length;
    const pct = Math.round((correct / activeSet.questions.length) * 100);
    try {
      const h: number[] = JSON.parse(localStorage.getItem('amcat_scores') || '[]');
      localStorage.setItem('amcat_scores', JSON.stringify([...h, pct].slice(-10)));
    } catch {
      /* ignore */
    }
    const sh = sheetFromExam(owner(), activeSet, answers);
    finish(sh, answers);
    saveScoreSheet(sh).catch(() => {});
    recordAttempt(userId, activeSet.id, sh.correct, sh.total, sh.pct).catch(() => {});
    navigate('/app/result');
  }

  async   function blockClipboard(e: React.SyntheticEvent) {
    e.preventDefault();
    if (proctored && (e.type === 'paste' || e.type === 'cut')) {
      logViolation({ type: 'clipboard', at: Date.now() });
    }
  }

  async function handleSubmitSection(auto = false) {
    if (!auto) {
      const ok = await ask({
        title: 'Submit this section?',
        description: 'You cannot return to it afterwards — just like the real AMCAT.',
        actionLabel: 'Submit section',
      });
      if (!ok) return;
    }
    if (sectionIdx < SECTIONS.length - 1) {
      setSectionIdx((i) => i + 1);
    } else {
      finishExam();
    }
  }

  if (!activeSet || !currentQ) return <Navigate to="/app" replace />;

  const answeredCount = sectionQs.filter((q) => answers[q.id] !== undefined).length;

  return (
    <div
      onCopy={blockClipboard}
      onCut={blockClipboard}
      onPaste={blockClipboard}
      onContextMenu={blockClipboard}
    >
      <div className="topbar">
        <div><div className="brand">Concentrix AMCAT • {section.name}</div><div className="sub">Set #{activeSet.id} • {activeSet.source}{proctored ? ' • 🎥 proctored' : ''}</div></div>
        <div className={`timer ${timeLeft < 60 ? 'danger' : ''}`}>⏱ {mmss}</div>
        {proctored && violations.length > 0 && <div className="timer danger">⚠ {violations.length}</div>}
      </div>
      {proctored && (
        <>
          {!camError && <video ref={videoRef} muted playsInline autoPlay className="proc-cam" />}
          {camError && (
            <div className="wrap" style={{ maxWidth: '1100px', paddingBottom: 0 }}>
              <div className="banner warn">Camera blocked — proctoring needs it. Allow camera access, or <button onClick={() => setProctored(false)} style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 800, cursor: 'pointer', padding: 0 }}>continue without proctoring</button>.</div>
            </div>
          )}
          {noFullscreen && !camError && (
            <div className="wrap" style={{ maxWidth: '1100px', paddingBottom: 0 }}>
              <div className="banner warn">Fullscreen is required for proctored mode. <button onClick={() => document.documentElement.requestFullscreen().catch(() => {})} style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 800, cursor: 'pointer', padding: 0 }}>Go fullscreen →</button></div>
            </div>
          )}
        </>
      )}
      <div className="wrap" style={{ maxWidth: '1100px' }}>
        <div className="sectabs">
          {SECTIONS.map((s, i) => (
            <span key={s.id} className={`sectab ${i === sectionIdx ? 'active' : ''} ${i < sectionIdx ? 'done' : ''}`}>{i + 1}. {s.name}</span>
          ))}
        </div>
        <div className="examgrid">
          <div className="card">
            <div className="qnum">Question {qPos + 1} of {sectionQs.length} • Section {sectionIdx + 1}/{SECTIONS.length} • Answered {answeredCount}/{sectionQs.length}</div>
            <span className="topic">{currentQ.topic}</span>
            <div className="qprompt">{currentQ.prompt}</div>
            {currentQ.options.map((op, i) => (
              <label key={i} className={`opt ${answers[currentQ.id] === i ? 'selected' : ''}`}>
                <input type="radio" name={currentQ.id} checked={answers[currentQ.id] === i}
                  onChange={() => setAnswers((a) => ({ ...a, [currentQ.id]: i }))} />
                <span><b>{'ABCD'[i]}.</b> {op}</span>
              </label>
            ))}
            <div className="btnrow">
              <button className="btn-ghost" disabled={qPos === 0} onClick={() => setQPos((p) => p - 1)}>← Previous</button>
              <button className="btn-ghost" onClick={() => setAnswers((a) => { const n = { ...a }; delete n[currentQ.id]; return n; })}>Clear</button>
              <button className="btn-ghost" onClick={() => setMarked((m) => ({ ...m, [currentQ.id]: !m[currentQ.id] }))}>
                {marked[currentQ.id] ? 'Unmark' : 'Mark for review'}
              </button>
              {qPos < sectionQs.length - 1
                ? <button className="btn-primary" onClick={() => setQPos((p) => p + 1)}>Save & Next →</button>
                : <button className="btn-primary" onClick={() => handleSubmitSection(false)}>
                  {sectionIdx < SECTIONS.length - 1 ? 'Submit section →' : 'Finish exam ✓'}
                </button>}
            </div>
          </div>
          <div className="card">
            <b style={{ fontSize: 13 }}>Question palette</b>
            <div className="palette">
              {sectionQs.map((q, i) => {
                const cls = ['pal'];
                if (i === qPos) cls.push('current');
                if (answers[q.id] !== undefined) cls.push('answered');
                else if (marked[q.id]) cls.push('marked');
                return <button key={q.id} className={cls.join(' ')} onClick={() => setQPos(i)}>{i + 1}</button>;
              })}
            </div>
            <div className="legend">
              <div><span className="dot" style={{ background: '#1e9e62' }} />Answered</div>
              <div><span className="dot" style={{ background: '#7c3aed' }} />Marked for review</div>
              <div><span className="dot" style={{ background: '#f2f4f8', border: '1px solid #d9e0ea' }} />Not answered</div>
            </div>
            <div className="btnrow">
              <button className="btn-ghost" style={{ width: '100%' }} onClick={() => handleSubmitSection(false)}>
                {sectionIdx < SECTIONS.length - 1 ? 'Submit section' : 'Finish exam'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
