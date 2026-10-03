import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SECTIONS, totalMinutes, totalQuestions } from '../types';
import { describeSource, generateSet } from '../lib/generator';
import { bumpQuota, quotaStatus } from '../lib/usage';
import { useExam } from '../stores/exam';
import { useSession } from '../stores/session';

export default function Instructions() {
  const navigate = useNavigate();
  const start = useExam((s) => s.start);
  const difficulty = useExam((s) => s.difficulty);
  const pyq = useExam((s) => s.pyq);
  const setPrefs = useExam((s) => s.setPrefs);
  const examStyle = useExam((s) => s.examStyle);
  const setExamStyle = useExam((s) => s.setExamStyle);
  const proctored = useExam((s) => s.proctored);
  const setProctored = useExam((s) => s.setProctored);
  const userId = useSession((s) => s.userId);
  const tier = useSession((s) => s.profile?.tier ?? 'free');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [left, setLeft] = useState<number | null>(null);

  async function refreshQuota() {
    if (!userId) {
      setLeft(null);
      return;
    }
    try {
      const q = await quotaStatus('sets', userId, tier);
      setLeft(q.offline ? null : q.remaining);
    } catch {
      setLeft(null);
    }
  }

  useEffect(() => {
    refreshQuota();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function startGeneration() {
    setLoading(true);
    setError('');
    try {
      if (userId) {
        const q = await quotaStatus('sets', userId, tier);
        if (!q.allowed && !q.offline) {
          setError(`Free plan: ${q.limit} new sets per day — back tomorrow. Your history and PDFs stay available.`);
          setLoading(false);
          return;
        }
      }
      const s = await generateSet({ difficulty, pyq, adaptive: examStyle === 'adaptive' });
      start(s);
      if (userId) {
        await bumpQuota('sets', userId);
        refreshQuota();
      }
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
        <h2>How the set runs</h2>
        <p>
          {totalQuestions} questions across {SECTIONS.length} sections in {totalMinutes} minutes. Sections run in order —
          once submitted you cannot go back, like the real AMCAT. The timer auto-submits at 0:00.
          No negative marking, so attempt everything. Finish for the answer script, then a brand-new set.
        </p>
      </div>
      <div className="hover-grid">
        {SECTIONS.map((s) => (
          <div className="hover-card" key={s.id}>
            <div className="glow" />
            <span className="tag">{s.count} Q • {s.minutes} min</span>
            <div className="big display">{s.count}</div>
            <h3>{s.name}</h3>
            <p>{s.description}</p>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ margin: '2px 0 12px' }}>
          <span className="chip green">■ answered</span>{' '}
          <span className="chip" style={{ background: '#ede9fe', color: '#6d28d9' }}>■ marked for review</span>{' '}
          <span className="chip">■ not answered</span>
        </div>
            <div className="field">
              <label>Difficulty</label>
              <div className="radio-row">
                {(['easy', 'medium', 'hard'] as const).map((d) => (
                  <div key={d} className={`radio-pill ${difficulty === d ? 'active' : ''}`} onClick={() => setPrefs({ difficulty: d })} style={{ textTransform: 'capitalize' }}>{d}</div>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Question bank</label>
              <div className="radio-row">
                <div className={`radio-pill ${!pyq ? 'active' : ''}`} onClick={() => setPrefs({ pyq: false })}>✨ Fresh AI</div>
                <div className={`radio-pill ${pyq ? 'active' : ''}`} onClick={() => setPrefs({ pyq: true })}>📜 PYQ papers</div>
              </div>
              <p className="hint">{pyq ? 'Previous-year AMCAT style, recalled from 2021–2024 papers.' : 'Brand-new questions in the exact AMCAT pattern.'} Served from the shared bank if you haven’t attempted one — otherwise freshly generated and shared for others.</p>
            </div>
            <div className="field">
              <label>Exam environment</label>
              <div className="radio-row">
                <div className={`radio-pill ${!proctored ? 'active' : ''}`} onClick={() => setProctored(false)}>📝 Normal</div>
                <div className={`radio-pill ${proctored ? 'active' : ''}`} onClick={() => setProctored(true)}>🎥 Proctored</div>
              </div>
              <p className="hint">{proctored ? 'Camera on, fullscreen locked, tab-switch + face-presence tracking. Flags never affect your score.' : 'Relaxed practice, no monitoring.'}</p>
            </div>
            <div className="field">
              <label>Exam style</label>
              <div className="radio-row">
                <div className={`radio-pill ${examStyle === 'adaptive' ? 'active' : ''}`} onClick={() => setExamStyle('adaptive')}>🎯 Adaptive (real AMCAT)</div>
                <div className={`radio-pill ${examStyle === 'classic' ? 'active' : ''}`} onClick={() => setExamStyle('classic')}>📝 Classic</div>
              </div>
              <p className="hint">{examStyle === 'adaptive' ? 'One big question per screen — answer right and the next gets harder, wrong and it gets easier. No going back, just like the hall.' : 'All questions with palette navigation, mark-for-review and back button.'}</p>
            </div>
            {error && <div className="err">{error}</div>}
        <div className="btnrow">
          <button className="btn-ghost" onClick={() => navigate('/app')}>← Back</button>
          <button className="btn-big" disabled={loading} onClick={startGeneration}>
            {loading ? <><span className="spinner" />Generating fresh set…</> : 'Generate set & start'}
          </button>
        </div>
            <p className="hint">Source: {describeSource()}. If AI fails, the offline bank is used automatically.{left !== null && (tier === 'pro' ? 'Pro plan: unlimited sets.' : <> Free plan: <b>{left} of 5</b> new sets left today.</>)}</p>
      </div>
    </div>
  );
}
