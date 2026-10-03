import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { SECTIONS } from '../types';
import { generateSet } from '../lib/generator';
import { bumpQuota, quotaStatus } from '../lib/usage';
import { useExam } from '../stores/exam';
import { useSession } from '../stores/session';

export default function Result() {
  const navigate = useNavigate();
  const activeSet = useExam((s) => s.activeSet);
  const activeAnswers = useExam((s) => s.activeAnswers);
  const lastSheet = useExam((s) => s.lastSheet);
  const start = useExam((s) => s.start);
  const difficulty = useExam((s) => s.difficulty);
  const pyq = useExam((s) => s.pyq);
  const violations = useExam((s) => s.violations);
  const userId = useSession((s) => s.userId);
  const tier = useSession((s) => s.profile?.tier ?? 'free');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const answers = activeAnswers;
  const set = activeSet;

  const score = useMemo(() => {
    if (!set) return { correct: 0, pct: 0 };
    const correct = set.questions.filter((q) => answers[q.id] === q.answerIndex).length;
    return { correct, pct: Math.round((correct / set.questions.length) * 100) };
  }, [set, answers]);

  if (!set || !lastSheet) return <Navigate to="/app" replace />;
  const sheet = lastSheet;

  async function dlPdf(kind: 'report' | 'answers') {
    const m = await import('../lib/pdf');
    if (kind === 'report') m.downloadReport(sheet);
    else m.downloadAnswerSheet(sheet);
  }

  async function startGeneration() {
    setLoading(true);
    setError('');
    try {
      if (userId) {
        const q = await quotaStatus('sets', userId, tier);
        if (!q.allowed && !q.offline) {
          setError(`Free plan: ${q.limit} new sets per day — back tomorrow.`);
          setLoading(false);
          return;
        }
      }
      const s = await generateSet({ difficulty, pyq });
      start(s);
      if (userId) await bumpQuota('sets', userId);
      navigate('/app/exam');
    } catch (e: any) {
      setError(e?.message || 'Failed to generate set. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-hero">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="ring dark" style={{ '--p': score.pct } as any}><span>{score.pct}%</span></div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2>{score.pct >= 70 ? 'Test-hall ready 🎉' : score.pct >= 50 ? 'Getting there' : 'Keep practising'}</h2>
                <p>Set #{set.id} • {set.source} • {sheet.difficulty || 'medium'} • {(sheet.origin || 'offline') === 'pyq' ? 'PYQ papers' : (sheet.origin || 'offline')} • {new Date(set.createdAt).toLocaleString()} • {score.correct} correct out of {set.questions.length}</p>
            <div style={{ marginTop: 8 }}>
              {SECTIONS.map((s) => {
                const qs = set.questions.filter((q) => q.section === s.id);
                const c = qs.filter((q) => answers[q.id] === q.answerIndex).length;
                const cls = c === qs.length ? 'chip green' : c * 2 >= qs.length ? 'chip amber' : 'chip red';
                return <span key={s.id} className={cls}>{s.name} {c}/{qs.length}</span>;
              })}
            </div>
          </div>
        </div>
        <div className="hero-cta">
          <button className="btn-big" disabled={loading} onClick={startGeneration}>
            {loading ? <><span className="spinner" />Generating new set…</> : '🔄 Practice new set'}
          </button>
          <button className="btn-ghost" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', borderColor: 'transparent' }} onClick={() => dlPdf('report')}>⬇ Report PDF</button>
          <button className="btn-ghost" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', borderColor: 'transparent' }} onClick={() => dlPdf('answers')}>⬇ Q&A + notes PDF</button>
          <button className="btn-ghost" style={{ background: 'transparent', color: '#9fb0cc', borderColor: 'transparent' }} onClick={() => navigate('/app')}>← Home</button>
        </div>
        {error && <div className="err" style={{ marginTop: 10 }}>{error}</div>}
        <p className="hint" style={{ marginTop: 10 }}>Score sheet saved to browser + cloud ✓ — find it under My sheets.</p>
      </div>
      {violations.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <b>🎥 Proctoring flags: {violations.length}</b>
          <p className="hint">Practice integrity only — flags never change your score.</p>
          <div>
            {violations.map((v, i) => (
              <span key={i} className="chip amber">
                {{ 'tab-switch': 'Left the tab', 'window-blur': 'Window lost focus', 'no-face': 'No face in camera', 'multiple-faces': 'Multiple faces', clipboard: 'Copy/paste blocked' }[v.type] || v.type}
                {' '}• {new Date(v.at).toLocaleTimeString()}
              </span>
            ))}
          </div>
        </div>
      )}
      <h3>Answer script — every question with explanation</h3>
      {set.questions.map((q, i) => {
        const mine = answers[q.id];
        const ok = mine === q.answerIndex;
        return (
          <div key={q.id} className={`rev ${ok ? 'correct' : 'wrong'}`}>
            <div className="qnum">Q{i + 1} • {SECTIONS.find((s) => s.id === q.section)?.name} • {q.topic} • {ok ? '✅ Correct' : '❌ Wrong'}</div>
            <div style={{ fontWeight: 600 }}>{q.prompt}</div>
            <div style={{ marginTop: 8, fontSize: 14 }}>
              {q.options.map((op, oi) => (
                <div key={oi} style={{
                  padding: '4px 0',
                  color: oi === q.answerIndex ? '#1e9e62' : oi === mine ? '#d64545' : undefined,
                  fontWeight: oi === q.answerIndex || oi === mine ? 700 : 400,
                }}>
                  {'ABCD'[oi]}. {op} {oi === q.answerIndex ? '← correct' : oi === mine ? '← your answer' : ''}
                </div>
              ))}
            </div>
            <div className="exp"><b>Why:</b> {q.explanation}</div>
          </div>
        );
      })}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="btnrow" style={{ justifyContent: 'center' }}>
          <button className="btn-big" disabled={loading} onClick={startGeneration}>
            {loading ? 'Generating…' : '🔄 New set — practise again'}
          </button>
        </div>
      </div>
      <p className="footer-note">Tip: each new set uses a fresh random seed and avoids recent questions, so it never repeats.</p>
    </div>
  );
}
