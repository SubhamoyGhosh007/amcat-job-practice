import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SECTIONS, totalMinutes, totalQuestions } from '../types';
import { useSession } from '../stores/session';
import { downloadSpeakingReport } from '../lib/pdf';
import { listSpeakingReports, type SpeakingReport } from '../lib/speakingStore';

export default function Dashboard() {
  const navigate = useNavigate();
  const userId = useSession((s) => s.userId);
  const profile = useSession((s) => s.profile);
  const tier = useSession((s) => s.profile?.tier ?? 'free');
  const syncNote = useSession((s) => s.syncNote);
  const dismissSyncNote = useSession((s) => s.dismissSyncNote);
  const [history] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('amcat_scores') || '[]');
    } catch {
      return [];
    }
  });
  const [speaking, setSpeaking] = useState<SpeakingReport[]>([]);
  useEffect(() => {
    listSpeakingReports(userId).then((r) => setSpeaking(r.slice(0, 5))).catch(() => {});
  }, [userId]);

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
              {tier === 'pro' ? <span className="chip green">PRO • unlimited</span> : null}
          <span className="hint">{totalQuestions} Q • {totalMinutes} min • fresh questions every set</span>
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
      {speaking.length > 0 && (
        <>
          <h3 style={{ marginTop: 18 }}>Latest speaking reports</h3>
          {speaking.map((r) => (
            <div className="t-row" key={r.id}>
              <div className="ring" style={{ '--p': r.marks * 10 } as any}><span>{r.marks}</span></div>
              <div className="meta">
                <div style={{ fontWeight: 700 }}>{r.marks}/10 • {r.items.length} items</div>
                <div className="hint">{new Date(r.at).toLocaleString()}</div>
              </div>
              <div className="btnrow" style={{ marginTop: 0 }}>
                <button className="btn-ghost" onClick={() => navigate('/app/speaking')}>Open lab</button>
                <button className="btn-ghost" onClick={() => downloadSpeakingReport(r)}>PDF</button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
