import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { SECTIONS, totalMinutes } from '../types';
import { saveScoreSheet, sheetFromExam } from '../lib/store';
import { recordAttempt } from '../lib/bank';
import { useExam } from '../stores/exam';
import { useSession } from '../stores/session';
import { useConfirm } from '../ui/alert-dialog';

export default function AdaptiveExam() {
  const navigate = useNavigate();
  const ask = useConfirm();
  const activeSet = useExam((s) => s.activeSet);
  const finish = useExam((s) => s.finish);
  const userId = useSession((s) => s.userId);
  const email = useSession((s) => s.email);
  const profile = useSession((s) => s.profile);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(totalMinutes * 60);

  const grouped = useMemo(() => {
    if (!activeSet) return [];
    return SECTIONS.map((s) => ({
      meta: s,
      questions: activeSet.questions.filter((q) => q.section === s.id),
    })).filter((g) => g.questions.length > 0);
  }, [activeSet]);

  const total = activeSet?.questions.length ?? 0;
  const answered = Object.keys(answers).length;

  // whole-paper timer (auto-submits like the hall)
  useEffect(() => {
    if (!activeSet) return;
    if (timeLeft <= 0) {
      finishExam();
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, activeSet]);

  const mmss = `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`;

  const fsSupported = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
  const [fsOn, setFsOn] = useState(!!document.fullscreenElement);
  const [fsDismissed, setFsDismissed] = useState(false);

  useEffect(() => {
    const onFs = () => setFsOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    setFsOn(!!document.fullscreenElement);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  function goFs() {
    try {
      const p = document.documentElement.requestFullscreen() as any;
      if (p && p.catch) p.catch(() => {});
    } catch {
      /* unsupported */
    }
  }

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

  function submitAll() {
    const unanswered = total - answered;
    void (async () => {
      const ok = await ask({
        title: 'Finish the whole paper?',
        description:
          unanswered > 0
            ? `${unanswered} of ${total} questions are still unanswered. No negative marking — submit anyway?`
            : `All ${total} questions answered. Submit for your score + answer script?`,
        actionLabel: 'Finish exam',
      });
      if (ok) finishExam();
    })();
  }

  function pick(qid: string, i: number) {
    setAnswers((a) => ({ ...a, [qid]: i }));
  }

  function clear(qid: string) {
    setAnswers((a) => {
      const n = { ...a };
      delete n[qid];
      return n;
    });
  }

  if (!activeSet) return <Navigate to="/app" replace />;

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="brand">Concentrix AMCAT • Full paper</div>
          <div className="sub">
            Set #{activeSet.id} • {activeSet.source} • answered {answered}/{total}
          </div>
        </div>
        <div className={`timer ${timeLeft < 60 ? 'danger' : ''}`}>⏱ {mmss}</div>
      </div>
      {fsSupported && !fsOn && !fsDismissed && (
        <div className="wrap adaptive" style={{ maxWidth: '860px', paddingBottom: 0 }}>
          <div className="banner warn">
            Fullscreen gives the real hall feel.{' '}
            <button onClick={goFs} style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 800, cursor: 'pointer', padding: 0 }}>Go fullscreen →</button>{' '}
            <button onClick={() => setFsDismissed(true)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>✕</button>
          </div>
        </div>
      )}
      <div className="wrap adaptive" style={{ maxWidth: '860px' }}>
        <div className="sectabs">
          {grouped.map((g, i) => {
            const done = g.questions.filter((q) => answers[q.id] !== undefined).length;
            return (
              <a key={g.meta.id} className="sectab" href={`#sec-${g.meta.id}`} style={{ textDecoration: 'none' }}>
                {i + 1}. {g.meta.name} • {done}/{g.questions.length}
              </a>
            );
          })}
        </div>

        {grouped.map((g) => (
          <div key={g.meta.id} id={`sec-${g.meta.id}`} style={{ scrollMarginTop: 90 }}>
            <div className="card" style={{ background: 'linear-gradient(135deg,#0b1e4b,#1b4fa0)', color: '#fff', border: 'none' }}>
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                {g.meta.count} Q • {g.meta.minutes} min guide
              </div>
              <h2 style={{ margin: '4px 0' }}>{g.meta.name}</h2>
              <div style={{ opacity: 0.85, fontSize: 13.5 }}>{g.meta.description}</div>
            </div>
            {g.questions.map((q, qi) => (
              <div className="card" key={q.id}>
                <div className="qnum">
                  {g.meta.name} • Q{qi + 1} of {g.questions.length}
                </div>
                <span className="topic">{q.topic}</span>
                <div className="qprompt">{q.prompt}</div>
                {q.options.map((op, i) => (
                  <div
                    key={i}
                    role="radio"
                    aria-checked={answers[q.id] === i}
                    tabIndex={0}
                    className={`opt ${answers[q.id] === i ? 'selected' : ''}`}
                    onClick={() => pick(q.id, i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        pick(q.id, i);
                      }
                    }}
                  >
                    <span><b>{'ABCD'[i]}.</b> {op}</span>
                  </div>
                ))}
                <div className="btnrow" style={{ marginBottom: 0 }}>
                  <button className="btn-ghost" onClick={() => clear(q.id)}>Clear</button>
                </div>
              </div>
            ))}
          </div>
        ))}

        <div className="card" style={{ textAlign: 'center', position: 'sticky', bottom: 12 }}>
          <div style={{ fontWeight: 700 }}>
            Answered {answered}/{total} • {timeLeft > 0 ? `${mmss} left` : 'time up'}
          </div>
          <p className="hint">No negative marking — attempt everything, then finish once.</p>
          <button className="btn-big" onClick={submitAll}>Finish exam ✓</button>
        </div>
      </div>
    </div>
  );
}
