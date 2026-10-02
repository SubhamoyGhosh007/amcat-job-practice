import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../stores/session';
import { SECTIONS, totalMinutes, totalQuestions } from '../types';
import { Counter, HoverCard, MovingCta, Reveal, TopicMarquee } from './aceternity';
import { CanvasText, CloudShader, Depth, FloatingPointer, Magnetic, RippleCanvas, Squiggle, Typewriter, scrollToId, useParallax } from './fx';
import Navbar from './Navbar';
import Keyboard from './Keyboard';
import Footer from './Footer';
import './landing.css';

const DEMO = {
  topic: 'Customer situation',
  prompt: 'A caller is shouting about a late delivery. What do you say first?',
  options: [
    '“Calm down, it is not our fault.”',
    '“I understand this delay upset you. Let me track it right now.”',
    '“There is nothing I can do.”',
  ],
  answer: 1,
  why: 'Acknowledge the feeling, take ownership, state the next step. That is the Concentrix way.',
};

const TOPICS = [
  'Percentages', 'Blood relations', 'Email etiquette', 'Time–speed–distance',
  'Coding–decoding', 'Angry callers', 'Profit & loss', 'Number series',
  'Hold etiquette', 'Averages', 'Direction sense', 'Escalation',
  'Synonyms', 'Ratios', 'Prioritisation', 'Data privacy',
];

function DemoCard() {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <div className="demo-card">
      <span className="topic">{DEMO.topic} • try it</span>
      <div className="qprompt" style={{ fontSize: 16 }}>{DEMO.prompt}</div>
      {DEMO.options.map((op, i) => (
        <div
          key={i}
          className={`demo-opt${pick !== null && i === DEMO.answer ? ' right' : ''}${pick === i && i !== DEMO.answer ? ' wrongpick' : ''}`}
          onClick={() => setPick(i)}
        >
          <b>{'ABC'[i]}.</b> {op}
        </div>
      ))}
      {pick !== null && (
        <div className="rev correct" style={{ margin: '10px 0 0' }}>
          <div className="exp"><b>Why:</b> {DEMO.why}</div>
        </div>
      )}
      {pick === null && <p className="hint" style={{ margin: '6px 0 0' }}>Tap an option — every question in the app explains itself like this.</p>}
    </div>
  );
}

function HeroVisual() {
  const { sx, sy, onMove, onLeave } = useParallax(12);
  return (
    <div className="hero-visual" onMouseMove={onMove} onMouseLeave={onLeave}>
      <Depth x={sx} y={sy} depth={0.45}>
        <DemoCard />
      </Depth>
      <Depth x={sx} y={sy} depth={1.4} className="glass-chip" style={{ top: -18, right: 12 }}>
        ⏱ 07:32 left
      </Depth>
      <Depth x={sx} y={sy} depth={1.9} className="glass-chip" style={{ bottom: 52, left: -14 }}>
        🔥 4-correct streak
      </Depth>
      <Depth x={sx} y={sy} depth={1.1} className="glass-chip" style={{ bottom: -16, right: 32 }}>
        ✅ answer script ready
      </Depth>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const userId = useSession((s) => s.userId);
  const profile = useSession((s) => s.profile);
  const onEnter = () => navigate(userId ? '/app' : '/login');
  return (
    <div className="landing" id="top">
      <FloatingPointer />
      <Navbar onLogin={onEnter} />

      {/* HERO */}
      <header className="hero">
        <div className="hero-grid" />
        <CloudShader className="shader-layer" />
        <RippleCanvas className="shader-layer" />
        <div className="hero-inner">
          <div>
            <span className="pill"><span className="livedot" /> Concentrix hiring prep</span>
            <h1 className="display">
              Walk into the test hall{' '}
              <span className="squig">already warmed up.<Squiggle className="" /></span>
            </h1>
            <div className="type-line">
              Practice with <Typewriter words={['timed sets.', 'fresh questions.', 'explained answers.', 'zero surprises.']} />
              <span className="type-caret" />
            </div>
            <p className="lede">
              A practice ground shaped exactly like the Concentrix AMCAT — four timed sections,
              a fresh set of questions every attempt, and an answer script that teaches you
              after every test. Move your mouse: the hall reacts.
            </p>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <Magnetic>
                <MovingCta onClick={onEnter}>{userId ? `Continue as @${profile?.username || '…'}` : 'Log in and start Set 1'}</MovingCta>
              </Magnetic>
              <button className="ghost-cta" onClick={() => scrollToId('pattern')}>See the pattern</button>
            </div>
            <div className="hero-stats">
              <div className="stat"><b><Counter to={totalQuestions} /></b><span>questions per set</span></div>
              <div className="stat"><b><Counter to={4} /></b><span>timed sections</span></div>
              <div className="stat"><b><Counter to={100} suffix="%" /></b><span>explained answers</span></div>
            </div>
          </div>
          <HeroVisual />
        </div>
      </header>

      {/* STATS */}
      <div className="band-ink">
        <div className="section">
          <div className="stats-band">
            <div className="stat-card"><b><Counter to={totalQuestions} /></b><span>questions per set</span></div>
            <div className="stat-card"><b><Counter to={totalMinutes} /></b><span>minutes of pressure</span></div>
            <div className="stat-card"><b><Counter to={100} suffix="%" /></b><span>answers explained</span></div>
            <div className="stat-card"><b><Counter to={16} /></b><span>avatars to pick from</span></div>
          </div>
        </div>
      </div>

      {/* PATTERN */}
      <div className="band-ink bg-dots">
        <div className="section" id="pattern">
          <Reveal>
            <h2 className="display">The exact pattern, zero surprises</h2>
            <p className="sub">Same sections, same pressure of a ticking clock, same no-negative-marking rule as the real drive. Finish one set and the next one is already new.</p>
          </Reveal>
          <div className="hover-grid">
            {SECTIONS.map((s) => (
              <HoverCard key={s.id}>
                <span className="tag">{s.count} Q • {s.minutes} min</span>
                <div className="big display">{s.count}</div>
                <h3>{s.name}</h3>
                <p>{s.description}</p>
              </HoverCard>
            ))}
          </div>
        </div>
      </div>

      {/* MARQUEE */}
      <div className="band-ink band-pad">
        <TopicMarquee topics={TOPICS} dark />
      </div>

      {/* HOW IT WORKS */}
      <div className="band-ink">
        <div className="section" id="how">
          <Reveal>
            <h2 className="display">Three sittings to test-ready</h2>
            <p className="sub">Most people loop this three or four times. Scores climb because the answer script shows its working.</p>
          </Reveal>
          <div className="steps">
            <div className="step"><h3>Log in with Google</h3><p>One account keeps all your score sheets together across every device.</p></div>
            <div className="step"><h3>Take a timed set</h3><p>Four sections, palette navigation, mark-for-review — the hall feel, minus the hall.</p></div>
            <div className="step"><h3>Read your script</h3><p>Every answer explained. Download the report and the study sheet as PDF, then take a brand-new set.</p></div>
          </div>
        </div>
      </div>

      {/* TYPING TEASER */}
      <div className="band-ink bg-aurora">
        <div className="section" id="typing" style={{ position: 'relative' }}>
          <Reveal>
            <h2 className="display">The typing arena is open</h2>
            <p className="sub">Concentrix typing rounds, monkeytype-style — live WPM, accuracy, consistency, and every test saved to your history.</p>
          </Reveal>
          <Keyboard />
          <div style={{ textAlign: 'center', marginTop: 24, position: 'relative' }}>
            <Magnetic>
              <MovingCta onClick={onEnter}>Open the typing arena</MovingCta>
            </Magnetic>
          </div>
        </div>
      </div>

      {/* SCRIPT PREVIEW + CTA */}
      <div className="band-ink">
        <div className="section">
          <Reveal>
            <h2 className="display">Never just “wrong”. Always “why”.</h2>
            <p className="sub">This is what waits at the end of every set — yours to keep as a PDF.</p>
          </Reveal>
          <div className="script-preview">
            <div className="rev correct">
              <div className="qnum">Q4 • Quantitative Ability • Profit &amp; loss • ✅ Correct</div>
              <div style={{ fontWeight: 600 }}>Bought for Rs. 800, sold for Rs. 920. Profit %?</div>
              <div className="exp"><b>Why:</b> Profit 120 on 800 = 120/800 = 15%.</div>
            </div>
            <div className="rev wrong">
              <div className="qnum">Q11 • English Ability • Preposition • ❌ Wrong</div>
              <div style={{ fontWeight: 600 }}>The customer insisted ___ speaking to a supervisor.</div>
              <div className="exp"><b>Why:</b> Correct collocation is “insist on doing something”.</div>
            </div>
          </div>

          <div className="cta-band">
            <CanvasText text="READY?" className="cta-canvas" />
            <div style={{ position: 'relative' }}>
              <h2 className="display">Your hall ticket is practice.</h2>
              <p>No fees, no coaching-centre timing, no repeated question papers. Just you, a timer, and a fresh set.</p>
              <Magnetic strength={24}>
                <MovingCta onClick={onEnter}>{userId ? 'Jump back into practice' : 'Claim your first set'}</MovingCta>
              </Magnetic>
            </div>
          </div>
        </div>
      </div>

      {/* LOGIN */}
      {/* <div className="band-ink bg-beams">
        <div className="login-band" id="login" style={{ position: 'relative' }}>
          <Reveal>
            <div className="login-card">
              <h2 className="display" style={{ margin: '0 0 8px' }}>Create your free account</h2>
              <p className="hint">One login holds every score sheet, streak and PDF — on every device. Google or plain email on the next screen. Twenty seconds, then Set 1.</p>
              <Magnetic strength={24}>
                <button className="btn-big" onClick={onEnter}>
                  {userId ? 'Continue practising →' : 'Get started — it’s free'}
                </button>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </div> */}

      <Footer onEnter={onEnter} />
    </div>
  );
}
