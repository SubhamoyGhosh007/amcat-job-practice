import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Clock, FileText, Send, Sparkles, BookOpen } from 'lucide-react';

const ESSAY_TOPICS = [
  'Social media: boon or bane?',
  'Importance of punctuality in professional life',
  'Work from home vs work from office: which is better?',
  'Teamwork: why collaboration matters more than individual effort',
  'Technology and children: benefits and drawbacks',
  'Is life better in a small town or a big city?',
  'Should college students work part-time?',
  'My ideal workplace and work culture',
  'A habit that changed my life',
  'Do you believe in ghosts and the paranormal?',
  'Zodiac signs: scientific fact or harmless fun?',
  'Superheroes: why modern society needs modern icons',
];

const EMAIL_PROMPTS = [
  {
    id: 'resignation',
    title: 'Formal Resignation Email',
    scenario: 'Write a professional resignation email to your manager stating your final working day as per your notice period, thanking them for the opportunity, and offering a smooth handover.',
    modelSubject: 'Resignation – [Your Name]',
    modelBody: `Dear [Manager's Name],

I am writing to formally resign from my position as Customer Support Associate, effective [Date], in accordance with my notice period.

Thank you for the guidance and opportunities you have given me during my tenure. I have learned a great deal and will ensure that all my pending tasks and documentation are handed over smoothly before my departure.

Please let me know if there is anything I can do to facilitate a seamless transition.

Regards,
[Your Name]`,
  },
  {
    id: 'leave',
    title: 'Leave Request for Three Days',
    scenario: 'Write an email to your team lead requesting 3 days of planned leave due to personal commitments. Mention that you have informed your backup colleague.',
    modelSubject: 'Leave Request: [Dates] – [Your Name]',
    modelBody: `Dear [Manager's Name],

I am writing to request three days of leave from [Start Date] to [End Date] due to an urgent personal family commitment.

Before applying, I ensured that all my high-priority tickets are resolved. My colleague [Colleague's Name] has agreed to cover my critical shift queries while I am away.

I will resume work promptly on [Return Date]. Thank you for your understanding.

Warm regards,
[Your Name]`,
  },
  {
    id: 'apology',
    title: 'Customer Apology for Delayed Order (#458921)',
    scenario: 'A customer’s mobile phone package (Order #458921) is delayed. Write an empathetic email apologising, giving the updated delivery date (Friday), and sharing the tracking link.',
    modelSubject: 'Update on Order #458921 – Expedited Delivery Status',
    modelBody: `Dear Mr. Sharma,

I sincerely apologise for the unexpected delay in the delivery of your package (Order #458921). We understand how important it was for this shipment to arrive on time.

We have contacted our express courier partner and escalated the transit priority. Your parcel is now at your local delivery hub and is scheduled to reach your address by Friday afternoon. You can view real-time movement using the tracking link below.

Thank you very much for your patience and support.

Warm regards,
Customer Support Team, Concentrix`,
  },
  {
    id: 'extension',
    title: 'Deadline Extension Request',
    scenario: 'You are working on a quality audit report due today at 5 PM. Due to unexpected data verification, you need until tomorrow 11 AM. Write to your supervisor.',
    modelSubject: 'Request for Deadline Extension: Quality Audit Report',
    modelBody: `Dear [Supervisor's Name],

I am writing to request a brief extension for the submission of the Weekly Quality Audit Report, originally scheduled for 5:00 PM today.

While compiling the data, I identified discrepancies in yesterday's call logs that require additional verification to ensure accuracy. I anticipate needing until 11:00 AM tomorrow to complete this thorough cross-check.

I apologise for any inconvenience and appreciate your consideration.

Sincerely,
[Your Name]`,
  },
];

const BEHAVIORAL_QUESTIONS = [
  {
    id: 'b1',
    question: 'A colleague is on emergency medical leave and you are assigned their extra workload on top of your own queue. What will you do?',
    options: [
      { text: 'Prioritise critical customer queries, organise tasks by urgency, and collaborate with the team lead to manage the surge smoothly.', correct: true },
      { text: 'Refuse the extra tasks because it is outside your standard daily job description.', correct: false },
      { text: 'Rush through all tickets without verifying details to clear numbers quickly.', correct: false },
      { text: 'Complain to HR about unfair task distribution.', correct: false },
    ],
    rationale: 'Concentrix values queue ownership and teamwork. Prioritising by urgency protects customer satisfaction during temporary staff shortages.',
  },
  {
    id: 'b2',
    question: 'A customer is angry, shouting and claiming that "the company always cheats people". How do you respond?',
    options: [
      { text: 'Listen calmly until they finish venting, validate their frustration politely ("I understand how upsetting this delay is"), and take immediate ownership to investigate.', correct: true },
      { text: 'Argue back immediately and state that our company never cheats.', correct: false },
      { text: 'Disconnect the call because the customer raised their voice.', correct: false },
      { text: 'Put them on silent hold without permission until they calm down.', correct: false },
    ],
    rationale: 'Active empathy de-escalates anger. Never take aggression personally or argue back.',
  },
  {
    id: 'b3',
    question: 'You respectfully disagree with a procedural decision made by your team lead. What is the most professional move?',
    options: [
      { text: 'Request a brief 1-on-1 private discussion, explain your reasoning and suggestions politely, and respect the final decision made by the lead.', correct: true },
      { text: 'Argue loudly during the daily team huddle in front of all teammates.', correct: false },
      { text: 'Ignore the lead’s instructions and follow your own method quietly.', correct: false },
      { text: 'Send an escalation email to upper management without talking to your lead first.', correct: false },
    ],
    rationale: 'Private, constructive feedback demonstrates emotional maturity and respect for workplace hierarchy.',
  },
  {
    id: 'b4',
    question: 'You realise you made a billing mistake on a customer ticket 2 hours ago that nobody else has noticed yet. What should you do?',
    options: [
      { text: 'Immediately flag the mistake to your supervisor or quality lead, rectify the record, and inform the customer if required.', correct: true },
      { text: 'Stay quiet and hope quality auditors do not sample that call.', correct: false },
      { text: 'Blame the system glitch if anyone discovers it later.', correct: false },
      { text: 'Delete the ticket audit history.', correct: false },
    ],
    rationale: 'Integrity and ownership are core values. Self-reporting mistakes protects customers from downstream billing errors.',
  },
  {
    id: 'b5',
    question: 'You have two high-priority tasks due at 4:00 PM simultaneously. You realise you cannot finish both alone. What do you do?',
    options: [
      { text: 'Proactively inform your team lead early, explain the status of both tasks, and request help or an agreed order of priority.', correct: true },
      { text: 'Wait silently until 4:00 PM and explain that you ran out of time.', correct: false },
      { text: 'Complete half of both tasks with low quality.', correct: false },
      { text: 'Leave early to avoid the deadline confrontation.', correct: false },
    ],
    rationale: 'Proactive communication gives management time to reallocate resources or adjust timelines without missing customer SLA.',
  },
];

export default function WriteX() {
  const [activeTab, setActiveTab] = useState<'essay' | 'email' | 'behavioral'>('essay');

  // Essay State
  const [essayTopic, setEssayTopic] = useState(ESSAY_TOPICS[0]);
  const [essayText, setEssayText] = useState('');
  const [essaySecs, setEssaySecs] = useState(20 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [submittedEssay, setSubmittedEssay] = useState(false);

  // Email State
  const [emailPromptIdx, setEmailPromptIdx] = useState(0);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [showEmailModel, setShowEmailModel] = useState(false);

  // Behavioral State
  const [surveyPicks, setSurveyPicks] = useState<Record<string, number>>({});
  const [surveyChecked, setSurveyChecked] = useState(false);

  // Timer countdown
  useEffect(() => {
    if (!timerRunning || essaySecs <= 0) return;
    const t = window.setInterval(() => {
      setEssaySecs((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [timerRunning, essaySecs]);

  // Essay Analysis Metrics
  const essayMetrics = useMemo(() => {
    const raw = essayText.trim();
    if (!raw) {
      return {
        wordCount: 0,
        charCount: 0,
        paragraphs: 0,
        hasBullets: false,
        capitalsOk: true,
        punctuationOk: true,
        trickyWords: [],
      };
    }

    const words = raw.split(/\s+/).filter(Boolean);
    const paragraphs = essayText.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
    const hasBullets = /^[*\-•]/m.test(essayText) || essayText.includes(' - ') || essayText.includes(' * ');

    // Check sentence capitalization
    const sentences = raw.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 2);
    const lowercaseSentences = sentences.filter((s) => /^[a-z]/.test(s));
    const capitalsOk = lowercaseSentences.length === 0 && !/\bi\b/.test(raw);

    // Punctuation space check (e.g. word,word without space)
    const punctuationOk = !/,[a-zA-Z]|\.[a-zA-Z]/.test(raw);

    // Tricky words check
    const trickyList = ['definitely', 'environment', 'separate', 'receive', 'schedule', 'maintenance', 'convenient'];
    const trickyFound = trickyList.filter((tw) => raw.toLowerCase().includes(tw));

    return {
      wordCount: words.length,
      charCount: raw.length,
      paragraphs,
      hasBullets,
      capitalsOk,
      punctuationOk,
      trickyWords: trickyFound,
    };
  }, [essayText]);

  const currentEmail = EMAIL_PROMPTS[emailPromptIdx];

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  return (
    <div>
      <div className="page-hero">
        <h2>WriteX & Non-Voice Arena</h2>
        <p>
          Concentrix non-voice evaluation test simulator: 20-minute timed essay grading, formal business email drafting,
          and behavioral situation surveys.
        </p>
        <div style={{ marginTop: 10 }}>
          <span className="chip ghost">✍️ 150–250 Words Target</span>{' '}
          <span className="chip ghost">⏱ 20 Min Timer</span>{' '}
          <span className="chip green">Automated Rules & Structure Check</span>
        </div>
      </div>

      <div className="svar-tabs">
        <button
          className={`radio-pill ${activeTab === 'essay' ? 'active' : ''}`}
          onClick={() => setActiveTab('essay')}
          style={{ fontWeight: 600, padding: '8px 16px' }}
        >
          📝 Timed Essay (20 min)
        </button>
        <button
          className={`radio-pill ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')}
          style={{ fontWeight: 600, padding: '8px 16px' }}
        >
          ✉️ Business Email Drafting
        </button>
        <button
          className={`radio-pill ${activeTab === 'behavioral' ? 'active' : ''}`}
          onClick={() => setActiveTab('behavioral')}
          style={{ fontWeight: 600, padding: '8px 16px' }}
        >
          🧠 Behavioral Situational Survey
        </button>
      </div>

      {/* ---------------- TAB 1: ESSAY ---------------- */}
      {activeTab === 'essay' && (
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: '0 0 4px' }}>Concentrix WriteX Essay Simulator</h3>
                <p className="hint" style={{ margin: 0 }}>
                  20 minutes allotted. The AI grader assesses word count, 4-paragraph structure, capitalization, and punctuation.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24, fontWeight: 800, fontFamily: 'monospace', color: essaySecs < 180 ? '#d64545' : '#38bdf8' }}>
                  <Clock size={20} style={{ verticalAlign: '-3px', marginRight: 6 }} />
                  {formatTime(essaySecs)}
                </span>
                <button
                  className={timerRunning ? 'btn-ghost' : 'btn-primary'}
                  onClick={() => setTimerRunning(!timerRunning)}
                >
                  {timerRunning ? 'Pause Timer' : 'Start 20m Timer'}
                </button>
              </div>
            </div>
          </div>

          <div className="svar-card">
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#9fb0cc', marginBottom: 6 }}>
              Select Essay Prompt:
            </label>
            <select
              value={essayTopic}
              onChange={(e) => {
                setEssayTopic(e.target.value);
                setSubmittedEssay(false);
              }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                background: '#122550',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                fontSize: 15,
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              {ESSAY_TOPICS.map((top) => (
                <option key={top} value={top}>{top}</option>
              ))}
            </select>

            <div style={{ background: 'rgba(77,124,254,0.06)', border: '1px solid rgba(125,160,255,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
              <b style={{ color: '#38bdf8', fontSize: 13, textTransform: 'uppercase' }}>Structure Guide:</b>
              <div style={{ fontSize: 13.5, color: '#c4d0e6', marginTop: 4 }}>
                Paragraph 1: Introduction (2 lines) • Paragraph 2: Point 1 with reason • Paragraph 3: Point 2 with real-world example • Paragraph 4: Conclusion (2 lines). <b>No bullet points.</b>
              </div>
            </div>

            <textarea
              placeholder="Write your essay here in clean paragraphs. Press Enter twice to start a new paragraph..."
              value={essayText}
              onChange={(e) => setEssayText(e.target.value)}
              rows={12}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: '#fff',
                color: '#111827',
                fontSize: 15,
                lineHeight: 1.7,
                boxSizing: 'border-box',
                fontFamily: 'system-ui, sans-serif',
              }}
            />

            {/* Live Metrics bar */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="hint">Words:</span>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 16,
                    color:
                      essayMetrics.wordCount >= 150 && essayMetrics.wordCount <= 250
                        ? '#1e9e62'
                        : essayMetrics.wordCount >= 100
                        ? '#3157d8'
                        : '#d64545',
                  }}
                >
                  {essayMetrics.wordCount}
                </span>
                <span className="hint">(target: 150–250, limit: 100–400)</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="hint">Paragraphs:</span>
                <span style={{ fontWeight: 800, color: essayMetrics.paragraphs >= 3 ? '#1e9e62' : '#f5a623' }}>
                  {essayMetrics.paragraphs} / 4
                </span>
              </div>
            </div>

            {/* Checklist cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 14 }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: essayMetrics.paragraphs >= 3 ? 'rgba(30,158,98,0.06)' : 'transparent' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {essayMetrics.paragraphs >= 3 ? '✅ Paragraphs: Good' : '⚠ Aim for 4 paragraphs'}
                </span>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: !essayMetrics.hasBullets ? 'rgba(30,158,98,0.06)' : 'rgba(214,69,69,0.08)' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: essayMetrics.hasBullets ? '#d64545' : 'inherit' }}>
                  {!essayMetrics.hasBullets ? '✅ No bullet points' : '❌ Remove bullet points (-) or (*)'}
                </span>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: essayMetrics.capitalsOk ? 'rgba(30,158,98,0.06)' : 'rgba(245,166,35,0.08)' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {essayMetrics.capitalsOk ? '✅ Sentence Capitalization' : '⚠ Check start capitals / "I"'}
                </span>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: essayMetrics.punctuationOk ? 'rgba(30,158,98,0.06)' : 'rgba(245,166,35,0.08)' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {essayMetrics.punctuationOk ? '✅ Punctuation Spacing' : '⚠ Space after commas & full stops'}
                </span>
              </div>
            </div>

            <div className="btnrow" style={{ marginTop: 18 }}>
              <button
                className="btn-big"
                disabled={essayMetrics.wordCount < 50}
                onClick={() => setSubmittedEssay(true)}
              >
                Evaluate Essay Score ✓
              </button>
            </div>

            {submittedEssay && (
              <div className="card" style={{ marginTop: 16, background: '#122550', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}>
                <h3 style={{ margin: '0 0 10px', color: '#38bdf8' }}>WriteX Evaluation Report</h3>
                <div style={{ fontSize: 36, fontWeight: 800, color: essayMetrics.wordCount >= 150 && !essayMetrics.hasBullets ? '#38d98a' : '#f5a623' }}>
                  {Math.min(10, Math.round(
                    (essayMetrics.wordCount >= 150 ? 4 : essayMetrics.wordCount >= 100 ? 2 : 1) +
                    (essayMetrics.paragraphs >= 3 ? 3 : 1) +
                    (!essayMetrics.hasBullets ? 2 : 0) +
                    (essayMetrics.capitalsOk ? 1 : 0)
                  ))}/10 Marks
                </div>

                <ul style={{ paddingLeft: 20, margin: '12px 0 0', lineHeight: 1.7, fontSize: 14 }}>
                  <li><b>Length:</b> {essayMetrics.wordCount} words ({essayMetrics.wordCount >= 150 ? 'Strong score — met hiring target' : 'Consider expanding with an extra example to reach 150+ words'}).</li>
                  <li><b>Format:</b> {essayMetrics.hasBullets ? 'Deduction: WriteX strictly forbids bullet points. Merge into paragraphs.' : 'Excellent continuous paragraph format.'}</li>
                  <li><b>Paragraph Count:</b> {essayMetrics.paragraphs} separate paragraphs detected.</li>
                  <li><b>Mechanics:</b> Capitalization {essayMetrics.capitalsOk ? 'verified' : 'needs review'}; punctuation {essayMetrics.punctuationOk ? 'clean' : 'ensure one space after commas and periods'}.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- TAB 2: EMAIL ---------------- */}
      {activeTab === 'email' && (
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 6px' }}>Business Email Drafting Facility</h3>
            <p className="hint" style={{ margin: 0 }}>
              Master standard workplace email communication required for non-voice, email, and blended support roles.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {EMAIL_PROMPTS.map((p, idx) => (
              <button
                key={p.id}
                className={`radio-pill ${emailPromptIdx === idx ? 'active' : ''}`}
                onClick={() => {
                  setEmailPromptIdx(idx);
                  setEmailSubject('');
                  setEmailBody('');
                  setShowEmailModel(false);
                }}
              >
                {p.title}
              </button>
            ))}
          </div>

          <div className="svar-card">
            <span className="topic">{currentEmail.title} • Scenario</span>
            <div style={{ fontSize: 15, fontWeight: 500, margin: '8px 0 16px', lineHeight: 1.6, color: '#eaf1ff' }}>
              {currentEmail.scenario}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#9fb0cc', marginBottom: 6 }}>
                Subject Line:
              </label>
              <input
                type="text"
                placeholder="e.g. Resignation – [Your Name] or Update on Order #458921"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 14.5,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#9fb0cc', marginBottom: 6 }}>
                Email Body:
              </label>
              <textarea
                placeholder="Dear [Name],\n\nWrite your formal opening line, two body paragraphs, and professional closing..."
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={10}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 14.5,
                  lineHeight: 1.65,
                  boxSizing: 'border-box',
                  fontFamily: 'system-ui, sans-serif',
                }}
              />
            </div>

            <div className="btnrow" style={{ marginTop: 0 }}>
              <button
                className="btn-ghost"
                onClick={() => setShowEmailModel(!showEmailModel)}
              >
                {showEmailModel ? 'Hide Model Email ▲' : 'Compare with Approved Concentrix Model Email ▼'}
              </button>
            </div>

            {showEmailModel && (
              <div style={{ marginTop: 16, background: '#122550', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '16px 20px', color: '#fff' }}>
                <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
                  Subject: {currentEmail.modelSubject}
                </div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, color: '#eaf1ff', lineHeight: 1.65 }}>
                  {currentEmail.modelBody}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- TAB 3: BEHAVIORAL ---------------- */}
      {activeTab === 'behavioral' && (
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 6px' }}>Behavioral Situational Judgment Survey</h3>
            <p className="hint" style={{ margin: 0 }}>
              Unscored in official hiring, but recruiters review consistency and customer-centric mindset across all answers.
            </p>
          </div>

          {BEHAVIORAL_QUESTIONS.map((q, qidx) => {
            const picked = surveyPicks[q.id];
            const isDone = surveyChecked;
            const chosen = picked !== undefined ? q.options[picked] : null;

            return (
              <div className="svar-card" key={q.id}>
                <div className="qnum">Scenario #{qidx + 1}</div>
                <div style={{ fontSize: 16.5, fontWeight: 600, margin: '8px 0 14px', lineHeight: 1.55 }}>
                  {q.question}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {q.options.map((opt, oi) => (
                    <label
                      key={oi}
                      className={`opt ${picked === oi ? 'selected' : ''}`}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 8,
                        fontSize: 14,
                        lineHeight: 1.5,
                        cursor: isDone ? 'default' : 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        disabled={isDone}
                        checked={picked === oi}
                        onChange={() => setSurveyPicks({ ...surveyPicks, [q.id]: oi })}
                      />
                      <span>{opt.text}</span>
                    </label>
                  ))}
                </div>

                {isDone && chosen && (
                  <div className={`rev ${chosen.correct ? 'correct' : 'wrong'}`} style={{ marginTop: 12 }}>
                    <div className="qnum">{chosen.correct ? '✅ Ideal Professional Choice' : '⚠ Suboptimal Choice'}</div>
                    <div className="exp" style={{ marginTop: 4, fontSize: 13.5 }}>{q.rationale}</div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="btnrow">
            {!surveyChecked ? (
              <button
                className="btn-big"
                disabled={Object.keys(surveyPicks).length < BEHAVIORAL_QUESTIONS.length}
                onClick={() => setSurveyChecked(true)}
              >
                Submit Survey Responses ✓
              </button>
            ) : (
              <button
                className="btn-ghost"
                onClick={() => {
                  setSurveyPicks({});
                  setSurveyChecked(false);
                }}
              >
                Reset Survey ↻
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
