import { useEffect, useState } from 'react';
import type { Question } from '../types';
import { MATH_TOPICS, mathTopicName } from '../data/mathTopics';
import { generateMathSet } from '../lib/mathGen';
import {
  deleteMathSession,
  listMathSessions,
  mathSessionFromAnswers,
  saveMathSession,
  type MathSession,
} from '../lib/mathStore';
import { formatWait, mathQuotaStatus } from '../lib/mathQuota';
import { downloadMathSheet } from '../lib/pdf';
import { useSession } from '../stores/session';
import { useConfirm } from '../ui/alert-dialog';
import { PaginationControl } from '../ui/pagination';

const PER_PAGE = 10;

type Phase = 'idle' | 'loading' | 'answering' | 'sheet';

function TopicGrid() {
  return (
    <div className="hover-grid">
      {MATH_TOPICS.map((t, i) => (
        <div className="hover-card" key={t.id}>
          <div className="glow" />
          <span className="tag">4 Q • {['#4d7cfe', '#38bdf8', '#38d98a', '#f5a623'][i % 4]}</span>
          <h3>{t.name}</h3>
          <p>{t.what}</p>
        </div>
      ))}
    </div>
  );
}

function AnswerCard({ q, n, mine }: { q: Question; n: number; mine: number | undefined }) {
  const ok = mine === q.answerIndex;
  return (
    <div className="svar-card" style={{ borderLeft: `4px solid ${ok ? '#1e9e62' : '#d64545'}` }}>
      <span className="topic">
        Q{n} • {mathTopicName(q.topic)} • {ok ? '✅ Correct' : '❌ Wrong'}
      </span>
      <div style={{ fontWeight: 700, fontSize: 16, margin: '8px 0' }}>{q.prompt}</div>
      {q.options.map((op, i) => {
        const isRight = i === q.answerIndex;
        const isMine = i === mine;
        return (
          <div
            key={i}
            className={`opt ${isRight ? 'selected' : ''}`}
            style={
              isRight
                ? { borderColor: '#1e9e62', background: '#e9f7ef' }
                : isMine
                  ? { borderColor: '#d64545', background: '#fdeeee' }
                  : undefined
            }
          >
            <span>
              <b>{'ABCD'[i]}.</b> {op}
              {isRight && ' ✓ actual answer'}
              {isMine && !isRight && ' ← you wrote this'}
            </span>
          </div>
        );
      })}
      <div className="svar-tip">
        <b>How to solve:</b> {q.explanation}
      </div>
      {q.trick && (
        <div className="svar-tip" style={{ borderColor: '#f5a623' }}>
          <b>⚡ Trick:</b> {q.trick}
        </div>
      )}
    </div>
  );
}

export default function MathPractice() {
  const ask = useConfirm();
  const userId = useSession((s) => s.userId);
  const email = useSession((s) => s.email);
  const profile = useSession((s) => s.profile);
  const tier = profile?.tier ?? 'free';

  const [phase, setPhase] = useState<Phase>('idle');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [page, setPage] = useState(0);
  const [session, setSession] = useState<MathSession | null>(null);
  const [history, setHistory] = useState<MathSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    listMathSessions(userId).then(setHistory).catch(() => {});
  }, [userId]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);
  void now;

  async function refreshWait() {
    const q = await mathQuotaStatus(userId, tier);
    setWait(q.allowed ? 0 : q.retryInMs);
    return q;
  }

  useEffect(() => {
    refreshWait().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tier]);

  async function start() {
    setError('');
    const q = await mathQuotaStatus(userId, tier);
    if (!q.allowed) {
      setWait(q.retryInMs);
      setError(`Free plan: 1 maths session every 4 hours — next one in ${formatWait(q.retryInMs)}. Pro users practise unlimited.`);
      return;
    }
    setLoading(true);
    setPhase('loading');
    try {
      const qs = await generateMathSet();
      setQuestions(qs);
      setAnswers({});
      setPage(0);
      setSession(null);
      setPhase('answering');
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      setError(e?.message || 'AI is busy — retry in a minute.');
      setPhase('idle');
    } finally {
      setLoading(false);
    }
  }

  function pick(qid: string, i: number) {
    setAnswers((a) => ({ ...a, [qid]: i }));
  }

  async function submit() {
    const unanswered = questions.filter((q) => answers[q.id] === undefined).length;
    if (unanswered > 0) {
      const ok = await ask({
        title: `Submit with ${unanswered} unanswered?`,
        description: 'No negative marking — but unanswered questions score zero. Submit anyway?',
        actionLabel: 'Submit sheet',
      });
      if (!ok) return;
    }
    const s = mathSessionFromAnswers(
      { userId: userId!, username: profile?.username || (email ? email.split('@')[0] : 'friend') },
      questions,
      answers
    );
    setSession(s);
    setPhase('sheet');
    window.scrollTo({ top: 0 });
    saveMathSession(s)
      .then(() => listMathSessions(userId).then(setHistory).catch(() => {}))
      .catch(() => {});
    refreshWait().catch(() => {});
  }

  function openHistory(s: MathSession) {
    setSession(s);
    setQuestions(s.questions);
    setAnswers(s.answers);
    setPhase('sheet');
    window.scrollTo({ top: 0 });
  }

  async function remove(id: string) {
    const ok = await ask({
      title: 'Delete this maths session?',
      description: 'Its sheet will be removed. This cannot be undone.',
      actionLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await deleteMathSession(id);
    setHistory((h) => h.filter((x) => x.id !== id));
  }

  const totalPages = Math.max(1, Math.ceil(questions.length / PER_PAGE));
  const pageQs = questions.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const answered = questions.filter((q) => answers[q.id] !== undefined).length;
  const topicsPresent = MATH_TOPICS.filter((t) => (session?.questions || []).some((q) => q.topic === t.id));

  return (
    <div>
      <div className="page-hero">
        <h2>Maths practice</h2>
        <p>
          40 AMCAT quant questions in one sitting — 4 from each of the 10 maths families. Answer on paginated sheets,
          then get your answer script: what you wrote, the actual answer, how to solve it, and the speed tricks.
        </p>
        <div style={{ marginTop: 10 }}>
          <span className="chip ghost">🧮 40 Q • 10 topics</span>{' '}
          <span className="chip ghost">📄 PDF sheet + tricks</span>{' '}
          {tier === 'pro' ? (
            <span className="chip green">Pro • unlimited</span>
          ) : wait > 0 ? (
            <span className="chip" style={{ background: '#fdeeee', color: '#b33737' }}>⏳ next free in {formatWait(wait)}</span>
          ) : (
            <span className="chip green">Free • 1 per 4h ready</span>
          )}
        </div>
      </div>

      {error && (
        <div className="banner warn" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {phase === 'idle' && (
        <>
          <TopicGrid />
          <div className="card" style={{ textAlign: 'center', marginTop: 14 }}>
            <button className="btn-big" disabled={loading} onClick={start}>
              {loading ? 'Generating 40 fresh questions…' : 'Generate my 40-question set →'}
            </button>
            <p className="hint">Fresh AI questions every session • no two sets alike • quota checked before generating.</p>
          </div>
        </>
      )}

      {phase === 'loading' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 40 }}>🧮</div>
          <h3>Setting 40 questions…</h3>
          <p className="hint">Fresh numbers, fresh sentences — 4 from each maths family.</p>
        </div>
      )}

      {phase === 'answering' && (
        <>
          <div className="card" style={{ position: 'sticky', top: 8, zIndex: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <b>
                Page {page + 1} of {totalPages} • answered {answered}/{questions.length}
              </b>
              <button className="btn-primary" onClick={submit}>
                Submit sheet ✓
              </button>
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }} aria-hidden>
              {questions.map((q, i) => (
                <span
                  key={q.id}
                  onClick={() => setPage(Math.floor(i / PER_PAGE))}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    fontSize: 11,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: answers[q.id] !== undefined ? '#1e9e62' : Math.floor(i / PER_PAGE) === page ? '#1b4fa0' : '#d9e0ea',
                    color: '#fff',
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
              ))}
            </div>
          </div>

          {pageQs.map((q, pi) => (
            <div className="svar-card" key={q.id}>
              <span className="topic">
                Q{page * PER_PAGE + pi + 1} • {mathTopicName(q.topic)}
              </span>
              <div style={{ fontWeight: 700, fontSize: 17, margin: '8px 0 4px' }}>{q.prompt}</div>
              {q.options.map((op, i) => (
                <div
                  key={i}
                  role="radio"
                  aria-checked={answers[q.id] === i}
                  tabIndex={0}
                  className={`opt ${answers[q.id] === i ? 'selected' : ''}`}
                  onClick={() => pick(q.id, i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      pick(q.id, i);
                    }
                  }}
                >
                  <span>
                    <b>{'ABCD'[i]}.</b> {op}
                  </span>
                </div>
              ))}
              <div className="btnrow" style={{ marginBottom: 0 }}>
                <button
                  className="btn-ghost"
                  onClick={() =>
                    setAnswers((a) => {
                      const n = { ...a };
                      delete n[q.id];
                      return n;
                    })
                  }
                >
                  Clear
                </button>
              </div>
            </div>
          ))}

          <div className="card">
            <PaginationControl page={page} totalPages={totalPages} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            <div className="btnrow" style={{ justifyContent: 'center', marginTop: 12, marginBottom: 0 }}>
              <button className="btn-big" onClick={submit}>
                Submit sheet ✓ ({answered}/{questions.length})
              </button>
            </div>
          </div>
        </>
      )}

      {phase === 'sheet' && session && (
        <>
          <div className="card" style={{ textAlign: 'center', background: 'linear-gradient(135deg,#0b1e4b,#1b4fa0)', color: '#fff', border: 'none' }}>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{new Date(session.at).toLocaleString()} • 40 questions</div>
            <div style={{ fontSize: 52, fontWeight: 800 }}>{session.pct}%</div>
            <div>
              {session.correct} correct out of {session.total}
            </div>
            <div className="btnrow" style={{ justifyContent: 'center', marginTop: 12, marginBottom: 0 }}>
              <button className="btn-ghost" onClick={() => downloadMathSheet(session)}>
                ⬇ Download sheet PDF
              </button>
              <button className="btn-big" onClick={() => { setPhase('idle'); setSession(null); }}>
                New session →
              </button>
            </div>
          </div>

          {session.questions.map((q, i) => (
            <AnswerCard key={q.id} q={q} n={i + 1} mine={session.answers[q.id]} />
          ))}

          <div className="card">
            <h3 style={{ marginTop: 0 }}>⚡ Speed tricks to keep</h3>
            {topicsPresent.map((t) => (
              <p key={t.id} style={{ fontSize: 14 }}>
                <b>{t.name}:</b> {t.trick}
              </p>
            ))}
          </div>
        </>
      )}

      <h3>
        Past maths sessions {history.length > 0 && <span className="hint">• {history.length} saved</span>}
      </h3>
      {!history.length && <p className="hint">No sessions yet — finish one above and it lands here with its PDF.</p>}
      {history.map((h) => (
        <div className="t-row" key={h.id}>
          <div className="ring" style={{ '--p': h.pct } as any}>
            <span>{h.pct}%</span>
          </div>
          <div className="meta">
            <div style={{ fontWeight: 700 }}>
              {h.correct}/{h.total} correct
            </div>
            <div className="hint">{new Date(h.at).toLocaleString()}</div>
          </div>
          <div className="btnrow" style={{ marginTop: 0 }}>
            <button className="btn-ghost" onClick={() => openHistory(h)}>
              View sheet
            </button>
            <button className="btn-ghost" onClick={() => downloadMathSheet(h)}>
              PDF
            </button>
            <button className="btn-ghost" onClick={() => remove(h.id)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
