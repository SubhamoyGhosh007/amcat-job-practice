import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Gauge, Zap } from 'lucide-react';
import { SECTIONS } from '../types';
import { useSession } from '../stores/session';
import { downloadSpeakingReport } from '../lib/pdf';
import { ScoreChart } from '../components/ScoreChart';
import { listSpeakingReports, type SpeakingReport } from '../lib/speakingStore';
import type { ScoreSheet } from '../lib/store';

interface Sheet extends ScoreSheet {}

function readSheets(): Sheet[] {
  try {
    const arr = JSON.parse(localStorage.getItem('amcat_sheets') || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function streakOf(sheets: Sheet[]): number {
  const days = new Set(sheets.map((s) => dayKey(s.createdAt)));
  let streak = 0;
  const d = new Date();
  if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d.getTime()))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const userId = useSession((s) => s.userId);
  const profile = useSession((s) => s.profile);
  const tier = useSession((s) => s.profile?.tier ?? 'free');

  const [sheets] = useState<Sheet[]>(() => readSheets());
  const [speaking, setSpeaking] = useState<SpeakingReport[]>([]);
  useEffect(() => {
    listSpeakingReports(userId).then((r) => setSpeaking(r.slice(0, 5))).catch(() => {});
  }, [userId]);

  const stats = useMemo(() => {
    const pcts = sheets.map((s) => s.pct);
    const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
    const best = pcts.length ? Math.max(...pcts) : null;
    const per: Record<string, { c: number; t: number }> = {};
    for (const s of sheets) {
      for (const [id, v] of Object.entries(s.sections || {})) {
        const e = (per[id] ||= { c: 0, t: 0 });
        e.c += v.c;
        e.t += v.t;
      }
    }
    let weakest: { name: string; pct: number } | null = null;
    for (const sec of SECTIONS) {
      const e = per[sec.id];
      if (e && e.t > 0) {
        const p = Math.round((e.c / e.t) * 100);
        if (!weakest || p < weakest.pct) weakest = { name: sec.name, pct: p };
      }
    }
    return { count: sheets.length, avg, best, streak: streakOf(sheets), weakest };
  }, [sheets]);

  // Simulated live feed: random-walk extension of the score line, ticking.
  const base = useMemo(() => sheets.slice(-8).map((s) => s.pct), [sheets]);
  const [live, setLive] = useState<number[]>([]);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => {
      setLive((prev) => {
        const last = prev.length ? prev[prev.length - 1] : base.length ? base[base.length - 1] : 62;
        const next = Math.max(5, Math.min(98, Math.round(last + (Math.random() * 10 - 5))));
        return [...prev.slice(-11), next];
      });
    }, 2500);
    return () => window.clearInterval(t);
  }, [base]);
  const series = [...base, ...live].slice(-14);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const recent = [...sheets].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  return (
    <div>
      <div className="wv" style={{ borderRadius: 16 }}>
        <div className="wv-top">
          <div>
            <h2>Practice dashboard</h2>
            <div className="date">
              {today} • @{profile?.username || '…'}
              {tier === 'pro' ? ' • PRO' : ''}
            </div>
          </div>
          <span className="wv-live"><i /> LIVE SIMULATION</span>
        </div>

        <div className="wv-kpis">
          <div className="wv-card">
            <div className="k-label"><Zap size={13} style={{ verticalAlign: '-2px', marginRight: 6, color: '#00E5FF' }} />Sets taken</div>
            <div className="k-value cyan">{stats.count}</div>
            <div className="k-sub">{stats.best !== null ? `best ${stats.best}%` : 'take your first set ↓'}</div>
          </div>
          <div className="wv-card">
            <div className="k-label"><Gauge size={13} style={{ verticalAlign: '-2px', marginRight: 6, color: '#00E5FF' }} />Average score</div>
            <div className="k-value">{stats.avg !== null ? `${stats.avg}%` : '—'}</div>
            <div className="k-sub">{stats.count ? `across ${stats.count} sets` : 'no data yet'}</div>
          </div>
          <div className="wv-card">
            <div className="k-label"><Flame size={13} style={{ verticalAlign: '-2px', marginRight: 6, color: '#00E5FF' }} />Day streak</div>
            <div className="k-value" style={{ color: stats.streak >= 2 ? '#32d74b' : '#ffffff' }}>{stats.streak}</div>
            <div className="k-sub">{stats.streak >= 2 ? 'keep it burning' : 'practice today to start one'}</div>
          </div>
        </div>

        <div className="wv-grid">
          <div className="wv-card wv-chart-card">
            <h3>Score trajectory</h3>
            <div className="card-sub">Latest {series.length} sets{live.length ? ' + live simulation' : ''}</div>
            {series.length ? (
              <ScoreChart values={series} />
            ) : (
              <div className="card-sub">No sets yet — your line draws itself here after Set 1.</div>
            )}
            <div className="wv-sim">Simulated live feed for demo • your real scores are the history.</div>
          </div>

          <div className="wv-card wv-alerts-card">
            <h3>Alerts</h3>
            <div className="card-sub">What needs you today</div>
            {stats.weakest && stats.weakest.pct < 50 ? (
              <div className="wv-alert">
                <div className="a-title">Weak section: {stats.weakest.name}</div>
                <div className="a-body">Sitting at {stats.weakest.pct}% — one focused set fixes more than three random ones.</div>
              </div>
            ) : (
              <div className="wv-alert ok">
                <div className="a-title">No weak section</div>
                <div className="a-body">Every section is at 50%+ — push for 70s across the board.</div>
              </div>
            )}
            <div className="wv-alert info">
              <div className="a-title">Daily quotas reset midnight</div>
              <div className="a-body">
                {tier === 'pro' ? 'Pro plan: everything unlimited.' : 'Free plan: 5 sets • 10 typing • 5 voice • 1 mock • 1 maths/4h.'}
              </div>
            </div>
            {stats.streak >= 2 && (
              <div className="wv-alert ok">
                <div className="a-title">{stats.streak}-day streak live</div>
                <div className="a-body">One set today keeps it alive.</div>
              </div>
            )}
          </div>
        </div>

        <div className="wv-card">
          <h3>Recent sessions</h3>
          <div className="card-sub">Latest graded sets on this device</div>
          {recent.length ? (
            <table className="wv-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Correct</th>
                  <th>Set</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td>{new Date(s.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                    <td className={`mono ${s.pct >= 70 ? 'green' : s.pct >= 50 ? 'cyan' : 'red'}`}>{s.pct}%</td>
                    <td className="mono">{s.correct}/{s.total}</td>
                    <td style={{ color: '#98989d' }}>{s.difficulty || 'medium'}{s.origin === 'pyq' ? ' • PYQ' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="card-sub">Nothing graded yet.</div>
          )}
        </div>

      <div className="wv-card" style={{ marginTop: 16, marginBottom: 0 }}>
        <h3>Start a new set</h3>
        <div className="card-sub">Ready when you are, @{profile?.username || '…'} — 30 fresh questions, 4 timed sections, every answer explained.</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/app/instructions')}
            style={{ background: '#00E5FF', color: '#121212', fontWeight: 800, border: 'none', borderRadius: 10, padding: '13px 30px', fontSize: 15, cursor: 'pointer' }}
          >
            Start a new set →
          </button>
          {tier === 'pro' ? <span style={{ fontSize: 12, fontWeight: 800, color: '#32d74b' }}>PRO • unlimited</span> : null}
        </div>
      </div>

      {speaking.length > 0 && (
        <div className="wv-card" style={{ marginTop: 16 }}>
          <h3>Latest speaking reports</h3>
          <div className="card-sub">Marks out of 10 per session</div>
          <table className="wv-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Marks</th>
                <th>Items</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {speaking.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                  <td className={`mono ${r.marks >= 7 ? 'green' : r.marks >= 5 ? 'cyan' : 'red'}`}>{r.marks}/10</td>
                  <td className="mono">{r.items.length}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => downloadSpeakingReport(r)}
                      style={{ background: 'transparent', border: '1px solid #2C2C2E', color: '#00E5FF', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </div>
  );
}
