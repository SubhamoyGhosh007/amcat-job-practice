import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/** EvilCharts-style area chart in WattVision tokens: cyan line, green area wash. */
export function ScoreChart({ values }: { values: number[] }) {
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
          <CartesianGrid stroke="#2C2C2E" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="i"
            tick={{ fill: '#98989D', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#98989D', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
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
                    background: '#1E1E1E',
                    border: '1px solid #2C2C2E',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ color: '#00E5FF', fontFamily: 'JetBrains Mono, monospace' }}>{payload[0].value}%</span>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke="#00E5FF"
            strokeWidth={2.5}
            fill="url(#wvScoreArea)"
            dot={false}
            activeDot={{ r: 4.5, fill: '#00E5FF', stroke: '#121212', strokeWidth: 2 }}
            isAnimationActive={!reduced}
            animationDuration={1400}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
