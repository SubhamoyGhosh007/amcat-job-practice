import type { Question } from '../types';
import { MATH_TOPICS } from '../data/mathTopics';
import { geminiViaProxy, ttsConfigured } from './tts';

const GEMINI_KEY = String(import.meta.env.VITE_GEMINI_API_KEY || '');
const GEMINI_MODEL = String(import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.8-flash');

const uid = () => Math.random().toString(36).slice(2, 9);
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

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

function mathPrompt(topics: typeof MATH_TOPICS, seed: number, avoid: string[]): string {
  const spec = topics.map((t) => `- ${t.id} (${t.name}: ${t.what}) — exactly 4 questions`).join('\n');
  return `You generate Concentrix AMCAT quantitative-ability practice questions. Fresh seed ${seed}.
Topics, exactly 4 questions EACH (total ${topics.length * 4}):
${spec}
Avoid repeating these recent questions: ${avoid.slice(0, 20).join(' | ') || 'none'}.
Rules:
- Multiple choice, exactly 4 options each, exactly 1 correct.
- AMCAT difficulty: solvable in ~60 seconds with a shortcut.
- Quant: use NEW numbers every time, never textbook clichés.
- explanation: 2-4 lines showing the WORKING step by step (the "how to solve").
- trick: one short line naming the shortcut used (e.g. "x% of y = y% of x").
Return ONLY a JSON object: {"questions":[{"section":"quant","topic":"<one of: ${topics.map((t) => t.id).join(', ')}>","prompt":"...","options":["a","b","c","d"],"answerIndex":0,"explanation":"...","trick":"..."}]}
No markdown fences, no extra text. Total questions must be ${topics.length * 4}.`;
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
  if (out.length < 10) throw new Error('AI returned too few valid questions');
  return out;
}

async function callMath(topics: typeof MATH_TOPICS, seed: number, avoid: string[]): Promise<Question[]> {
  const prompt = mathPrompt(topics, seed, avoid);
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 9000, responseMimeType: 'application/json' },
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
  const start = text.search(/[{[]/);
  return sanitiseMath(JSON.parse(text.slice(start, Math.max(text.lastIndexOf('}'), text.lastIndexOf(']')) + 1)));
}

/**
 * 40 fresh maths questions, 4 per AMCAT topic. Two parallel half-calls keep each
 * response under token caps; topics are topped up if a half comes back short.
 */
export async function generateMathSet(): Promise<Question[]> {
  const seed = Math.floor(Math.random() * 1_000_000);
  const avoid = recentAvoid();
  const halves = [MATH_TOPICS.slice(0, 5), MATH_TOPICS.slice(5)];
  const [a, b] = await Promise.all(halves.map((h, i) => callMath(h, seed + i, avoid)));
  const byTopic = new Map<string, Question[]>();
  for (const q of [...a, ...b]) {
    const arr = byTopic.get(q.topic) || [];
    if (arr.length < 4) {
      arr.push(q);
      byTopic.set(q.topic, arr);
    }
  }
  const questions = MATH_TOPICS.flatMap((t) => byTopic.get(t.id) || []);
  if (questions.length < 30) throw new Error('AI returned an incomplete maths set — retry once.');
  rememberAvoid(questions);
  return shuffle(questions);
}
