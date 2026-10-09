import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../stores/session';
import { Reveal } from './aceternity';
import { scrollToId } from './fx';
import { IconBook, IconCalc, IconChat, IconMic, IconPuzzle } from './icons';
import './revamp.css';

const FAQS = [
  {
    q: 'What is the Concentrix AMCAT exam pattern?',
    a: 'The Concentrix hiring test follows the AMCAT pattern: four timed sections — English Ability, Quantitative Ability, Logical Reasoning, and a Customer Service round — with no negative marking. This site mirrors that pattern with fresh questions on every attempt.',
  },
  {
    q: 'Is this an official AMCAT mock test?',
    a: 'No. This is a free, unofficial practice project built by an aspirant — it is not affiliated with Concentrix, AMCAT, or SHL. Use it to warm up, and always confirm the current pattern from your official hall ticket or recruiter.',
  },
  {
    q: 'Does it cover the SVAR spoken-English round?',
    a: 'Yes. The speaking lab covers repeat sentences, read-aloud, extempore and error correction, and the mock interview runs all seven spoken parts on exam timers with one-play audio.',
  },
  {
    q: 'Is there a typing test for Concentrix preparation?',
    a: 'Yes. The typing arena measures live WPM, accuracy and consistency, monkeytype-style, and saves every attempt to your history.',
  },
  {
    q: 'Is the Concentrix AMCAT practice free?',
    a: 'Yes. Practice sets, the typing arena, the speaking lab and a daily mock interview are free, and solved answer scripts download as PDF.',
  },
];

const FLOAT_CARDS = [
  { cls: 'rv-fc1', Icon: IconBook, color: '#3b82f6', bg: '#e8f1fe', title: 'English Ability', cap: '8 Q • 8 min' },
  { cls: 'rv-fc2', Icon: IconCalc, color: '#22c55e', bg: '#e6f7ee', title: 'Quantitative', cap: '8 Q • 9 min' },
  { cls: 'rv-fc3', Icon: IconMic, color: '#8b5cf6', bg: '#f3e8fd', title: 'SVAR Voice', cap: '7 parts • timed' },
  { cls: 'rv-fc4', Icon: IconPuzzle, color: '#f59e0b', bg: '#fef3e2', title: 'Logical', cap: '7 Q • 8 min' },
];

const BOOKS = [
  { title: 'English Ability', meta: '8 Q • 8 min', bg: '#3b82f6', to: '/login' },
  { title: 'Quantitative Ability', meta: '8 Q • 9 min', bg: '#22c55e', to: '/login' },
  { title: 'Logical Reasoning', meta: '7 Q • 8 min', bg: '#f59e0b', to: '/login' },
  { title: 'Customer Service', meta: '7 Q • 7 min', bg: '#8b5cf6', to: '/login' },
  { title: 'AMCAT pattern guide', meta: 'Free guide', bg: '#20a9e0', to: '/guides/amcat-pattern' },
  { title: 'SVAR round guide', meta: 'Free guide', bg: '#ef4444', to: '/guides/svar-round' },
  { title: 'Typing test guide', meta: 'Free guide', bg: '#14b8a6', to: '/guides/typing-test' },
];

const QUIZ_TABS = [
  {
    id: 'english',
    label: 'English',
    topic: 'Preposition • fill in the blank',
    q: 'The team has been working ___ morning.',
    options: ['since', 'for', 'from', 'at'],
    answer: 0,
    why: '“Since” pairs with a point in time (morning); “for” needs a duration like “three hours”.',
  },
  {
    id: 'quant',
    label: 'Quant',
    topic: 'Percentages • shortcut',
    q: 'What is 12.5% of 800?',
    answer: 1,
    options: ['96', '100', '110', '125'],
    why: '12.5% is exactly 1/8, and 800 ÷ 8 = 100. Learn the fraction table and these fall instantly.',
  },
  {
    id: 'logical',
    label: 'Logical',
    topic: 'Direction sense',
    q: 'Face north, turn right, then right again, then left. Which way now?',
    answer: 2,
    options: ['North', 'South', 'East', 'West'],
    why: 'North → East → South → East. Track it turn by turn instead of visualising the whole map.',
  },
];

const ROADMAP = [
  {
    id: 'english',
    name: 'English Ability',
    meta: '8 Q • 8 min',
    color: '#3b82f6',
    Icon: IconBook,
    blurb: 'Comprehension, vocabulary in context, grammar rules, sentence ordering.',
    lessons: [
      ['Reading comprehension', '12 min'],
      ['Vocabulary in context', '9 min'],
      ['Grammar rules that repeat', '10 min'],
      ['Sentence ordering', '8 min'],
    ],
  },
  {
    id: 'quant',
    name: 'Quantitative Ability',
    meta: '8 Q • 9 min',
    color: '#22c55e',
    Icon: IconCalc,
    blurb: 'Percentages, profit & loss, time–speed–distance, averages.',
    lessons: [
      ['Percentages & profit–loss', '14 min'],
      ['Time–speed–distance', '12 min'],
      ['Averages & ratios', '10 min'],
      ['Number system', '9 min'],
    ],
  },
  {
    id: 'logical',
    name: 'Logical Reasoning',
    meta: '7 Q • 8 min',
    color: '#f59e0b',
    Icon: IconPuzzle,
    blurb: 'Coding–decoding, blood relations, series, puzzles.',
    lessons: [
      ['Coding–decoding', '10 min'],
      ['Blood relations', '9 min'],
      ['Series & patterns', '11 min'],
      ['Puzzles', '12 min'],
    ],
  },
  {
    id: 'csat',
    name: 'Customer Service',
    meta: '7 Q • 7 min',
    color: '#8b5cf6',
    Icon: IconChat,
    blurb: 'Angry callers, hold etiquette, escalation, email tone.',
    lessons: [
      ['Angry callers', '10 min'],
      ['Hold & escalation', '8 min'],
      ['Email tone', '7 min'],
      ['Prioritisation', '8 min'],
    ],
  },
];

const NAV_LINKS = [
  { id: 'pattern', label: 'Pattern' },
  { id: 'demo', label: 'Demo' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
];

export default function Landing() {
  const navigate = useNavigate();
  const userId = useSession((s) => s.userId);
  const profile = useSession((s) => s.profile);
  const onEnter = () => navigate(userId ? '/app' : '/login');

  const heroRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const t = requestAnimationFrame(() => el.classList.add('is-shown'));
    return () => cancelAnimationFrame(t);
  }, []);

  const [activeNav, setActiveNav] = useState('');
  useEffect(() => {
    const fn = () => {
      const y = window.scrollY + 160;
      let cur = '';
      for (const l of NAV_LINKS) {
        const el = document.getElementById(l.id);
        if (el && el.offsetTop <= y) cur = l.id;
      }
      setActiveNav(cur);
    };
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const [quizTab, setQuizTab] = useState(QUIZ_TABS[0].id);
  const [picked, setPicked] = useState<number | null>(null);
  const quiz = QUIZ_TABS.find((t) => t.id === quizTab)!;
  const pickQuiz = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
  };
  const switchQuiz = (id: string) => {
    setQuizTab(id);
    setPicked(null);
  };

  const [openRoad, setOpenRoad] = useState(ROADMAP[0].id);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="rv landing" id="top">
      {/* 1. slim top nav */}
      <div className="rv-nav">
        <div className="rv-nav-inner">
          <button className="rv-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/logo.jpg" alt="Concentrix AMCAT Practice logo" />
            AMCAT Practice
          </button>
          {NAV_LINKS.map((l) => (
            <button
              key={l.id}
              className={`rv-nav-link${activeNav === l.id ? ' active' : ''}`}
              onClick={() => scrollToId(l.id)}
            >
              {l.label}
            </button>
          ))}
          <button className="rv-nav-cta" onClick={onEnter}>Start free</button>
        </div>
      </div>

      {/* 2. hero with floating subject cards */}
      <header className="rv-hero">
        <div className="rv-abstract" aria-hidden="true">
          <svg width="900" height="420" viewBox="0 0 900 420" fill="none">
            <g stroke="#3157d8" strokeOpacity="0.1">
              {Array.from({ length: 12 }, (_, r) => (
                <g key={r}>
                  {Array.from({ length: 24 }, (_, c) => (
                    <circle key={c} cx={30 + c * 36} cy={30 + r * 34} r="2" />
                  ))}
                </g>
              ))}
            </g>
            <g stroke="#3157d8" strokeOpacity="0.14" strokeWidth="1.5">
              <ellipse cx="450" cy="190" rx="330" ry="120" />
              <ellipse cx="450" cy="190" rx="250" ry="88" />
              <ellipse cx="450" cy="190" rx="170" ry="56" />
            </g>
            <rect x="392" y="120" width="116" height="140" rx="14" stroke="#3157d8" strokeOpacity="0.12" strokeWidth="1.5" />
            <line x1="412" y1="155" x2="488" y2="155" stroke="#3157d8" strokeOpacity="0.12" strokeWidth="6" strokeLinecap="round" />
            <line x1="412" y1="175" x2="488" y2="175" stroke="#3157d8" strokeOpacity="0.1" strokeWidth="6" strokeLinecap="round" />
            <line x1="412" y1="195" x2="460" y2="195" stroke="#3157d8" strokeOpacity="0.1" strokeWidth="6" strokeLinecap="round" />
            <circle cx="450" cy="232" r="10" fill="#3157d8" fillOpacity="0.1" />
          </svg>
        </div>
        {FLOAT_CARDS.slice(0, 2).map((c) => (
          <div key={c.title} className={`rv-float-card ${c.cls}`} aria-hidden="true">
            <div className="swatch" style={{ background: c.bg, color: c.color }}><c.Icon size={30} /></div>
            <b>{c.title}</b>
            <small>{c.cap}</small>
          </div>
        ))}
        <div ref={heroRef} className="t-stagger" style={{ position: 'relative' }}>
          <span className="rv-announce t-stagger-line t-stagger-line--1">
            <span className="new-dot">NEW</span> 120+ practice questions • fresh AI sets
          </span>
          <h1 className="t-stagger-line t-stagger-line--2">
            Walk in test-ready.<br /><em>Clear your AMCAT drive.</em>
          </h1>
          <p className="lede t-stagger-line t-stagger-line--3">
            Free Concentrix AMCAT mock test practice shaped exactly like the real hiring test — four timed sections,
            fresh questions every attempt, and an answer script that teaches you after every test.
          </p>
          <div className="rv-cta-row t-stagger-line t-stagger-line--4">
            <button className="rv-btn-primary" onClick={onEnter}>
              {userId ? `Continue as @${profile?.username || '…'}` : 'Start free'}
            </button>
            <button className="rv-btn-secondary" onClick={() => scrollToId('demo')}>See how it works</button>
          </div>
        </div>
        <div className="rv-trust">
          <span className="avatars" aria-hidden="true">
            <span style={{ background: '#3b82f6' }}>A</span>
            <span style={{ background: '#22c55e' }}>R</span>
            <span style={{ background: '#f59e0b' }}>S</span>
            <span style={{ background: '#8b5cf6' }}>+</span>
          </span>
          <span>Practised by job aspirants across India • 120+ questions </span>
        </div>
        {FLOAT_CARDS.slice(2).map((c) => (
          <div key={c.title} className={`rv-float-card ${c.cls}`} aria-hidden="true">
            <div className="swatch" style={{ background: c.bg, color: c.color }}><c.Icon size={30} /></div>
            <b>{c.title}</b>
            <small>{c.cap}</small>
          </div>
        ))}
        <div className="rv-float-row" aria-hidden="true">
          {FLOAT_CARDS.map((c) => (
            <div key={c.title} className="rv-float-card">
              <div className="swatch" style={{ background: c.bg, color: c.color }}><c.Icon size={26} /></div>
              <b>{c.title}</b>
              <small>{c.cap}</small>
            </div>
          ))}
        </div>
      </header>

      {/* 3. course bookshelf */}
      <div id="pattern" className="rv-shelf-wrap">
        <Reveal>
          <div className="wrap-narrow" style={{ marginBottom: 34 }}>
            {/* <span className="eyebrow-pill">One shelf, everything tested</span> */}
            <h2 className="sec-title">Four sections, three guides</h2>
            <p className="sec-sub">Pick a book — sections drop you into timed practice, guides teach the method first.</p>
          </div>
        </Reveal>
        <div className="rv-shelf">
          {BOOKS.map((b, i) => (
            <a key={b.title} href={b.to} className="rv-book" style={{ background: b.bg, height: 150 + ((i * 37) % 3) * 14 }}>
              <span className="bnum">{String(i + 1).padStart(2, '0')}</span>
              <b>{b.title}</b>
              <small>{b.meta}</small>
            </a>
          ))}
        </div>
        <div className="rv-plank" />
        <p className="rv-shelf-cap">30 questions • 32 minutes • no negative marking</p>
      </div>

      {/* 4. explainer + dark demo panel */}
      <section id="demo" className="block">
        <div className="wrap-narrow" style={{ marginBottom: 34 }}>
          <div style={{ textAlign: 'center' }}>
            <span className="eyebrow-pill">How it works</span>
            <h2 className="sec-title">Practice like it's the real hall</h2>
            <p className="sec-sub">Timed sets, instant answer scripts, typing and voice rounds — the whole drive, rehearsed.</p>
          </div>
        </div>
        <div className="wrap-narrow">
          <Reveal>
            <div className="rv-demo">
              <div className="rv-tile">
                <div className="t-label">Timed set • English Ability</div>
                <div className="t-q">The customer insisted ___ speaking to a supervisor.</div>
                <div className="t-opt">for</div>
                <div className="t-opt right">on ✓</div>
                <div className="t-meta">Q11 of 30 <span className="rv-timer-chip">⏱ 07:32</span></div>
                <div className="rv-bar"><span style={{ width: '36%' }} /></div>
              </div>
              <div className="rv-tile">
                <div className="t-label">Answer script • why, not just wrong</div>
                <div className="t-q">Bought for Rs. 800, sold for Rs. 920. Profit %?</div>
                <div className="t-opt right">15% ✓ <span style={{ opacity: 0.7 }}>— profit 120 on 800</span></div>
                <div className="t-opt wrong">18% ✗ <span style={{ opacity: 0.7 }}>— you picked this</span></div>
                <div className="t-meta">Saved as PDF <span className="rv-timer-chip">⬇ script</span></div>
              </div>
              <div className="rv-tile">
                <div className="t-label">Typing arena • live</div>
                <div className="t-q" style={{ fontSize: 26, fontWeight: 800 }}>42 <span style={{ fontSize: 13, fontWeight: 600, color: '#8b8b98' }}>WPM • 96% acc</span></div>
                <div className="rv-bar"><span style={{ width: '72%' }} /></div>
                <div className="t-meta">Consistency 88% <span className="rv-timer-chip">10 tests/day free</span></div>
              </div>
              <div className="rv-tile">
                <div className="t-label">Speaking lab • SVAR</div>
                <div className="t-q">Repeat once, then record — clarity, coverage, pace scored /10.</div>
                <div className="t-opt right">Clarity 92% ✓</div>
                <div className="t-opt">Pace 138 wpm ✓</div>
                <div className="t-meta">Whisper transcription <span className="rv-timer-chip">⭐ 8/10</span></div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* features */}
      <section id="features" className="block" style={{ paddingTop: 20 }}>
        <div className="wrap-narrow">
          <h2 className="sec-title">Everything the drive tests</h2>
          <p className="sec-sub">
            Four arenas, one account. Each one grades you instantly and tells you exactly what to fix next.
          </p>
          <div className="rv-feat-grid">
            <Reveal>
              <div>
                <div className="rv-feat-visual" aria-hidden="true">
                  <div className="fv-row">Q11 • The customer insisted ___ speaking…</div>
                  <div className="fv-row good">B. on ✓ — “insist on doing”</div>
                  <div className="fv-row dim">Q12 • Time–speed–distance…</div>
                </div>
                <h3 className="rv-feat-h">Timed practice sets</h3>
                <p className="rv-feat-p">30 fresh questions across all four sections on one page, with a hall-style countdown.</p>
              </div>
            </Reveal>
            <Reveal>
              <div>
                <div className="rv-feat-visual" aria-hidden="true">
                  <div className="fv-row bad">18% ✗ — you picked this</div>
                  <div className="fv-row good">15% ✓ — profit 120 on 800</div>
                  <div className="fv-small">Every answer ships with its working.</div>
                </div>
                <h3 className="rv-feat-h">Answer scripts that teach</h3>
                <p className="rv-feat-p">Your pick vs the actual answer, the shortcut shown step by step, downloadable as PDF.</p>
              </div>
            </Reveal>
            <Reveal>
              <div>
                <div className="rv-feat-visual" aria-hidden="true">
                  <div className="fv-big">42 <span className="fv-small">WPM • 96% accuracy</span></div>
                  <div className="fv-bar"><span style={{ width: '72%' }} /></div>
                  <div className="fv-small">Consistency 88% • every test saved</div>
                </div>
                <h3 className="rv-feat-h">Typing arena</h3>
                <p className="rv-feat-p">Live speed, accuracy and consistency with full history — the metric Concentrix screens on.</p>
              </div>
            </Reveal>
            <Reveal>
              <div>
                <div className="rv-feat-visual" aria-hidden="true">
                  <div className="fv-row">🔴 Repeat once, then record…</div>
                  <div className="fv-row good">Clarity 92% • Pace 138 wpm ✓</div>
                  <div className="fv-small">Whisper transcription, marks out of 10.</div>
                </div>
                <h3 className="rv-feat-h">Speaking lab + mock interview</h3>
                <p className="rv-feat-p">All seven SVAR parts on exam timers, plus a monitored full mock with session reports.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 5. games + knowledge check */}
      <section id="quiz" className="block" style={{ paddingTop: 20 }}>
        <div className="wrap-narrow">
          <div style={{ textAlign: 'center' }}>
            <span className="eyebrow-pill">Warm up in 30 seconds</span>
            <h2 className="sec-title">Try one question right now</h2>
            <p className="sec-sub">No login, no setup — pick a subject, answer, and see the explanation instantly.</p>
          </div>
          <div className="rv-tabs" role="tablist">
            {QUIZ_TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={quizTab === t.id}
                className={`rv-tab${quizTab === t.id ? ' active' : ''}`}
                onClick={() => switchQuiz(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="rv-quiz">
            <div className="q-label">{quiz.topic}</div>
            <div className="q-text">{quiz.q}</div>
            {quiz.options.map((op, i) => {
              const answered = picked !== null;
              const cls = !answered ? '' : i === quiz.answer ? ' right' : i === picked ? ' wrong' : '';
              return (
                <button key={i} className={`q-opt${cls}`} disabled={answered} onClick={() => pickQuiz(i)}>
                  <span className="k">{'ABCD'[i]}</span> {op}
                  {answered && i === quiz.answer && <span style={{ marginLeft: 'auto' }}>✓</span>}
                  {answered && i === picked && i !== quiz.answer && <span style={{ marginLeft: 'auto' }}>✗</span>}
                </button>
              );
            })}
            {picked !== null && <div className="q-why"><b>Why:</b> {quiz.why}</div>}
            <div className="rv-quiz-foot">
              <span className="dots" aria-hidden="true">
                {QUIZ_TABS.map((t) => (
                  <i key={t.id} className={t.id === quizTab ? 'on' : ''} />
                ))}
              </span>
              <button className={picked !== null ? 'live' : ''} onClick={onEnter}>
                {picked !== null ? 'That was 1 of 120+ →' : 'Full 30-question set →'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6-7. roadmap */}
      <section id="roadmap" className="block">
        <div className="wrap-narrow">
          <div style={{ textAlign: 'center' }}>
            <span className="eyebrow-pill">Roadmap</span>
            <h2 className="sec-title">The syllabus, in small chunks</h2>
            <p className="sec-sub">
              Each section splits into short lessons with realistic timings. Finish a chunk, practise it immediately —
              scores climb because every mistake comes back with its working shown.
            </p>
          </div>
          <div className="rv-road-pick">
            {ROADMAP.map((m) => (
              <button key={m.id} className={openRoad === m.id ? 'active' : ''} onClick={() => setOpenRoad(m.id)}>
                <div className="sw" style={{ background: m.color }} />
                <b>{m.name}</b>
                <small>{m.meta}</small>
              </button>
            ))}
          </div>
          <div className="rv-modules">
            {ROADMAP.map((m) => {
              const open = openRoad === m.id;
              return (
                <div key={m.id} className="t-acc rv-module" data-open={String(open)}>
                  <button className="t-acc-head rv-mod-head" aria-expanded={open} onClick={() => setOpenRoad(m.id)}>
                    <span className="thumb" style={{ background: `${m.color}1f`, color: m.color }}><m.Icon size={22} /></span>
                    <span>
                      <span className="num">MODULE {ROADMAP.indexOf(m) + 1}</span>
                      <b>{m.name}</b>
                      <small>{m.meta} • {m.blurb}</small>
                    </span>
                    <span className="t-acc-chevron chev" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 6.5L8 10.5L12 6.5" />
                      </svg>
                    </span>
                  </button>
                  <div className="t-acc-panel">
                    <div className="t-acc-panel-inner">
                      <ul className="rv-mod-lessons">
                        {m.lessons.map(([title, dur]) => (
                          <li key={title}>
                            <button className="rv-play" onClick={onEnter} aria-label={`Practise ${title}`}>▶</button>
                            {title}
                            <span className="dur">{dur}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="block" style={{ paddingTop: 20 }}>
        <div className="wrap-narrow">
          <h2 className="sec-title">Free to start, pro when you're serious</h2>
          <p className="sec-sub">
            Everything you need to clear the drive costs nothing. Pro removes every limit for unstoppable final-week prep.
          </p>
          <div className="rv-price-grid">
            <div className="rv-price-card">
              <div className="rv-price-top">
                <b>Free</b>
                <span className="rv-price-badge live">Available now</span>
              </div>
              <p className="rv-price-desc">The full prep loop — new questions every day, scored and explained.</p>
              <div className="rv-price-value">₹0 <small>forever</small></div>
              <button className="rv-price-btn dark" onClick={onEnter}>Start free</button>
              <ul className="rv-price-list">
                <li>5 fresh practice sets daily</li>
                <li>Typing arena • 10 tests daily</li>
                <li>Speaking lab • 5 sessions daily</li>
                <li>1 mock interview daily</li>
                <li>Maths arena • every 4 hours</li>
                <li>Answer scripts + PDFs</li>
              </ul>
            </div>
            <div className="rv-price-card">
              <div className="rv-price-top">
                <b>Pro</b>
                <span className="rv-price-badge soon">Forthcoming</span>
              </div>
              <p className="rv-price-desc">Unlimited everything for the final stretch before your drive.</p>
              <div className="rv-price-value">Coming soon</div>
              <a
                className="rv-price-btn ghost"
                style={{ textDecoration: 'none', textAlign: 'center' }}
                href="https://github.com/SubhamoyGhosh007/amcat-job-practice"
                target="_blank"
                rel="noreferrer"
              >
                Request access
              </a>
              <ul className="rv-price-list">
                <li>Unlimited sets, typing & speaking</li>
                <li>Unlimited mocks & maths</li>
                <li>Heaviest AI question writers</li>
                <li>Priority new features</li>
                <li className="off">Checkout opens at launch</li>
              </ul>
            </div>
          </div>
          <p className="rv-price-note">Pro accounts are currently granted manually — request access and we’ll set it up.</p>
        </div>
      </section>

      {/* 8. FAQ */}
      <section id="faq" className="block" style={{ paddingTop: 20 }}>
        <div className="wrap-narrow">
          <div className="rv-faq-head">
            <h2 className="sec-title">Questions aspirants ask</h2>
            <p className="sec-sub">Straight answers about the pattern, the SVAR round, typing, and what this site is.</p>
          </div>
          <div className="rv-faq">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={f.q} className="t-acc faq-item" data-open={String(open)}>
                  <button className="t-acc-head faq-head" aria-expanded={open} onClick={() => setOpenFaq(open ? null : i)}>
                    <span>{f.q}</span>
                    <span className="t-acc-chevron" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 6.5L8 10.5L12 6.5" />
                      </svg>
                    </span>
                  </button>
                  <div className="t-acc-panel">
                    <div className="t-acc-panel-inner">
                      <div className="faq-answer"><p>{f.a}</p></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 9. final CTA */}
      <div className="rv-final">
        <img src="/logo.jpg" alt="Concentrix AMCAT Practice logo" className="mark" />
        <h2>Your hall ticket is practice. Ready?</h2>
        <p>No fees, no coaching-centre timing. Just you, a timer, and a fresh set.</p>
        <button className="btn-pill" onClick={onEnter}>
          {userId ? 'Jump back into practice' : 'Claim your first set — free'}
        </button>
      </div>

      {/* 10. footer */}
      <footer className="rv-footer">
        <div>© 2026 Concentrix AMCAT Practice • unofficial practice project, not affiliated with Concentrix, AMCAT, or SHL</div>
        <nav>
          <a href="/guides/amcat-pattern">Pattern guide</a>
          <a href="/guides/svar-round">SVAR guide</a>
          <a href="/guides/typing-test">Typing guide</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
      </footer>
    </div>
  );
}
