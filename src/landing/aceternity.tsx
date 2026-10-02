import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Aceternity-style: soft radial spotlight following the mouse. */
export function Spotlight({ className, fill = '#4d7cfe' }: { className?: string; fill?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: -400, y: -400 });
  const [opacity, setOpacity] = useState(0);
  function onMove(e: MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
    setOpacity(1);
  }
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={() => setOpacity(0)} className={cn('spotlight', className)}
      style={{ left: pos.x - 280, top: pos.y - 280, opacity, background: `radial-gradient(circle, ${fill}33 0%, transparent 70%)`, width: 560, height: 560 }} />
  );
}

/** Word-by-word headline reveal (Aceternity TextGenerateEffect). */
export function TextGenerate({ text, className }: { text: string; className?: string }) {
  const words = text.split(' ');
  return (
    <span className={className}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ delay: 0.15 + i * 0.09, duration: 0.5 }}
          style={{ display: 'inline-block', marginRight: '0.28em' }}
        >
          {w}
        </motion.span>
      ))}
    </span>
  );
}

/** Scroll-into-view fade-up (used once per section, not on every card). */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 26 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay }}>
      {children}
    </motion.div>
  );
}

/** Aceternity HoverEffect: card with cursor-tracking glow. */
export function HoverCard({ children, className }: { children: ReactNode; className?: string }) {
  function onMove(e: MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }
  return (
    <div className={cn('hover-card', className)} onMouseMove={onMove}>
      <div className="glow" />
      {children}
    </div>
  );
}

/** Aceternity MovingBorder button. */
export function MovingCta({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <a className="moving-cta" onClick={(e) => { e.preventDefault(); onClick(); }} href="#login">
      <span className="beam" />
      <span className="core">{children}</span>
    </a>
  );
}

/** Infinite topic marquee (honest content: the actual syllabus). */
export function TopicMarquee({ topics, dark = false }: { topics: string[]; dark?: boolean }) {
  const row = [...topics, ...topics];
  return (
    <div className={`marquee${dark ? ' dark' : ''}`} aria-hidden>
      <div className="marquee-track">
        {row.map((t, i) => (
          <span className="topic-chip" key={i}>{t}</span>
        ))}
      </div>
    </div>
  );
}

/** Animated counter for hero stats. */
export function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);
  return <span ref={ref}>{n}{suffix}</span>;
}
