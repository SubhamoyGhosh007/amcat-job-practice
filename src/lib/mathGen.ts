import type { Question } from '../types';
import { MATH_TOPICS } from '../data/mathTopics';
import { geminiViaProxy, ttsConfigured } from './tts';
import { groqChat, groqConfigured, groqModelFor } from './groq';
import { extractJson } from './generator';
import { requireToken } from './rateLimiter';
import { recentAvoid, rememberAvoid, shuffle, uid } from './genUtils';

const GEMINI_KEY = String(import.meta.env.VITE_GEMINI_API_KEY || '');
const GEMINI_MODEL = String(import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash');

function mathPrompt(spec: SliceSpec, seed: number, avoid: string[]): string {
  const lines = spec.map(({ topic, count }) => {
    const t = MATH_TOPICS.find((x) => x.id === topic)!;
    return `- ${t.id} (${t.name}: ${t.what}) — exactly ${count} questions`;
  });
  const total = spec.reduce((a, s) => a + s.count, 0);
  const ids = spec.map((s) => s.topic).join(', ');
  return `You generate Concentrix AMCAT quantitative-ability practice questions. Fresh seed ${seed}.
Topics, exact counts (total ${total}):
${lines.join('\n')}
Avoid repeating these recent questions: ${avoid.slice(0, 20).join(' | ') || 'none'}.
Rules:
- Multiple choice, exactly 4 options each, exactly 1 correct.
- AMCAT difficulty: solvable in ~60 seconds with a shortcut.
- Quant: use NEW numbers every time, never textbook clichés.
- explanation: 2-4 lines showing the WORKING step by step (the "how to solve").
- trick: one short line naming the shortcut used (e.g. "x% of y = y% of x").
Return ONLY a JSON object: {"questions":[{"section":"quant","topic":"<one of: ${ids}>","prompt":"...","options":["a","b","c","d"],"answerIndex":0,"explanation":"...","trick":"..."}]}
No markdown fences, no extra text. Total questions must be ${total}.`;
}

function sanitiseMath(parsed: any): Question[] {
  const list: any[] = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(list)) throw new Error('AI returned no questions array');
  const validIds = new Set(MATH_TOPICS.map((t) => t.id));
  const out: Question[] = [];
  for (const q of list) {
    if (!q || typeof q.prompt !== 'string' || !Array.isArray(q.options) || q.options.length !== 4) continue;
    if (typeof q.answerIndex !== 'number' || q.answerIndex < 0 || q.answerIndex > 3) continue;
    if (!validIds.has(q.topic)) continue;
    out.push({
      id: uid(),
      section: 'quant',
      topic: String(q.topic).slice(0, 60),
      prompt: String(q.prompt).slice(0, 1200),
      options: [String(q.options[0]), String(q.options[1]), String(q.options[2]), String(q.options[3])] as [string, string, string, string],
      answerIndex: q.answerIndex,
      explanation: String(q.explanation || 'Review the concept and try again.').slice(0, 1000),
      trick: String(q.trick || '').slice(0, 300) || undefined,
    });
  }
  if (out.length < 3) throw new Error('AI returned too few valid questions');
  return out;
}

async function callMath(spec: SliceSpec, seed: number, avoid: string[]): Promise<Question[]> {
  const prompt = mathPrompt(spec, seed, avoid);
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 4000, responseMimeType: 'application/json' },
  };
  // Prefer the self-hosted proxy (key never touches the browser).
  if (ttsConfigured()) {
    const data = await geminiViaProxy(GEMINI_MODEL, body.contents, body.generationConfig);
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    if (!text) throw new Error('Empty Gemini response');
    const start = text.search(/[{[]/);
    return sanitiseMath(JSON.parse(text.slice(start, Math.max(text.lastIndexOf('}'), text.lastIndexOf(']')) + 1)));
  }
  if (!GEMINI_KEY) throw new Error('No AI configured for maths sets');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  if (!text) throw new Error('Empty Gemini response');
  return sanitiseMath(extractJson(text));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One answer-sheet page = one small generation (4 questions, one topic).
 * Tiny calls finish in seconds, never near proxy timeouts, and cost fewer tokens.
 * Ten pages cover every AMCAT maths family (40 total).
 */
export interface MathSliceItem {
  topic: string;
  count: number;
}

export type SliceSpec = MathSliceItem[];

export const MATH_PAGE_SLICES: SliceSpec[] = MATH_TOPICS.map((t) => [{ topic: t.id, count: 4 }]);

export const MATH_TOTAL_PAGES = MATH_PAGE_SLICES.length;

/** Groq first (generous quota, tier-picked model), Gemini proxy as backup. */
async function callGroqMath(spec: SliceSpec, seed: number, avoid: string[]): Promise<Question[]> {
  if (!groqConfigured()) throw new Error('No Groq key configured');
  const text = await groqChat(
    groqModelFor(),
    'You are an AMCAT exam setter. Always reply with valid JSON only.',
    mathPrompt(spec, seed, avoid) + '\n\nReply with valid JSON only.',
    4000
  );
  return sanitiseMath(extractJson(text));
}

async function callMathRetried(spec: SliceSpec, seed: number, avoid: string[]): Promise<Question[]> {
  try {
    return await callMath(spec, seed, avoid);
  } catch (e) {
    // Quota exhaustion won't heal in 2.5s — retrying just burns another
    // request against the same daily wall. Fail fast with the real reason.
    if (/429|quota|rate limit/i.test(String((e as any)?.message || e))) throw e;
    await sleep(2500);
    return callMath(spec, seed + 999, avoid);
  }
}

/** Generate one page (4 questions). Throws with a friendly message on failure. */
export async function generateMathPage(page: number): Promise<Question[]> {
  const spec = MATH_PAGE_SLICES[page];
  if (!spec) throw new Error('No such maths page.');
  if (groqConfigured() || GEMINI_KEY || ttsConfigured()) requireToken();
  const seed = Math.floor(Math.random() * 1_000_000);
  const avoid = recentAvoid();
  let questions: Question[];
  try {
    questions = await callGroqMath(spec, seed, avoid);
  } catch {
    questions = await callMathRetried(spec, seed, avoid);
  }
  const capped = new Map<string, Question[]>();
  for (const q of questions) {
    const want = spec.find((s) => s.topic === q.topic)?.count ?? 0;
    const arr = capped.get(q.topic) || [];
    if (arr.length < want) {
      arr.push(q);
      capped.set(q.topic, arr);
    }
  }
  const out = spec.flatMap((s) => capped.get(s.topic) || []);
  if (out.length < 3) throw new Error('AI returned an incomplete maths page — retry once.');
  rememberAvoid(out);
  return shuffle(out);
}
