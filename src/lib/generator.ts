import { BANK } from '../data/bank';
import { SECTIONS, type ExamSet, type Question, type SectionId } from '../types';
import { fetchUnattempted, publishSet, type BankSource, type Difficulty } from './bank';
import { geminiViaProxy, ttsConfigured } from './tts';
import { useSession } from '../stores/session';

// Config comes ONLY from build-time env (.env file / deploy dashboard).
// Nothing is asked in the UI and no key is ever displayed.
const PROVIDER = String(import.meta.env.VITE_AI_PROVIDER || 'zen').toLowerCase();
const ZEN_KEY = String(import.meta.env.VITE_OPENCODE_API_KEY || '');
const ZEN_MODEL = String(import.meta.env.VITE_OPENCODE_MODEL || 'muse-spark-1.3-contributor-free');
const GEMINI_KEY = String(import.meta.env.VITE_GEMINI_API_KEY || '');
const GEMINI_MODEL = String(import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.8-flash');

export function describeSource(): string {
  if (PROVIDER === 'gemini') return `gemini • ${GEMINI_MODEL}`;
  if (PROVIDER === 'zen') return `zen • ${ZEN_MODEL}`;
  return 'offline bank';
}

const uid = () => Math.random().toString(36).slice(2, 9);
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function buildPrompt(seed: number, avoid: string[], difficulty: Difficulty, source: BankSource): string {
  const spec = SECTIONS.map((s) => `- ${s.id}: ${s.count} questions (${s.description})`).join('\n');
  const mix = difficulty === 'easy' ? '70% easy, 20% medium, 10% hard' : difficulty === 'hard' ? '20% easy, 30% medium, 50% hard' : '40% easy, 40% medium, 20% hard';
  const style =
    source === 'pyq'
      ? 'Style: previous-year AMCAT / Concentrix-drive questions as asked in 2021–2024 papers (recalled from training knowledge, exam-realistic; vary names and numbers slightly so no two sets repeat).'
      : 'Style: fresh original questions in the exact AMCAT pattern and difficulty curve.';
  return `You generate a Concentrix AMCAT-style practice set. Fresh seed ${seed}.
Sections and counts:
${spec}
Avoid repeating these recent questions/topics: ${avoid.slice(0, 20).join(' | ') || 'none'}.
Rules:
- Multiple choice, exactly 4 options each, exactly 1 correct.
- Difficulty mix: ${mix}.
- ${style}
- Quant: use NEW numbers each time, show working in explanation.
- English: new sentences/vocabulary each time.
- Logical: new names/numbers each time.
- csat: realistic Concentrix customer-support situations (angry caller, holds, escalation, email tone, privacy, prioritisation).
- explanation: 1-2 lines, teaches the shortcut/rule.
Return ONLY a JSON object: {"questions":[{"section":"english|quant|logical|csat","topic":"...","prompt":"...","options":["a","b","c","d"],"answerIndex":0,"explanation":"..."}]}
No markdown fences, no extra text. Total questions must be ${SECTIONS.reduce((a, s) => a + s.count, 0)}.`;
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.search(/[{[]/);
  const endObj = raw.lastIndexOf('}');
  const endArr = raw.lastIndexOf(']');
  const end = Math.max(endObj, endArr);
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  return JSON.parse(slice);
}

function sanitise(parsed: any): Question[] {
  const list: any[] = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(list)) throw new Error('AI returned no questions array');
  const validSections: SectionId[] = ['english', 'quant', 'logical', 'csat'];
  const out: Question[] = [];
  for (const q of list) {
    if (!q || typeof q.prompt !== 'string' || !Array.isArray(q.options) || q.options.length !== 4) continue;
    if (typeof q.answerIndex !== 'number' || q.answerIndex < 0 || q.answerIndex > 3) continue;
    if (!validSections.includes(q.section)) continue;
    out.push({
      id: uid(),
      section: q.section,
      topic: String(q.topic || 'Practice').slice(0, 60),
      prompt: String(q.prompt).slice(0, 1200),
      options: [String(q.options[0]), String(q.options[1]), String(q.options[2]), String(q.options[3])] as [string, string, string, string],
      answerIndex: q.answerIndex,
      explanation: String(q.explanation || 'Review the concept and try again.').slice(0, 800),
    });
  }
  const grouped = new Map<SectionId, Question[]>();
  for (const s of SECTIONS) grouped.set(s.id, []);
  for (const q of out) grouped.get(q.section)!.push(q);
  const final: Question[] = [];
  for (const s of SECTIONS) final.push(...grouped.get(s.id)!.slice(0, s.count));
  if (final.length < 10) throw new Error('AI returned too few valid questions');
  return final;
}

function geminiBody(prompt: string) {
  return {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 6000, responseMimeType: 'application/json' },
  };
}

function geminiText(data: any): string {
  return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
}

/** Live models, most capable first. 2.x is shut down (2026 retirements) — never list it. */
const GEMINI_FALLBACKS = ['gemini-3.5-flash', 'gemini-3-flash', 'gemini-3.6-flash'];

/** Direct Google Gemini API. Falls back through live models if the configured id is unknown. */
async function callGemini(prompt: string): Promise<Question[]> {
  const models = [GEMINI_MODEL, ...GEMINI_FALLBACKS.filter((m) => m !== GEMINI_MODEL)];
  const viaProxy = ttsConfigured();
  let lastErr = '';
  for (const m of models) {
    // Prefer the self-hosted proxy (key never touches the browser).
    if (viaProxy) {
      try {
        const body = geminiBody(prompt);
        const text = geminiText(await geminiViaProxy(m, body.contents, body.generationConfig));
        if (!text) throw new Error('Empty Gemini response');
        return sanitise(extractJson(text));
      } catch (e: any) {
        lastErr = `Gemini proxy (${m}): ${e?.message || e}`;
        continue;
      }
    }
    if (!GEMINI_KEY) {
      lastErr = 'No Gemini key and no proxy configured';
      continue;
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody(prompt)),
    });
    if (res.ok) {
      const text = geminiText(await res.json());
      if (!text) throw new Error('Empty Gemini response');
      return sanitise(extractJson(text));
    }
    lastErr = `Gemini HTTP ${res.status} (${m})`;
  }
  throw new Error(lastErr);
}

function extractResponsesText(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text) return data.output_text;
  if (Array.isArray(data?.output_text)) {
    const t = data.output_text.map((p: any) => (typeof p === 'string' ? p : p?.text || '')).join('');
    if (t) return t;
  }
  const chunks: string[] = [];
  const walk = (n: any) => {
    if (!n) return;
    if (typeof n === 'string') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n === 'object') {
      if ((n.type === 'output_text' || n.type === 'text') && typeof n.text === 'string') chunks.push(n.text);
      if (n.content) walk(n.content);
      if (n.output) walk(n.output);
    }
  };
  walk(data?.output);
  return chunks.join('');
}

/**
 * OpenCode Zen. Endpoint depends on the model family (see opencode.ai/zen docs):
 * - muse-spark / gpt / grok families → OpenAI Responses API (/responses)
 * - gemini-* families → Google-style GenerateContent (/models/<id>:generateContent)
 * Falls back to OpenAI-compatible chat completions.
 */
function throwIfZenError(data: any, fallback: string): void {
  const e = data?.error;
  if (!e) return;
  const raw = typeof e === 'string' ? e : e?.message || fallback;
  const hint = /free.?tier|from within opencode/i.test(raw)
    ? ' Zen free models only work inside OpenCode itself — use the gemini provider for in-app AI sets.'
    : '';
  throw new Error(`Zen refused: ${raw}.${hint}`);
}

async function callZen(prompt: string): Promise<Question[]> {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${ZEN_KEY}` };

  if (ZEN_MODEL.startsWith('gemini')) {
    const url = `https://opencode.ai/zen/v1/models/${encodeURIComponent(ZEN_MODEL)}:generateContent`;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(geminiBody(prompt)) });
    if (!res.ok) throw new Error(`Zen HTTP ${res.status}`);
    const gdata = await res.json();
    throwIfZenError(gdata, `Zen HTTP ${res.status}`);
    const text = geminiText(gdata);
    if (!text) throw new Error('Empty Zen response');
    return sanitise(extractJson(text));
  }

  // Responses API (muse-spark-1.3-contributor-free lives here)
  try {
    const res = await fetch('https://opencode.ai/zen/v1/responses', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ZEN_MODEL,
        input: prompt + '\n\nReply with valid JSON only.',
        max_output_tokens: 6000,
      }),
    });
    if (!res.ok) throw new Error(`Zen responses HTTP ${res.status}`);
    const rdata = await res.json();
    throwIfZenError(rdata, `Zen responses HTTP ${res.status}`);
    const text = extractResponsesText(rdata);
    if (!text) throw new Error('Empty Zen response');
    return sanitise(extractJson(text));
  } catch (e) {
    // Fallback: OpenAI-compatible chat completions
    const res = await fetch('https://opencode.ai/zen/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ZEN_MODEL,
        temperature: 0.9,
        max_tokens: 6000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are an AMCAT exam setter. Always reply with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) throw e;
    const data = await res.json();
    throwIfZenError(data, 'Zen request refused');
    const text: string = data?.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('Empty Zen response');
    return sanitise(extractJson(text));
  }
}

export function offlineSet(difficulty: Difficulty = 'medium'): ExamSet {
  const picked: Question[] = [];
  for (const s of SECTIONS) {
    const pool = shuffle(BANK.filter((q) => q.section === s.id));
    picked.push(...pool.slice(0, s.count).map((q) => ({ ...q, id: uid() })));
  }
  return { id: uid(), createdAt: Date.now(), source: 'offline-bank', difficulty, origin: 'offline', questions: shuffle(picked) };
}

function recentAvoid(): string[] {
  try {
    return JSON.parse(localStorage.getItem('amcat_avoid') || '[]');
  } catch {
    return [];
  }
}

function rememberAvoid(qs: Question[]) {
  try {
    const prev: string[] = recentAvoid();
    const topics = qs.map((q) => q.prompt.slice(0, 80));
    localStorage.setItem('amcat_avoid', JSON.stringify([...topics, ...prev].slice(0, 60)));
  } catch {
    /* ignore */
  }
}

/** Generate a fresh set: shared pool first, then AI (published back), then offline bank. */
export async function generateSet(opts?: { difficulty?: Difficulty; pyq?: boolean }): Promise<ExamSet> {
  const difficulty: Difficulty = opts?.difficulty || 'medium';
  const source: BankSource = opts?.pyq ? 'pyq' : 'ai';
  const userId = useSession.getState().userId;
  const seed = Math.floor(Math.random() * 1_000_000);
  const prompt = buildPrompt(seed, recentAvoid(), difficulty, source);

  // 1. serve a set this learner hasn't attempted yet
  const shared = await fetchUnattempted(userId, difficulty, source);
  if (shared) {
    rememberAvoid(shared.questions);
    return shared;
  }

  // 2. make a new one with AI and share it with the pool.
  // Providers fall back to each other (a CORS-blocked Zen yields to Gemini
  // when its key exists) before the offline bank — order still honors config.
  const order = PROVIDER === 'gemini' ? (['gemini', 'zen'] as const) : (['zen', 'gemini'] as const);
  for (const p of order) {
    try {
      if (p === 'gemini' && GEMINI_KEY) {
        const qs = await callGemini(prompt);
        const set: ExamSet = { id: uid(), createdAt: Date.now(), source: 'ai-gemini', difficulty, origin: source, questions: qs };
        rememberAvoid(qs);
        await publishSet(set, userId, difficulty, source);
        return set;
      }
      if (p === 'zen' && ZEN_KEY) {
        const qs = await callZen(prompt);
        const set: ExamSet = { id: uid(), createdAt: Date.now(), source: 'ai-zen', difficulty, origin: source, questions: qs };
        rememberAvoid(qs);
        await publishSet(set, userId, difficulty, source);
        return set;
      }
    } catch (e) {
      if (e instanceof TypeError) console.info(`AI provider ${p} unreachable from browser — trying next.`);
      else console.warn(`AI provider ${p} failed, trying next:`, e);
    }
  }
  const set = offlineSet(difficulty);
  rememberAvoid(set.questions);
  return set;
}
