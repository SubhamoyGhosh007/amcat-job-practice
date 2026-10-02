import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SECTIONS, totalMinutes, totalQuestions } from '../types';
import { describeSource } from '../lib/generator';
import { useSession } from '../stores/session';

export default function Dashboard() {
  const navigate = useNavigate();
  const profile = useSession((s) => s.profile);
  const syncNote = useSession((s) => s.syncNote);
  const dismissSyncNote = useSession((s) => s.dismissSyncNote);
  const [history] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('amcat_scores') || '[]');
    } catch {
      return [];
    }
  });

  const best = history.length ? Math.max(...history) : null;
  const avg = history.length ? Math.round(history.reduce((a, b) => a + b, 0) / history.length) : null;

  return (
    <div>
      {syncNote && (
        <div className="banner warn" style={{ marginBottom: 12 }}>
          {syncNote}{' '}
          <button onClick={dismissSyncNote} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>
            Dismiss
          </button>
        </div>
      )}
      <div className="page-hero">
        <h2>Ready when you are, @{profile?.username || '…'}</h2>
        <p>
          {best !== null
            ? `${history.length} sets taken • best ${best}% • average ${avg}% — each new set is freshly generated, never repeated.`
            : 'Your first set is freshly generated — 30 questions, 4 timed sections, every answer explained.'}
        </p>
        <div className="hero-cta">
          <button className="btn-big" onClick={() => navigate('/app/instructions')}>Start a new set →</button>
          <span className="hint">{totalQuestions} Q • {totalMinutes} min • {describeSource()}</span>
        </div>
      </div>
      <div className="hover-grid">
        {SECTIONS.map((s) => (
          <div className="hover-card" key={s.id}>
            <div className="glow" />
            <span className="tag">{s.count} Q • {s.minutes} min</span>
            <h3>{s.name}</h3>
            <p>{s.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
