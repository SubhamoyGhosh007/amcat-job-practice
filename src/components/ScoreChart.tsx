import { useState } from 'react';
import { useUi } from '../stores/ui';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/** EvilCharts-style area chart; follows the app light/dark theme. */
export function ScoreChart({ values }: { values: number[] }) {
  useUi((s) => s.theme);
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const grid = dark ? '#2C2C2E' : '#e7e9ed';
  const tick = dark ? '#98989D' : '#6b7280';
  const line = dark ? '#00E5FF' : '#3157d8';
  const tipBg = dark ? '#1E1E1E' : '#ffffff';
  const tipBorder = dark ? '#2C2C2E' : '#e7e9ed';
  const dotRing = dark ? '#121212' : '#ffffff';
  const [reduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const data = values.map((v, i) => ({ i: `S${i + 1}`, v }));
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="wvScoreArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#30D158" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#30D158" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={grid} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="i"
            tick={{ fill: tick, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: tick, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              return (
                <div
                  style={{
                    background: tipBg,
                    border: `1px solid ${tipBorder}`,
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                    boxShadow: '0 6px 18px rgba(17,17,17,0.08)',
                  }}
                >
                  <span style={{ color: line, fontFamily: 'JetBrains Mono, monospace' }}>{payload[0].value}%</span>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={line}
            strokeWidth={2.5}
            fill="url(#wvScoreArea)"
            dot={false}
            activeDot={{ r: 4.5, fill: line, stroke: dotRing, strokeWidth: 2 }}
            isAnimationActive={!reduced}
            animationDuration={1400}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
