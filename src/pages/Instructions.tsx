import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SECTIONS, totalMinutes, totalQuestions } from '../types';
import { describeSource, generateSet } from '../lib/generator';
import { friendlyError } from '../lib/friendly';
import { bumpQuota, quotaStatus } from '../lib/usage';
import { useExam } from '../stores/exam';
import { useSession } from '../stores/session';

export default function Instructions() {
  const navigate = useNavigate();
  const start = useExam((s) => s.start);
  const difficulty = useExam((s) => s.difficulty);
  const pyq = useExam((s) => s.pyq);
  const setPrefs = useExam((s) => s.setPrefs);
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
      const s = await generateSet({ difficulty, pyq, adaptive: true });
      start(s);
      if (userId) {
        await bumpQuota('sets', userId);
        refreshQuota();
      }
      navigate('/app/exam');
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-hero">
        <h2>How the set runs</h2>
        <p>
          {totalQuestions} questions across {SECTIONS.length} sections in {totalMinutes} minutes. The whole paper is on one
          page — scroll through English, Quant, Logical and Customer Service (Concentrix) and answer everything at once.
          The timer auto-submits at 0:00. No negative marking, so attempt everything. Finish for the answer script, then a brand-new set.
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
              <label>Exam Mode</label>
              <div className="radio-row">
                <div
                  className={`radio-pill ${useExam.getState().proctored ? 'active' : ''}`}
                  onClick={() => useExam.getState().setProctored(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  🎥 Official AMCAT AI Monitored (Camera + Fullscreen)
                </div>
                <div
                  className={`radio-pill ${!useExam.getState().proctored ? 'active' : ''}`}
                  onClick={() => useExam.getState().setProctored(false)}
                >
                  ⚡ Standard Practice
                </div>
              </div>
              <span className="hint">
                {useExam.getState().proctored
                  ? 'Monitored mode mirrors the official AMCAT testing hall: live webcam face-tracking PIP, no tab-switching, fullscreen lock, and audio monitoring.'
                  : 'Standard mode lets you practice without camera or fullscreen constraints.'}
              </span>
            </div>
            {error && <div className="err">{error}</div>}
        <div className="btnrow">
          <button className="btn-ghost" onClick={() => navigate('/app')}>← Back</button>
          <button className="btn-big" disabled={loading} onClick={startGeneration}>
            {loading ? <><span className="spinner" />Generating fresh set…</> : 'Generate set & start'}
          </button>
        </div>
            <p className="hint">{describeSource().startsWith('offline') ? 'Practice-bank questions, shuffled fresh every attempt.' : 'Fresh AI questions, newly made for every attempt.'}{left !== null && (tier !== 'free' ? `${tier === 'premium' ? 'Premium' : 'Pro'} plan: unlimited sets.` : <> Free plan: <b>{left} of 5</b> new sets left today.</>)}</p>
      </div>
    </div>
  );
}
