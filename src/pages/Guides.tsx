import { Link } from 'react-router-dom';
import { SECTIONS } from '../types';
import { usePageMeta } from '../lib/pageMeta';

/* ---------------- shared shell ---------------- */

function GuideShell({
  title,
  lede,
  path,
  description,
  graphic,
  children,
  jsonLd,
}: {
  title: string;
  lede: string;
  path: string;
  description: string;
  graphic: React.ReactNode;
  children: React.ReactNode;
  jsonLd: object;
}) {
  usePageMeta(title, description, path);
  return (
    <div className="landing" id="top">
      <div className="section" style={{ maxWidth: 780 }}>
        <Link to="/" style={{ color: '#1b4fa0', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          ← Back to home
        </Link>
        <p className="hint" style={{ margin: '14px 0 4px' }}>Free guides • Concentrix AMCAT Practice</p>
        <h1 className="display" style={{ fontSize: 34, margin: '0 0 8px', lineHeight: 1.15 }}>{title}</h1>
        <p className="lede" style={{ fontSize: 16 }}>{lede}</p>
        <div style={{ margin: '20px 0 8px' }}>{graphic}</div>
        <article className="guide-body">{children}</article>
        <div
          style={{
            marginTop: 28,
            border: '1px solid rgba(125,160,255,.25)',
            borderRadius: 14,
            padding: '20px 22px',
            background: 'rgba(77,124,254,.08)',
          }}
        >
          <h3 style={{ margin: '0 0 6px' }}>Try it right now — free</h3>
          <p className="sub" style={{ margin: '0 0 12px' }}>
            Reading helps, but scores move when a timer is running. Take a timed set, then read your answer script.
          </p>
          <Link to="/login" className="btn-big" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Start practising free →
          </Link>
        </div>
        <p className="hint" style={{ marginTop: 18 }}>
          Unofficial guide written by an aspirant — not affiliated with Concentrix, AMCAT, or SHL. Always confirm the
          current pattern from your official hall ticket or recruiter.
        </p>
      </div>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </div>
  );
}

function articleLd(headline: string, description: string, path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    inLanguage: 'en-IN',
    datePublished: '2026-10-03',
    author: { '@type': 'Organization', name: 'Concentrix AMCAT Practice', url: 'https://amcat-practice.antideploy.app/' },
    mainEntityOfPage: `https://amcat-practice.antideploy.app${path}`,
  };
}

/* ---------------- original SVG graphics (drawn for this site) ---------------- */

function PatternBars() {
  const max = Math.max(...SECTIONS.map((s) => s.count));
  const colors = ['#4d7cfe', '#38bdf8', '#38d98a', '#f5a623'];
  return (
    <svg viewBox="0 0 560 220" role="img" aria-label="AMCAT pattern: four sections with question counts and minutes" style={{ width: '100%', height: 'auto', borderRadius: 14 }}>
      <rect width="560" height="220" rx="14" fill="#0b1e4b" />
      <text x="24" y="30" fill="#fff" fontSize="15" fontWeight="800" fontFamily="system-ui, sans-serif">Four sections • one sitting</text>
      {SECTIONS.map((s, i) => {
        const y = 52 + i * 40;
        const w = Math.round((s.count / max) * 300);
        return (
          <g key={s.id}>
            <text x="24" y={y + 12} fill="#9fb0cc" fontSize="12.5" fontFamily="system-ui, sans-serif">{s.name}</text>
            <rect x="230" y={y} width={w} height="18" rx="9" fill={colors[i % colors.length]} />
            <text x={238 + w} y={y + 13} fill="#fff" fontSize="12" fontWeight="700" fontFamily="system-ui, sans-serif">
              {s.count} Q • {s.minutes} min
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const SVAR_PARTS = [
  ['A', 'Short answers'],
  ['B', 'Situations'],
  ['C', 'Read aloud'],
  ['D', 'Repeat'],
  ['E', 'Extempore'],
  ['F', 'Fill blank'],
  ['G', 'Fix error'],
];

function SvarSteps() {
  return (
    <svg viewBox="0 0 560 150" role="img" aria-label="Seven spoken parts of the SVAR-style round" style={{ width: '100%', height: 'auto', borderRadius: 14 }}>
      <rect width="560" height="150" rx="14" fill="#0b1e4b" />
      <text x="24" y="30" fill="#fff" fontSize="15" fontWeight="800" fontFamily="system-ui, sans-serif">Seven spoken parts • every answer on a timer</text>
      {SVAR_PARTS.map(([letter, label], i) => {
        const x = 24 + i * 74;
        return (
          <g key={letter}>
            <rect x={x} y="48" width="64" height="64" rx="10" fill={i % 2 ? '#38bdf8' : '#4d7cfe'} />
            <text x={x + 32} y="76" fill="#fff" fontSize="20" fontWeight="800" textAnchor="middle" fontFamily="system-ui, sans-serif">{letter}</text>
            <text x={x + 32} y="96" fill="#eaf1ff" fontSize="9.5" textAnchor="middle" fontFamily="system-ui, sans-serif">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function TypingGauge() {
  // semicircle gauge, needle parked at the 35 WPM hiring-comfort zone
  const cx = 280;
  const cy = 150;
  const r = 110;
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => `${cx + r * Math.cos((Math.PI * a) / 180)} ${cy - r * Math.sin((Math.PI * a) / 180)}`;
    return `M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`;
  };
  const needle = 35; // wpm
  const na = 180 - (needle / 60) * 180;
  const nx = cx + (r - 18) * Math.cos((Math.PI * na) / 180);
  const ny = cy - (r - 18) * Math.sin((Math.PI * na) / 180);
  return (
    <svg viewBox="0 0 560 190" role="img" aria-label="Typing speed gauge showing the 35 words per minute comfort zone" style={{ width: '100%', height: 'auto', borderRadius: 14 }}>
      <rect width="560" height="190" rx="14" fill="#0b1e4b" />
      <text x="24" y="30" fill="#fff" fontSize="15" fontWeight="800" fontFamily="system-ui, sans-serif">Aim here before the drive</text>
      <path d={arc(180, 0)} stroke="#24365e" strokeWidth="22" fill="none" strokeLinecap="round" />
      <path d={arc(180, 72)} stroke="#f5a623" strokeWidth="22" fill="none" />
      <path d={arc(72, 0)} stroke="#38d98a" strokeWidth="22" fill="none" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="9" fill="#fff" />
      {(
        [
          [0, '0'],
          [20, '20'],
          [40, '40'],
          [60, '60 WPM'],
        ] as Array<[number, string]>
      ).map(([v, label]) => {
        const a = 180 - (v / 60) * 180;
        const tx = cx + (r + 26) * Math.cos((Math.PI * a) / 180);
        const ty = cy - (r + 26) * Math.sin((Math.PI * a) / 180);
        return (
          <text key={label as string} x={tx} y={ty + 4} fill="#9fb0cc" fontSize="12" textAnchor="middle" fontFamily="system-ui, sans-serif">
            {label}
          </text>
        );
      })}
      <text x={cx} y={cy - 34} fill="#fff" fontSize="26" fontWeight="800" textAnchor="middle" fontFamily="system-ui, sans-serif">35 WPM</text>
      <text x={cx} y={cy - 14} fill="#9fb0cc" fontSize="12" textAnchor="middle" fontFamily="system-ui, sans-serif">comfort zone • 95%+ accuracy</text>
    </svg>
  );
}

/* ---------------- guide 1 ---------------- */

export function AmcatPatternGuide() {
  const path = '/guides/amcat-pattern';
  const title = 'Concentrix AMCAT Exam Pattern Explained (2026)';
  const description =
    'The Concentrix AMCAT pattern in plain words: four timed sections, question counts, minutes per section, no negative marking, and how to attempt the paper.';
  return (
    <GuideShell
      title={title}
      lede="What the paper looks like, how the clock behaves, and the order of attack that wastes the least time. Written from the candidate's chair, not a brochure."
      path={path}
      description={description}
      graphic={<PatternBars />}
      jsonLd={articleLd(title, description, path)}
    >
      <h2>The shape of the paper</h2>
      <p>
        The Concentrix hiring assessment follows the AMCAT pattern: one sitting, four timed sections, thirty questions
        in about thirty-two minutes. English Ability and Quantitative Ability carry eight questions each; Logical
        Reasoning and the Customer Service round carry seven each. There is no negative marking, so a blank answer is
        strictly worse than a guessed one.
      </p>
      <h2>How the clock actually feels</h2>
      <p>
        Roughly a minute per question sounds comfortable until a comprehension set eats four of them. The trick the
        toppers use is embarrassingly simple: each section gets its own budget, and when a question crosses ninety
        seconds, it gets marked and left behind. Because there is no penalty for wrong answers, the last two minutes of
        every section belong to the marked questions — with fresh eyes, half of them solve themselves.
      </p>
      <h2>Section by section</h2>
      <p>
        <b>English Ability</b> rewards readers, not grammarians. Comprehension, vocabulary in context, and sentence
        ordering decide most of the score; pure grammar rules are a minority. If you read daily, this section pays you
        back first.
      </p>
      <p>
        <b>Quantitative Ability</b> is speed arithmetic wearing a costume: percentages, profit and loss, averages, and
        time-speed-distance in different clothes. Learn the five or six standard setups and you will recognise every
        question as a friend.
      </p>
      <p>
        <b>Logical Reasoning</b> is the great leveller — coding-decoding, blood relations, series, and small puzzles.
        Nobody is born knowing these; everybody who practises fifty of each walks in confident.
      </p>
      <p>
        <b>Customer Service (Concentrix)</b> is situational judgement: angry callers, hold etiquette, escalation, and
        email tone. The rule underneath every question is the same — acknowledge the feeling, take ownership, state the
        next step. Pick the option where the agent sounds like that.
      </p>
      <h2>A three-sitting prep plan</h2>
      <p>
        Sitting one: take a full timed set cold and read every explanation, especially for questions you got right by
        luck. Sitting two: drill only your weakest section with fresh questions. Sitting three: another full set, this
        time protecting the clock with the ninety-second rule. Most people see their score jump between sitting one and
        three for one reason — the answer script shows its working, so mistakes turn into methods.
      </p>
    </GuideShell>
  );
}

/* ---------------- guide 2 ---------------- */

export function SvarGuide() {
  const path = '/guides/svar-round';
  const title = 'Concentrix SVAR Spoken-English Round: The 7 Parts, Decoded';
  const description =
    'What the SVAR-style spoken round tests across its seven parts — short answers, situations, read-aloud, repeat, extempore, fill-in-the-blank and error correction — and how to practise each.';
  return (
    <GuideShell
      title={title}
      lede="Seven small microphones, seven small timers. Here is what each part is secretly measuring, and the one habit that raises all seven scores at once: full sentences, every time."
      path={path}
      description={description}
      graphic={<SvarSteps />}
      jsonLd={articleLd(title, description, path)}
    >
      <h2>What the machine is listening for</h2>
      <p>
        Forget accent. The scoring listens for four things: did you understand, did you answer completely, did you
        speak fluently without long freezes, and was the grammar intact. Every one of the seven parts is just a
        different lens on those four. That is good news — one practice habit, speaking in complete sentences under a
        timer, trains all of them together.
      </p>
      <h2>The seven parts in plain words</h2>
      <p>
        <b>Parts A and B</b> play you a workplace scenario once and ask short questions about it. Play it once in your
        head too: who, when, where, and who does what. Answers must be full sentences — "Emma" scores nothing where
        "My name is Emma" scores.
      </p>
      <p>
        <b>Part C (read aloud)</b> shows a sentence to speak clearly. Land the endings of words and pause lightly at
        commas; trailing off makes you sound unsure even when you are right.
      </p>
      <p>
        <b>Part D (repeat)</b> plays one sentence exactly once and wants it back verbatim. Chunk it as you hear it —
        who-did-what-where — instead of memorising word by word.
      </p>
      <p>
        <b>Part E (extempore)</b> gives thirty seconds to think and sixty to speak on a topic. Use the oldest
        structure in rhetoric: opening line, two points, one closing line. Sixty seconds fills itself when the
        skeleton is ready.
      </p>
      <p>
        <b>Parts F and G</b> play a sentence with a missing or wrong word. Say the entire corrected sentence, not just
        the word — the test scores the sentence, and so should you.
      </p>
      <h2>The three mistakes that sink scores</h2>
      <p>
        One-word answers where a sentence was asked. Silence longer than two seconds while thinking — fill it with a
        calm "well…" and keep going. And mumbling the ends of sentences, which reads as uncertainty. Record yourself
        once, listen back, and you will hear at least one of these. Fix that one first; it is usually worth more than
        any vocabulary list.
      </p>
    </GuideShell>
  );
}

/* ---------------- guide 3 ---------------- */

export function TypingGuide() {
  const path = '/guides/typing-test';
  const title = 'Concentrix Typing Test: What Speed You Need & How to Get There';
  const description =
    'How the Concentrix typing round is scored, the WPM and accuracy to aim for, and a two-week drill plan that builds speed without wrecking accuracy.';
  return (
    <GuideShell
      title={title}
      lede="Nobody fails the typing round for lack of talent. They fail it for practising speed before accuracy, or for never practising against a clock at all."
      path={path}
      description={description}
      graphic={<TypingGauge />}
      jsonLd={articleLd(title, description, path)}
    >
      <h2>What is actually measured</h2>
      <p>
        Three numbers: gross speed in words per minute, accuracy as a percentage, and consistency — whether your speed
        survives the whole passage or collapses halfway. Recruiters forgive a modest WPM paired with clean accuracy
        far sooner than fast, sloppy typing, because every error is a future correction the company pays for.
      </p>
      <h2>The numbers to aim for</h2>
      <p>
        Treat <b>35 WPM at 95% accuracy or better</b> as the comfort zone for a support-floor role. Below 25 WPM, make
        accuracy your only goal until it sticks above 95% — speed built on errors has to be unlearned later, which
        costs more time than building it cleanly now. Above 40 WPM with high accuracy, you are done; spend the hours
        on the written sections instead.
      </p>
      <h2>A two-week drill that works</h2>
      <p>
        Week one is accuracy week: slow passages, eyes on the screen never on the keyboard, and every session ends the
        moment accuracy dips — tired fingers practise mistakes. Week two is clock week: timed runs at target speed,
        shorter bursts with full rest between, and one full-length run every third day to train consistency. Ten
        focused minutes daily beats a heroic Sunday hour; typing is motor memory, and motor memory is laid down by
        sleep between sessions, not by marathon sessions.
      </p>
      <h2>Test-day details people forget</h2>
      <p>
        Sit so your wrists float rather than rest on the desk edge. Read two words ahead of what your fingers are
        typing — the eyes lead, the hands follow. And when you make an error mid-run, do not freeze or restart the
        word three times; correct once and flow on. A single corrected error costs a second; a spiral costs the
        passage.
      </p>
    </GuideShell>
  );
}
