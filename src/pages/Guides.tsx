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

/* ---------------- guide 4: concentrix master playbook ---------------- */

function InterviewRoundsFlow() {
  const stages = [
    { num: '1', title: 'Communication', sub: 'JAM & Intro' },
    { num: '2', title: 'AMCAT Test', sub: 'Adaptive 30Q' },
    { num: '3', title: 'OPS 1', sub: 'Mindset & Shifts' },
    { num: '4', title: 'OPS 2', sub: 'Scenarios & Fit' },
    { num: '5', title: 'Voice (SVAR)', sub: 'Calls & Accent' },
    { num: '6', title: 'Typing & WriteX', sub: 'WPM & Emails' },
  ];
  return (
    <svg
      viewBox="0 0 560 170"
      role="img"
      aria-label="Concentrix 6 Selection Rounds Roadmap"
      style={{ width: '100%', height: 'auto', borderRadius: 14 }}
    >
      <rect width="560" height="170" rx="14" fill="#0b1e4b" />
      <text x="24" y="28" fill="#fff" fontSize="14" fontWeight="800" fontFamily="system-ui, sans-serif">
        Concentrix Selection Pipeline • 6 Assessment Rounds
      </text>
      {stages.map((st, i) => {
        const x = 16 + i * 88;
        return (
          <g key={st.num}>
            <rect
              x={x}
              y="44"
              width="80"
              height="106"
              rx="10"
              fill={i % 2 === 0 ? '#1b4fa0' : '#223c72'}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
            />
            <circle cx={x + 40} cy="68" r="14" fill="#4d7cfe" />
            <text
              x={x + 40}
              y="73"
              fill="#fff"
              fontSize="13"
              fontWeight="800"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
            >
              {st.num}
            </text>
            <text
              x={x + 40}
              y="100"
              fill="#fff"
              fontSize="9.5"
              fontWeight="700"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
            >
              {st.title}
            </text>
            <text
              x={x + 40}
              y="120"
              fill="#9fb0cc"
              fontSize="8.5"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
            >
              {st.sub}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ConcentrixInterviewGuide() {
  const path = '/guides/concentrix-interview';
  const title = 'Concentrix Fresher Interview & Hiring Prep Playbook (2026)';
  const description =
    'Comprehensive Concentrix fresher preparation playbook: 6 selection rounds, 5-part self-introduction templates, 4-step customer handling model, OPS 1 & OPS 2 scenarios, and WriteX email guides.';
  return (
    <GuideShell
      title={title}
      lede="The complete field playbook for Concentrix voice and non-voice fresher hiring drives. From 'Tell me about yourself' word-for-word scripts to operations scenario handling and shift flexibility."
      path={path}
      description={description}
      graphic={<InterviewRoundsFlow />}
      jsonLd={articleLd(title, description, path)}
    >
      <h2>The 6 Concentrix Selection Rounds</h2>
      <p>
        Concentrix hiring drives for freshers evaluate candidates across six standard rounds depending on whether the
        opening is a <b>Voice Process</b> (international/domestic customer support) or a <b>Non-Voice Process</b> (email,
        chat, back-office data operations).
      </p>

      <div style={{ margin: '18px 0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#122550', textAlign: 'left' }}>
              <th style={{ padding: '10px 14px', color: '#fff' }}>Round</th>
              <th style={{ padding: '10px 14px', color: '#fff' }}>Core Skills Evaluated</th>
              <th style={{ padding: '10px 14px', color: '#fff' }}>Target Roles</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <td style={{ padding: '10px 14px', fontWeight: 600, color: '#38bdf8' }}>1. Communication</td>
              <td style={{ padding: '10px 14px' }}>Spoken English, JAM (Just-A-Minute), picture description, fluency & listening</td>
              <td style={{ padding: '10px 14px', color: '#9fb0cc' }}>All candidates (First filter)</td>
            </tr>
            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
              <td style={{ padding: '10px 14px', fontWeight: 600, color: '#38bdf8' }}>2. AMCAT Test</td>
              <td style={{ padding: '10px 14px' }}>English grammar, Logical Reasoning, Quantitative aptitude (Adaptive 30-32 min)</td>
              <td style={{ padding: '10px 14px', color: '#9fb0cc' }}>Voice & Non-voice</td>
            </tr>
            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <td style={{ padding: '10px 14px', fontWeight: 600, color: '#38bdf8' }}>3. OPS 1 (Ops Round 1)</td>
              <td style={{ padding: '10px 14px' }}>Interview with team leads: attitude, 24/7 rotational shifts, customer mindset</td>
              <td style={{ padding: '10px 14px', color: '#9fb0cc' }}>Voice & Non-voice</td>
            </tr>
            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
              <td style={{ padding: '10px 14px', fontWeight: 600, color: '#38bdf8' }}>4. OPS 2 (Ops Round 2)</td>
              <td style={{ padding: '10px 14px' }}>Senior manager round: live customer escalations, long-term stability & commitment</td>
              <td style={{ padding: '10px 14px', color: '#9fb0cc' }}>Voice & Non-voice</td>
            </tr>
            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <td style={{ padding: '10px 14px', fontWeight: 600, color: '#38bdf8' }}>5. Voice Test (SVAR/Versant)</td>
              <td style={{ padding: '10px 14px' }}>AI-graded spoken test: repeat sentences, read-aloud, short answers, story retelling</td>
              <td style={{ padding: '10px 14px', color: '#9fb0cc' }}>Voice roles</td>
            </tr>
            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
              <td style={{ padding: '10px 14px', fontWeight: 600, color: '#38bdf8' }}>6. Typing & WriteX</td>
              <td style={{ padding: '10px 14px' }}>Typing speed (25–35 WPM @ ≥95% accuracy), WriteX essay & professional emails</td>
              <td style={{ padding: '10px 14px', color: '#9fb0cc' }}>Non-voice & Chat/Email</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>The 5-Part Self-Introduction Framework</h2>
      <p>
        Every interview begins with <i>"Tell me about yourself."</i> Deliver a structured <b>45 to 60-second response</b> (120 to 150 words) that highlights communication, education, strengths, and role alignment without sounding rehearsed.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, margin: '16px 0 24px' }}>
        <div style={{ background: '#122550', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ color: '#38d98a', fontWeight: 700, fontSize: 13 }}>PART 1</div>
          <h4 style={{ margin: '4px 0 6px', color: '#fff' }}>Greeting & Name</h4>
          <p style={{ margin: 0, fontSize: 13, color: '#9fb0cc' }}>"Good morning, sir/ma'am. My name is [Your Name] and I am from [City]."</p>
        </div>
        <div style={{ background: '#122550', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ color: '#38d98a', fontWeight: 700, fontSize: 13 }}>PART 2</div>
          <h4 style={{ margin: '4px 0 6px', color: '#fff' }}>Education & Marks</h4>
          <p style={{ margin: 0, fontSize: 13, color: '#9fb0cc' }}>"I recently completed my graduation in [Degree] from [College/University] with [Percentage/CGPA]."</p>
        </div>
        <div style={{ background: '#122550', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ color: '#38d98a', fontWeight: 700, fontSize: 13 }}>PART 3</div>
          <h4 style={{ margin: '4px 0 6px', color: '#fff' }}>Skills & Strengths</h4>
          <p style={{ margin: 0, fontSize: 13, color: '#9fb0cc' }}>"My core strengths are active listening, patient communication, and quick adaptability under pressure."</p>
        </div>
        <div style={{ background: '#122550', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ color: '#38d98a', fontWeight: 700, fontSize: 13 }}>PART 4</div>
          <h4 style={{ margin: '4px 0 6px', color: '#fff' }}>Activities / Experience</h4>
          <p style={{ margin: 0, fontSize: 13, color: '#9fb0cc' }}>"During college, I coordinated cultural events and handled student queries, which honed my problem-solving skills."</p>
        </div>
        <div style={{ background: '#122550', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ color: '#38d98a', fontWeight: 700, fontSize: 13 }}>PART 5</div>
          <h4 style={{ margin: '4px 0 6px', color: '#fff' }}>Goal & Concentrix Fit</h4>
          <p style={{ margin: 0, fontSize: 13, color: '#9fb0cc' }}>"I am eager to begin my career in customer service with Concentrix, learn the process thoroughly, and grow into leadership."</p>
        </div>
      </div>

      <h3>Word-for-Word Self-Introduction Templates</h3>

      <div style={{ background: 'rgba(77,124,254,0.08)', border: '1px solid rgba(125,160,255,0.25)', borderRadius: 12, padding: '18px 20px', margin: '14px 0' }}>
        <h4 style={{ margin: '0 0 8px', color: '#38bdf8' }}>Template 1: Fresh Graduate (Anita Rao)</h4>
        <blockquote style={{ margin: 0, color: '#eaf1ff', fontStyle: 'italic', lineHeight: 1.65 }}>
          "Good morning. My name is Anita Rao, and I am from Hyderabad. I recently completed my B.Com from Osmania University with 72 percent. During college, I was part of the cultural committee, where I coordinated events and spoke with many people, which improved my communication and teamwork skills. I am a quick learner, patient, and always willing to help others. I am looking for a role where I can use my communication skills and grow professionally, and I believe a customer service role at Concentrix is a great starting point for that. Thank you."
        </blockquote>
      </div>

      <div style={{ background: 'rgba(77,124,254,0.08)', border: '1px solid rgba(125,160,255,0.25)', borderRadius: 12, padding: '18px 20px', margin: '14px 0' }}>
        <h4 style={{ margin: '0 0 8px', color: '#38bdf8' }}>Template 2: Voice Process Role (Rahul Verma)</h4>
        <blockquote style={{ margin: 0, color: '#eaf1ff', fontStyle: 'italic', lineHeight: 1.65 }}>
          "Hello, I am Rahul Verma. I completed my B.Sc in Computer Science this year. I enjoy talking to people and have been working on improving my spoken English by practising daily and listening to English podcasts. In college, I conducted presentations and worked as a student coordinator handling queries from juniors and guests. I am patient, adaptable, and completely comfortable with 24/7 rotational shift timings. I would like to begin my career in a voice process at Concentrix, where I can master customer handling and grow into a leadership role over time. Thank you."
        </blockquote>
      </div>

      <div style={{ background: 'rgba(77,124,254,0.08)', border: '1px solid rgba(125,160,255,0.25)', borderRadius: 12, padding: '18px 20px', margin: '14px 0' }}>
        <h4 style={{ margin: '0 0 8px', color: '#38bdf8' }}>Template 3: Non-Voice / Email & Chat Role (Sneha Reddy)</h4>
        <blockquote style={{ margin: 0, color: '#eaf1ff', fontStyle: 'italic', lineHeight: 1.65 }}>
          "Good afternoon. I am Sneha Reddy, and I have completed my B.A. in Economics. I have good typing speed, strong attention to detail, and sound knowledge of MS Office. During my final year, I completed a project that involved collecting and organising data, which strengthened my accuracy and time management. I am hardworking, disciplined, and eager to learn. I am interested in a non-voice role at Concentrix where I can apply my written communication skills and develop into a skilled professional. Thank you."
        </blockquote>
      </div>

      <div style={{ background: 'rgba(77,124,254,0.08)', border: '1px solid rgba(125,160,255,0.25)', borderRadius: 12, padding: '18px 20px', margin: '14px 0' }}>
        <h4 style={{ margin: '0 0 8px', color: '#38bdf8' }}>Template 4: Candidate with a Study or Career Gap (Kiran Kumar)</h4>
        <blockquote style={{ margin: 0, color: '#eaf1ff', fontStyle: 'italic', lineHeight: 1.65 }}>
          "Good morning. I am Kiran Kumar. I completed my B.Tech in 2023. After graduation, I took a year to take care of a family responsibility, and during that time I completed an online certification in business communication and practiced typing daily. Now I am fully ready to start my career with dedication. I am a dependable, disciplined person who adapts quickly to dynamic environments. I am keen to join Concentrix, learn the customer operations process, and grow with the company. Thank you."
        </blockquote>
      </div>

      <h2>The 4-Step Customer Handling Model</h2>
      <p>
        In both AMCAT Situational Judgment and OPS 1 & OPS 2 manager rounds, Concentrix interviewers evaluate whether
        you approach frustrated callers with a systematic, professional mindset:
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, margin: '18px 0' }}>
        <div style={{ background: '#0b1e4b', border: '1px solid #38bdf8', borderRadius: 10, padding: '14px 18px' }}>
          <h4 style={{ color: '#38bdf8', margin: '0 0 6px' }}>1. LISTEN</h4>
          <p style={{ margin: 0, fontSize: 13.5, color: '#c4d0e6' }}>
            Allow the customer to explain the entire situation without interruption. Do not talk over them, even if they are emotional or repeating themselves.
          </p>
        </div>
        <div style={{ background: '#0b1e4b', border: '1px solid #38d98a', borderRadius: 10, padding: '14px 18px' }}>
          <h4 style={{ color: '#38d98a', margin: '0 0 6px' }}>2. EMPATHISE</h4>
          <p style={{ margin: 0, fontSize: 13.5, color: '#c4d0e6' }}>
            Acknowledge their frustration sincerely: <i>"I completely understand how frustrating this delay has been for you, and I apologise for the trouble."</i>
          </p>
        </div>
        <div style={{ background: '#0b1e4b', border: '1px solid #f5a623', borderRadius: 10, padding: '14px 18px' }}>
          <h4 style={{ color: '#f5a623', margin: '0 0 6px' }}>3. RESOLVE</h4>
          <p style={{ margin: 0, fontSize: 13.5, color: '#c4d0e6' }}>
            Take personal ownership. Propose concrete action: <i>"Let me check your tracking details right now,"</i> or initiate an official escalation ticket with a confirmed timeline.
          </p>
        </div>
        <div style={{ background: '#0b1e4b', border: '1px solid #a855f7', borderRadius: 10, padding: '14px 18px' }}>
          <h4 style={{ color: '#a855f7', margin: '0 0 6px' }}>4. CONFIRM</h4>
          <p style={{ margin: 0, fontSize: 13.5, color: '#c4d0e6' }}>
            Summarise the outcome and verify satisfaction before ending: <i>"I have updated your address and initiated dispatch. Is there anything else I can assist you with today?"</i>
          </p>
        </div>
      </div>

      <h2>Top Operations (OPS 1 & OPS 2) Scenarios & Model Answers</h2>

      <p><b>Q1: A customer is shouting because their issue is still not resolved after multiple calls. What will you do?</b></p>
      <p>
        <i>"I will remain calm and maintain a steady, polite tone. I will let the caller finish venting completely without interrupting. Once they are done, I will acknowledge their frustration: 'I sincerely apologise for the inconvenience you experienced on your previous calls. I am taking personal ownership of your case right now.' I will review previous ticket notes, explain the exact next step, and provide a realistic timeline rather than an empty promise."</i>
      </p>

      <p><b>Q2: What will you do if a customer asks a question you do not know the answer to?</b></p>
      <p>
        <i>"I will never guess or provide incorrect information. I will politely place the customer on a brief hold: 'May I place you on a brief two-minute hold while I verify this with our technical desk?' I will consult the internal knowledge base or my team lead, and return with the verified, accurate solution."</i>
      </p>

      <p><b>Q3: Are you comfortable working night shifts and rotational schedules?</b></p>
      <p>
        <i>"Yes, absolutely. I understand that Concentrix provides 24/7 global customer support across international time zones. I have spoken with my family and have no transportation or scheduling constraints regarding rotational or night shifts."</i>
      </p>

      <p><b>Q4: Your shift is ending, but a customer's complex issue requires another 20 minutes. What do you do?</b></p>
      <p>
        <i>"Customer satisfaction and first-call resolution always take priority over logging off on the dot. I will see the customer's issue through to resolution, document comprehensive notes on the ticket, and inform my supervisor afterwards."</i>
      </p>

      <h2>WriteX Essay & Business Email Blueprints</h2>
      <p>
        For non-voice roles, the <b>WriteX round</b> evaluates formal written communication under a 20-minute timer.
        The AI grading engine scans for paragraph organization, subject-verb agreement, and correct business formatting.
      </p>

      <div style={{ background: '#122550', borderRadius: 12, padding: '16px 20px', margin: '14px 0' }}>
        <h4 style={{ color: '#fff', margin: '0 0 8px' }}>The 4-Paragraph Essay Structure (150–250 Words)</h4>
        <ul style={{ margin: 0, paddingLeft: 20, color: '#c4d0e6', fontSize: 14 }}>
          <li><b>Introduction (2 sentences):</b> Define the topic and state your perspective clearly.</li>
          <li><b>Body Paragraph 1 (3-4 sentences):</b> Present your primary argument supported by reasoning.</li>
          <li><b>Body Paragraph 2 (3-4 sentences):</b> Provide a real-world example or secondary viewpoint.</li>
          <li><b>Conclusion (2 sentences):</b> Summarize your key takeaway without introducing new arguments.</li>
          <li><i>Formatting rule:</i> Write in continuous paragraphs only. Never use bullet points or abbreviations in WriteX.</li>
        </ul>
      </div>

      <h3>Sample Professional Email: Resignation</h3>
      <div style={{ background: '#0b1e4b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '16px 18px', margin: '12px 0', fontFamily: 'monospace', fontSize: 13, color: '#eaf1ff' }}>
        <p style={{ margin: '0 0 6px', color: '#38bdf8' }}>Subject: Resignation – Anita Rao</p>
        <p style={{ margin: '0 0 6px' }}>Dear [Manager's Name],</p>
        <p style={{ margin: '0 0 6px' }}>
          I am writing to formally resign from my position as Customer Support Associate, effective [Date], in accordance with my notice period.
        </p>
        <p style={{ margin: '0 0 6px' }}>
          Thank you for the guidance and opportunities you have provided during my tenure. I will ensure all pending customer cases and documentation are handed over smoothly before my departure.
        </p>
        <p style={{ margin: '0 0 6px' }}>Please let me know if there is anything I can do to facilitate a seamless transition.</p>
        <p style={{ margin: 0 }}>Regards,<br />Anita Rao</p>
      </div>

      <h3>Sample Professional Email: Customer Apology for Delayed Delivery</h3>
      <div style={{ background: '#0b1e4b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '16px 18px', margin: '12px 0', fontFamily: 'monospace', fontSize: 13, color: '#eaf1ff' }}>
        <p style={{ margin: '0 0 6px', color: '#38bdf8' }}>Subject: Update on Order #458921 – Expedited Delivery Status</p>
        <p style={{ margin: '0 0 6px' }}>Dear Mr. Sharma,</p>
        <p style={{ margin: '0 0 6px' }}>
          I sincerely apologise for the delay in the delivery of your package (Order #458921). We understand how important this order is to you.
        </p>
        <p style={{ margin: '0 0 6px' }}>
          We have expedited your shipment with our courier partner. Your package is currently in transit and scheduled to reach your registered address by Friday, 12 March. You can track live movement using the link below.
        </p>
        <p style={{ margin: '0 0 6px' }}>Thank you for your patience and understanding.</p>
        <p style={{ margin: 0 }}>Warm regards,<br />Customer Care Team, Concentrix</p>
      </div>

      <h2>Interview Day Checklist</h2>
      <ul style={{ color: '#c4d0e6', fontSize: 14.5, lineHeight: 1.8, paddingLeft: 22 }}>
        <li><b>Mandatory Documents:</b> Updated 1-page resume, government photo ID (Aadhaar / PAN / Passport), marksheets (10th, 12th, graduation degree/provisional), 2 passport-size photographs.</li>
        <li><b>Equipment for Virtual Drives:</b> Quiet room, stable WiFi, working webcam, and a wired headset with dedicated noise-canceling mic (phone earbuds often cause SVAR volume drops).</li>
        <li><b>Attire:</b> Formal or smart business casual. First impressions in OPS 1 start the moment you enter the frame.</li>
        <li><b>Arrival:</b> Join the waiting lobby or report to the venue 20–30 minutes before your scheduled slot.</li>
      </ul>
    </GuideShell>
  );
}

