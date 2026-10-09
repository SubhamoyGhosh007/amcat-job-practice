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
          <CartesianGrid stroke="#e7e9ed" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="i"
            tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
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
                    background: '#ffffff',
                    border: '1px solid #e7e9ed',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                    boxShadow: '0 6px 18px rgba(17,17,17,0.08)',
                  }}
                >
                  <span style={{ color: '#3157d8', fontFamily: 'JetBrains Mono, monospace' }}>{payload[0].value}%</span>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke="#3157d8"
            strokeWidth={2.5}
            fill="url(#wvScoreArea)"
            dot={false}
            activeDot={{ r: 4.5, fill: '#3157d8', stroke: '#ffffff', strokeWidth: 2 }}
            isAnimationActive={!reduced}
            animationDuration={1400}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
