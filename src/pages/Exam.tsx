import { useEffect, useMemo, useState } from 'react';
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
    <div>
      <div className="topbar">
        <div><div className="brand">Concentrix AMCAT • {section.name}</div><div className="sub">Set #{activeSet.id} • {activeSet.source}</div></div>
        <div className={`timer ${timeLeft < 60 ? 'danger' : ''}`}>⏱ {mmss}</div>
      </div>
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
