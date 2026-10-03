import { useEffect, useState } from 'react';
import { scrollToId } from './fx';

export default function Navbar({ onLogin }: { onLogin: () => void }) {
  const [sc, setSc] = useState(false);
  useEffect(() => {
    const fn = () => setSc(window.scrollY > 24);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  const go = (id: string) => () => scrollToId(id);
  const top = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  return (
    <nav className={`nav${sc ? ' scrolled' : ''}`}>
      <div className="nav-inner">
        <button className="brand" onClick={top}>
          <img src="/logo.jpg" alt="Concentrix AMCAT Practice logo" className="dot" />Concentrix AMCAT
        </button>
        <div className="nav-links">
          <button onClick={go('pattern')}>Pattern</button>
          <button onClick={go('how')}>Method</button>
          
        </div>
        <div className="nav-cta">
          <button className="nav-start" onClick={onLogin}>Start free</button>
        </div>
      </div>
    </nav>
  );
}
