import { scrollToId } from './fx';

export default function Footer({ onEnter }: { onEnter: () => void }) {
  const go = (id: string) => () => scrollToId(id);
  const top = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  return (
    <footer className="footer-big">
      <div className="footer-grid">
        <div>
          <div className="footer-brand"><img src="/logo.jpg" alt="Concentrix AMCAT Practice logo" className="dot" />Concentrix AMCAT</div>
          <p>A practice ground shaped like the real hiring test — timed sets, fresh questions every attempt, and an answer script that teaches.</p>
          <button className="footer-start" onClick={onEnter}>Start free</button>
        </div>
        <div>
          <h4>Practice</h4>
          <button className="link" onClick={go('pattern')}>Exam pattern</button>
          <button className="link" onClick={go('how')}>Method</button>
          <button className="link" onClick={go('typing')}>Typing arena</button>
          <button className="link" onClick={onEnter}>Take a set</button>
        </div>
        <div>
          <h4>Free guides</h4>
          <a className="link" href="/guides/amcat-pattern">AMCAT pattern explained</a>
          <a className="link" href="/guides/svar-round">SVAR round decoded</a>
          <a className="link" href="/guides/typing-test">Typing test guide</a>
        </div>
        <div>
          <h4>After the test</h4>
          <button className="link" onClick={go('login')}>Answer scripts</button>
          <button className="link" onClick={go('login')}>Report PDFs</button>
          <button className="link" onClick={go('login')}>Study sheets</button>
        </div>
        <div>
          <h4>Account</h4>
          <button className="link" onClick={go('login')}>Log in</button>
          <button className="link" onClick={onEnter}>Create account</button>
          <a className="link" href="/privacy">Privacy policy</a>
          <a className="link" href="/terms">Terms of service</a>
          <button className="link" onClick={top}>Back to top</button>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Concentrix AMCAT Practice • built for one friend, open to every aspirant</span>
        <span>Unofficial practice project — not affiliated with Concentrix, AMCAT, or SHL • Written MCQ only • no video module</span>
      </div>
    </footer>
  );
}
