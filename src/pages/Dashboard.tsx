import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SECTIONS } from '../types';
import { useSession } from '../stores/session';
import { downloadSpeakingReport } from '../lib/pdf';
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

function chartPath(vals: number[], w: number, h: number, pad: number): { line: string; area: string } {
  if (!vals.length) return { line: '', area: '' };
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 100);
  const span = Math.max(1, max - min);
  const step = vals.length > 1 ? (w - pad * 2) / (vals.length - 1) : 0;
  const pts = vals.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${(pad + (vals.length - 1) * step).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;
  return { line, area };
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
  const { line, area } = chartPath(series.length ? series : [0], 600, 180, 28);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const recent = [...sheets].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  return (
    <div>
      <div className="wv">
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
            <div className="k-label">Sets taken</div>
            <div className="k-value cyan">{stats.count}</div>
            <div className="k-sub">{stats.best !== null ? `best ${stats.best}%` : 'take your first set ↓'}</div>
          </div>
          <div className="wv-card">
            <div className="k-label">Average score</div>
            <div className="k-value">{stats.avg !== null ? `${stats.avg}%` : '—'}</div>
            <div className="k-sub">{stats.count ? `across ${stats.count} sets` : 'no data yet'}</div>
          </div>
          <div className="wv-card">
            <div className="k-label">Day streak</div>
            <div className="k-value" style={{ color: stats.streak >= 2 ? '#32d74b' : '#ffffff' }}>{stats.streak}</div>
            <div className="k-sub">{stats.streak >= 2 ? 'keep it burning' : 'practice today to start one'}</div>
          </div>
        </div>

        <div className="wv-grid">
          <div className="wv-card wv-chart-card">
            <h3>Score trajectory</h3>
            <div className="card-sub">Latest {series.length} sets{live.length ? ' + live simulation' : ''}</div>
            {series.length ? (
              <svg className="wv-chart" viewBox="0 0 600 180" role="img" aria-label="Score trajectory chart">
                <defs>
                  <linearGradient id="wvArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#30D158" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#30D158" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0.25, 0.5, 0.75].map((f) => (
                  <line key={f} x1="28" x2="572" y1={28 + f * 124} y2={28 + f * 124} stroke="#2C2C2E" strokeWidth="1" />
                ))}
                <path d={area} fill="url(#wvArea)" />
                <path d={line} fill="none" stroke="#00E5FF" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="wv-draw" />
                {series.map((v, i) => {
                  const x = series.length > 1 ? 28 + (i / (series.length - 1)) * 544 : 28;
                  const span = Math.max(1, 100 - 0);
                  const y = 152 - (v / span) * 124;
                  return <circle key={i} cx={x} cy={y} r={i === series.length - 1 ? 4.5 : 3} fill={i >= series.length - live.length && live.length ? '#32d74b' : '#00E5FF'} />;
                })}
              </svg>
            ) : (
              <div className="card-sub">No sets yet — your line draws itself here after Set 1.</div>
            )}
            <div className="wv-sim">Simulated live feed for demo • your real scores are the white-blue history.</div>
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
      </div>

      <div className="page-hero" style={{ marginTop: 18 }}>
        <h2>Ready when you are, @{profile?.username || '…'}</h2>
        <p>Each new set is freshly generated — 30 questions, 4 timed sections, every answer explained.</p>
        <div className="hero-cta">
          <button className="btn-big" onClick={() => navigate('/app/instructions')}>Start a new set →</button>
          {tier === 'pro' ? <span className="chip green">PRO • unlimited</span> : null}
        </div>
      </div>

      {speaking.length > 0 && (
        <>
          <h3>Latest speaking reports</h3>
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
