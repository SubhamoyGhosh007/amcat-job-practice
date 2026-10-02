import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'framer-motion';
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';

/* ---------------- Magnetic: element leans toward the cursor, springs back ---------------- */
export function Magnetic({ children, strength = 18 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 160, damping: 13 });
  const sy = useSpring(y, { stiffness: 160, damping: 13 });
  const reduce = useReducedMotion();
  function onMove(e: MouseEvent) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    x.set(Math.max(-strength, Math.min(strength, dx * 0.25)));
    y.set(Math.max(-strength, Math.min(strength, dy * 0.25)));
  }
  return (
    <motion.span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ x: sx, y: sy, display: 'inline-block' }}
    >
      {children}
    </motion.span>
  );
}

/* ---------------- Typewriter: rotating words with caret ---------------- */
export function Typewriter({ words, className }: { words: string[]; className?: string }) {
  const [i, setI] = useState(0);
  const [sub, setSub] = useState(0);
  const [del, setDel] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) {
      setSub(words[i % words.length].length);
      return;
    }
    const word = words[i % words.length];
    let t = 0;
    if (!del && sub < word.length) t = window.setTimeout(() => setSub(sub + 1), 55);
    else if (!del) t = window.setTimeout(() => setDel(true), 1500);
    else if (sub > 0) t = window.setTimeout(() => setSub(sub - 1), 26);
    else {
      setDel(false);
      setI((i + 1) % words.length);
    }
    return () => window.clearTimeout(t);
  }, [sub, del, i, words, reduce]);
  return <span className={className}>{words[i % words.length].slice(0, sub)}</span>;
}

/* ---------------- Squiggle: hand-drawn animated underline ---------------- */
export function Squiggle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 220 14" preserveAspectRatio="none" aria-hidden>
      <motion.path
        d="M3 10 C 40 3, 70 12, 110 7 S 180 4, 217 8"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay: 0.5 }}
      />
    </svg>
  );
}

/* ---------------- CloudShader: drifting volumetric-ish clouds (cheap canvas) ---------------- */
export function CloudShader({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const cvEl = ref.current;
    if (!(cvEl instanceof HTMLCanvasElement)) return;
    const ctxEl = cvEl.getContext('2d');
    if (!ctxEl) return;
    const cv: HTMLCanvasElement = cvEl;
    const ctx: CanvasRenderingContext2D = ctxEl;
    let raf = 0;
    let vis = true;
    let t = Math.random() * 100;
    const blobs = Array.from({ length: 7 }, (_, i) => ({
      bx: Math.random(), by: Math.random() * 0.75,
      r: 0.28 + Math.random() * 0.3,
      sp: 0.008 + Math.random() * 0.014,
      ph: Math.random() * 6.28,
      hue: [222, 200, 160, 250, 190, 210, 170][i % 7],
    }));
    function size() {
      const p = cv.parentElement?.getBoundingClientRect();
      if (!p) return;
      cv.width = Math.max(2, Math.floor(p.width / 3));
      cv.height = Math.max(2, Math.floor(p.height / 3));
    }
    size();
    window.addEventListener('resize', size);
    function draw() {
      const w = cv.width;
      const h = cv.height;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const b of blobs) {
        const x = (b.bx + 0.09 * Math.sin(t * b.sp + b.ph)) * w;
        const y = (b.by + 0.07 * Math.cos(t * b.sp * 0.8 + b.ph)) * h;
        const r = b.r * Math.max(w, h);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `hsla(${b.hue},90%,62%,.22)`);
        g.addColorStop(1, 'hsla(0,0%,0%,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.283);
        ctx.fill();
      }
      t += 1;
    }
    function loop() {
      if (!vis) return;
      draw();
      if (!reduce) raf = requestAnimationFrame(loop);
    }
    const io = new IntersectionObserver(([e]) => {
      vis = e.isIntersecting;
      if (vis) loop();
    });
    io.observe(cv);
    draw();
    loop();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', size);
    };
  }, [reduce]);
  return <canvas ref={ref} className={className} aria-hidden />;
}

/* ---------------- RippleCanvas: water rings blooming from the pointer ---------------- */
export function RippleCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const canvas = ref.current;
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const cv: HTMLCanvasElement = canvas;
    const ctx: CanvasRenderingContext2D = context;
    const parent: HTMLElement = canvas.parentElement as HTMLElement;
    if (!parent) return;
    const rings: { x: number; y: number; r: number; a: number }[] = [];
    let raf = 0;
    let vis = true;
    let idle = 0;
    function size() {
      const r = parent.getBoundingClientRect();
      cv.width = Math.max(2, Math.floor(r.width / 2));
      cv.height = Math.max(2, Math.floor(r.height / 2));
    }
    size();
    window.addEventListener('resize', size);
    function spawn(clientX: number, clientY: number) {
      const r = cv.getBoundingClientRect();
      rings.push({ x: (clientX - r.left) / 2, y: (clientY - r.top) / 2, r: 3, a: 0.45 });
      if (rings.length > 14) rings.shift();
    }
    const onMove = (e: PointerEvent) => spawn(e.clientX, e.clientY);
    parent.addEventListener('pointermove', onMove);
    function loop() {
      if (!vis) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      idle += 1;
      if (!reduce && idle % 150 === 0) {
        rings.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: 3, a: 0.3 });
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const g = rings[i];
        g.r += 1.5;
        g.a -= 0.008;
        if (g.a <= 0) {
          rings.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r, 0, 6.283);
        ctx.strokeStyle = `rgba(125,180,255,${g.a.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      raf = requestAnimationFrame(loop);
    }
    const io = new IntersectionObserver(([e]) => {
      vis = e.isIntersecting;
      if (vis) loop();
    });
    io.observe(cv);
    loop();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', size);
      parent.removeEventListener('pointermove', onMove);
    };
  }, [reduce]);
  return <canvas ref={ref} className={className} aria-hidden />;
}

/* ---------------- CanvasText: giant shimmering display type on canvas ---------------- */
export function CanvasText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const cvEl = ref.current;
    if (!(cvEl instanceof HTMLCanvasElement)) return;
    const ctxEl = cvEl.getContext('2d');
    if (!ctxEl) return;
    const cv: HTMLCanvasElement = cvEl;
    const ctx: CanvasRenderingContext2D = ctxEl;
    let raf = 0;
    let vis = true;
    let phase = 0;
    function size() {
      const p = cv.parentElement?.getBoundingClientRect();
      if (!p) return;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      cv.width = Math.max(2, Math.floor(p.width * dpr));
      cv.height = Math.max(2, Math.floor(p.height * dpr));
    }
    size();
    window.addEventListener('resize', size);
    function draw() {
      const w = cv.width;
      const h = cv.height;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      const fs = Math.min(w / (text.length * 0.72), h * 0.9);
      ctx.font = `700 ${fs}px 'Space Grotesk', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const g = ctx.createLinearGradient(
        w * 0.2 + Math.sin(phase) * w * 0.2, 0,
        w * 0.8 + Math.cos(phase * 0.7) * w * 0.2, 0
      );
      g.addColorStop(0, 'rgba(77,124,254,.55)');
      g.addColorStop(0.5, 'rgba(56,189,248,.5)');
      g.addColorStop(1, 'rgba(56,217,138,.45)');
      ctx.fillStyle = g;
      ctx.fillText(text, w / 2, h / 2 + fs * 0.04);
      ctx.strokeStyle = 'rgba(255,255,255,.10)';
      ctx.lineWidth = 1.5;
      ctx.strokeText(text, w / 2, h / 2 + fs * 0.04);
      phase += 0.02;
    }
    function loop() {
      if (!vis) return;
      draw();
      if (!reduce) raf = requestAnimationFrame(loop);
    }
    const io = new IntersectionObserver(([e]) => {
      vis = e.isIntersecting;
      if (vis) loop();
    });
    io.observe(cv);
    draw();
    loop();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', size);
    };
  }, [text, reduce]);
  return <canvas ref={ref} className={className} aria-hidden />;
}

/* ---------------- FloatingPointer: soft cursor glow (desktop only) ---------------- */
export function FloatingPointer() {
  const [on, setOn] = useState(false);
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const sx = useSpring(x, { stiffness: 250, damping: 24 });
  const sy = useSpring(y, { stiffness: 250, damping: 24 });
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const fn = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setOn(true);
    };
    window.addEventListener('pointermove', fn);
    return () => window.removeEventListener('pointermove', fn);
  }, [x, y]);
  if (!on) return null;
  return (
    <motion.div
      className="float-ptr"
      style={{ x: sx, y: sy, left: -90, top: -90, width: 180, height: 180, background: 'radial-gradient(circle, rgba(77,124,254,.16), transparent 70%)' }}
    />
  );
}

/* ---------------- Smooth in-page navigation (never touches the URL) ---------------- */
export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------------- Parallax: shared mouse-tilt values + depth layers ---------------- */
export function useParallax(max = 14) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  function onMove(e: MouseEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 2 * max);
    my.set(((e.clientY - r.top) / r.height - 0.5) * 2 * max);
  }
  function onLeave() {
    mx.set(0);
    my.set(0);
  }
  return { sx, sy, onMove, onLeave };
}

export function Depth({ x, y, depth, className, style, children }: {
  x: MotionValue<number>;
  y: MotionValue<number>;
  depth: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const tx = useTransform(x, (v) => v * depth);
  const ty = useTransform(y, (v) => v * depth);
  return (
    <motion.div className={className} style={{ ...style, x: tx, y: ty }}>
      {children}
    </motion.div>
  );
}
