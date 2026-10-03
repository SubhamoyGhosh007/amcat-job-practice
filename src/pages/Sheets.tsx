import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteScoreSheet, listScoreSheets, type ScoreSheet } from '../lib/store';
import { useConfirm } from '../ui/alert-dialog';
import { PageSkeleton } from '../ui/page-skeleton';
import { useExam } from '../stores/exam';
import { useSession } from '../stores/session';

export default function Sheets() {
  const navigate = useNavigate();
  const userId = useSession((s) => s.userId);
  const email = useSession((s) => s.email);
  const profile = useSession((s) => s.profile);
  const review = useExam((s) => s.review);
  const ask = useConfirm();
  const [sheets, setSheets] = useState<ScoreSheet[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    if (!userId) {
      setSheets([]);
      setLoading(false);
      return;
    }
    setSheets(await listScoreSheets({ userId, email, username: profile?.username || 'you' }));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function dl(kind: 'report' | 'answers', s: ScoreSheet) {
    let m;
    try {
      m = await import('../lib/pdf');
    } catch {
      // Stale tab from before a redeploy: its chunk hashes no longer exist.
      const ok = await ask({
        title: 'Update available',
        description: 'This tab was opened before the latest release, so the PDF engine failed to load. Reload to update?',
        actionLabel: 'Reload now',
      });
      if (ok) location.reload();
      return;
    }
    if (kind === 'report') m.downloadReport(s);
    else m.downloadAnswerSheet(s);
  }

  function onReview(s: ScoreSheet) {
    review(s);
    navigate('/app/result');
  }

  if (loading) return <PageSkeleton variant="list" />;
  if (!sheets.length)
    return (
      <div className="page-hero">
        <h2>No score sheets yet</h2>
        <p>Finish an exam and it lands here automatically — browser + cloud. Every new set stays fresh, so history never repeats.</p>
      </div>
    );

  const best = Math.max(...sheets.map((s) => s.pct));
  const avg = Math.round(sheets.reduce((a, s) => a + s.pct, 0) / sheets.length);

  return (
    <div>
      <div className="page-hero">
        <h2>{sheets.length} attempts • best {best}% • average {avg}%</h2>
        <p>Every sheet below opens its full answer script — or grab it as a PDF.</p>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', marginTop: 14, height: 56 }}>
          {sheets.slice(0, 20).reverse().map((s) => (
            <div key={s.id} title={`${s.pct}%`} style={{ flex: 1, background: s.pct >= 70 ? '#38d98a' : s.pct >= 50 ? '#eab308' : '#f06666', height: `${Math.max(6, s.pct * 0.5)}px`, borderRadius: 3 }} />
          ))}
        </div>
      </div>
      {sheets.map((s) => (
        <div className="sheet" key={s.id}>
          <div className="ring" style={{ '--p': s.pct } as any}><span>{s.pct}%</span></div>
          <div className="meta">
            <div style={{ fontWeight: 700 }}>{s.correct}/{s.total} correct • {new Date(s.createdAt).toLocaleString()}</div>
            <div className="hint">Set {s.setId} • {s.source}</div>
            <div>{[<span key="d" className="chip">{s.difficulty || 'medium'}</span>, <span key="o" className="chip">{(s.origin || 'offline') === 'pyq' ? 'PYQ papers' : (s.origin || 'offline')}</span>, ...Object.values(s.sections).map((x) => <span key={x.name} className="chip">{x.name.split(' ')[0]} {x.c}/{x.t}</span>)]}</div>
          </div>
          <div className="btnrow" style={{ marginTop: 0 }}>
            <button className="btn-ghost" onClick={() => onReview(s)}>Review</button>
            <button className="btn-ghost" onClick={() => dl('report', s)}>Report PDF</button>
            <button className="btn-ghost" onClick={() => dl('answers', s)}>Q&A PDF</button>
            <button className="btn-ghost" onClick={async () => {
              const ok = await ask({
                title: 'Delete this score sheet?',
                description: 'It will be removed here and in the cloud. This cannot be undone.',
                actionLabel: 'Delete',
                danger: true,
              });
              if (ok) {
                await deleteScoreSheet(s);
                load();
              }
            }}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
