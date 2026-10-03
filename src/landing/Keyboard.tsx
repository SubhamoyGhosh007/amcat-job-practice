import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/** Typing-arena teaser: keys light up in a rolling wave. Real test plugs in here later. */
export default function Keyboard() {
  const reduce = useReducedMotion();
  const [lit, setLit] = useState(-1);
  const total = ROWS.join('').length;
  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const t = window.setInterval(() => {
      i = (i + 1) % (total + 10);
      setLit(i < total ? i : -1);
    }, 130);
    return () => window.clearInterval(t);
  }, [reduce, total]);
  let k = 0;
  return (
    <div className="kbd-wrap">
      {ROWS.map((row, ri) => (
        <div className="kbd-row" key={ri}>
          {row.split('').map((ch) => {
            const idx = k++;
            return (
              <div key={idx} className={`kbd-key${lit === idx ? ' lit' : ''}`}>
                {ch}
              </div>
            );
          })}
        </div>
      ))}
      <div className="kbd-row">
        <div className="kbd-key kbd-space">space</div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
        <span className="chip">WPM —</span>
        <span className="chip green">ACC —</span>
        <span className="chip green">Live now — open it from the app sidebar</span>
      </div>
    </div>
  );
}
