import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { SECTIONS, type Question, type SectionId } from '../types';
import { saveScoreSheet, sheetFromExam } from '../lib/store';
import { recordAttempt } from '../lib/bank';
import { useExam } from '../stores/exam';
import { useSession } from '../stores/session';
import { useConfirm } from '../ui/alert-dialog';

type Tier = 'easy' | 'medium' | 'hard';
const TIERS: Tier[] = ['easy', 'medium', 'hard'];

function tierOf(theta: number): Tier {
  return theta < -0.33 ? 'easy' : theta > 0.33 ? 'hard' : 'medium';
}

function pickNext(pool: Question[], asked: Set<string>, target: Tier): Question | null {
  const rest = pool.filter((q) => !asked.has(q.id));
  if (!rest.length) return null;
  const tierOfQ = (q: Question): Tier => q.difficulty || 'medium';
  const exact = rest.filter((q) => tierOfQ(q) === target);
  if (exact.length) return exact[Math.floor(Math.random() * exact.length)];
  // nearest tier first, then anything left
  const ti = TIERS.indexOf(target);
  const order = [1, -1, 2, -2]
    .map((d) => TIERS[ti + d])
    .filter(Boolean) as Tier[];
  for (const t of order) {
    const cands = rest.filter((q) => tierOfQ(q) === t);
    if (cands.length) return cands[Math.floor(Math.random() * cands.length)];
  }
  return rest[Math.floor(Math.random() * rest.length)];
}

export default function AdaptiveExam() {
  const navigate = useNavigate();
  const ask = useConfirm();
  const activeSet = useExam((s) => s.activeSet);
  const finish = useExam((s) => s.finish);
  const userId = useSession((s) => s.userId);
  const email = useSession((s) => s.email);
  const profile = useSession((s) => s.profile);

  const [sectionIdx, setSectionIdx] = useState(0);
  const [slot, setSlot] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [theta, setTheta] = useState<Record<SectionId, number>>({ english: 0, quant: 0, logical: 0, csat: 0 });
  const [order, setOrder] = useState<string[]>([]);
  const [picked, setPicked] = useState<number | undefined>(undefined);
  const [timeLeft, setTimeLeft] = useState(SECTIONS[0].minutes * 60);

  const section = SECTIONS[sectionIdx];
  const pool: Question[] = useMemo(() => {
    if (!activeSet) return [];
    return activeSet.questions.filter((q) => q.section === section.id);
  }, [activeSet, section]);
  const total = section.count;
  const current: Question | undefined = useMemo(() => {
    const qid = order[slot];
    return qid ? pool.find((q) => q.id === qid) : pool[0];
  }, [order, slot, pool]);

  // section entry: reset ability, deal the opening (medium) question
  useEffect(() => {
    setTheta((t) => ({ ...t, [section.id]: 0 }));
    setSlot(0);
    setPicked(undefined);
    setTimeLeft(section.minutes * 60);
    const first = pickNext(pool, new Set(), 'medium') || pool[0];
    setOrder(first ? [first.id] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIdx]);

  // section timer (auto-submits like the hall)
  useEffect(() => {
    if (!activeSet) return;
    if (timeLeft <= 0) {
      submitSection(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, activeSet]);

  // keyboard: 1-4 / A-D select
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (!current) return;
      const k = e.key.toLowerCase();
      const idx = ['1', '2', '3', '4'].indexOf(k) ?? -1;
      const alpha = ['a', 'b', 'c', 'd'].indexOf(k);
      const at = idx >= 0 ? idx : alpha;
      if (at >= 0 && at < 4) setPicked(at);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [current]);

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

  function dealNext(nextTheta: number, askedIds: string[]) {
    const q = pickNext(pool, new Set(askedIds), tierOf(nextTheta));
    if (!q) {
      submitSection(true);
      return;
    }
    setOrder((o) => [...o, q.id]);
    setSlot((s) => s + 1);
    setPicked(undefined);
  }

  function submitSection(auto = false) {
    const go = () => {
      if (sectionIdx < SECTIONS.length - 1) setSectionIdx((i) => i + 1);
      else finishExam();
    };
    if (auto) {
      go();
      return;
    }
    void (async () => {
      const ok = await ask({
        title: 'Submit this section?',
        description: 'Adaptive sections lock behind you — you cannot return, just like the real AMCAT.',
        actionLabel: 'Submit section',
      });
      if (ok) go();
    })();
  }

  function next() {
    if (!current) {
      submitSection(true);
      return;
    }
    const asked = [...order];
    if (picked !== undefined) {
      const correct = picked === current.answerIndex;
      // CAT update: step shrinks as evidence accumulates
      const n = asked.length;
      const step = 0.6 * Math.pow(0.85, n);
      const t = Math.max(-2.5, Math.min(2.5, (theta[section.id] || 0) + (correct ? step : -step)));
      setTheta((th) => ({ ...th, [section.id]: t }));
      setAnswers((a) => ({ ...a, [current.id]: picked }));
      if (slot + 1 >= total) {
        // section quota filled
        if (sectionIdx < SECTIONS.length - 1) setSectionIdx((i) => i + 1);
        else finishExam();
        return;
      }
      dealNext(t, asked);
    } else {
      // skipped: no ability update, slot still consumed
      if (slot + 1 >= total) {
        if (sectionIdx < SECTIONS.length - 1) setSectionIdx((i) => i + 1);
        else finishExam();
        return;
      }
      dealNext(theta[section.id] || 0, asked);
    }
  }

  if (!activeSet || !current) return <Navigate to="/app" replace />;

  const doneCount = Object.keys(answers).filter((id) => pool.some((q) => q.id === id)).length;

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="brand">Concentrix AMCAT • {section.name}</div>
          <div className="sub">Set #{activeSet.id} • {activeSet.source} • 🎯 adaptive</div>
        </div>
        <div className={`timer ${timeLeft < 60 ? 'danger' : ''}`}>⏱ {mmss}</div>
      </div>
      <div className="wrap adaptive" style={{ maxWidth: '860px' }}>
        <div className="sectabs">
          {SECTIONS.map((s, i) => (
            <span key={s.id} className={`sectab ${i === sectionIdx ? 'active' : ''} ${i < sectionIdx ? 'done' : ''}`}>{i + 1}. {s.name}</span>
          ))}
        </div>
        <div className="card">
          <div className="qnum">
            Question {slot + 1} of {total} • Section {sectionIdx + 1}/{SECTIONS.length} • Answered {doneCount}/{total}
          </div>
          <span className="topic">{current.topic}</span>
          <div className="qprompt">{current.prompt}</div>
          {current.options.map((op, i) => (
            <div
              key={i}
              role="radio"
              aria-checked={picked === i}
              tabIndex={0}
              className={`opt ${picked === i ? 'selected' : ''}`}
              onClick={() => setPicked(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setPicked(i);
                }
              }}
            >
              <span><b>{'ABCD'[i]}.</b> {op}</span>
            </div>
          ))}
          <p className="hint">Keys 1–4 or A–D select • get it right and the next one levels up</p>
          <div className="btnrow">
            <button className="btn-ghost" onClick={() => setPicked(undefined)}>Clear</button>
            {slot + 1 < total ? (
              <button className="btn-primary" onClick={next}>Save & Next →</button>
            ) : (
              <button className="btn-primary" onClick={() => submitSection(false)}>
                {sectionIdx < SECTIONS.length - 1 ? 'Submit section →' : 'Finish exam ✓'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }} aria-hidden>
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className="dot"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: i < slot ? '#1e9e62' : i === slot ? '#1b4fa0' : '#d9e0ea',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
