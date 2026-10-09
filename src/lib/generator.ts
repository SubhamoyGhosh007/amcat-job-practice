import { BANK } from '../data/bank';
import { SECTIONS, type ExamSet, type Question, type SectionId } from '../types';
import { fetchUnattempted, publishSet, type BankSource, type Difficulty } from './bank';
import { geminiViaProxy, ttsConfigured } from './tts';
import { groqChat, groqConfigured, groqModelsFor } from './groq';
import { extractJson, rememberAvoid, recentAvoid, shuffle, uid } from './genUtils';
import { requireToken } from './rateLimiter';
import { useSession } from '../stores/session';

// Canonical JSON extractor lives in genUtils; re-exported here so every
// generator imports it from this module and never duplicates it.
export { extractJson };

// Config comes ONLY from build-time env (.env file / deploy dashboard).
// Nothing is asked in the UI and no key is ever displayed.
const PROVIDER = String(import.meta.env.VITE_AI_PROVIDER || 'zen').toLowerCase();
const ZEN_KEY = String(import.meta.env.VITE_OPENCODE_API_KEY || '');
const ZEN_MODEL = String(import.meta.env.VITE_OPENCODE_MODEL || 'muse-spark-1.3-contributor-free');
const GEMINI_KEY = String(import.meta.env.VITE_GEMINI_API_KEY || '');
const GEMINI_MODEL = String(import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash');

export function describeSource(): string {
  if (PROVIDER === 'gemini') return `gemini • ${GEMINI_MODEL}`;
  if (PROVIDER === 'zen') return `zen • ${ZEN_MODEL}`;
  return 'offline bank';
}

function buildPrompt(
  seed: number,
  avoid: string[],
  difficulty: Difficulty,
  source: BankSource,
  adaptive = false,
  sectionsToInclude?: SectionId[]
): string {
  const activeSections = sectionsToInclude ? SECTIONS.filter((s) => sectionsToInclude.includes(s.id)) : SECTIONS;
  const spec = adaptive
    ? activeSections.map((s) => `- ${s.id}: 3 easy + 3 medium + 3 hard (${s.description})`).join('\n')
    : activeSections.map((s) => `- ${s.id}: ${s.count} questions (${s.description})`).join('\n');
  const mix = difficulty === 'easy' ? '70% easy, 20% medium, 10% hard' : difficulty === 'hard' ? '20% easy, 30% medium, 50% hard' : '40% easy, 40% medium, 20% hard';
  const mixLine = adaptive
    ? 'Label each question with "difficulty":"easy|medium|hard".'
    : 'Difficulty: ' + mix + '.';
  const style =
    source === 'pyq'
      ? 'Style: AMCAT / Concentrix-drive PYQ questions (2021–2024 patterns).'
      : 'Style: realistic AMCAT Concentrix test pattern.';
  return `Generate Concentrix AMCAT practice test. Seed ${seed}.
Sections:
${spec}
Avoid recent topics: ${avoid.slice(0, 15).join(' | ') || 'none'}.
Rules:
- 4 options each, exactly 1 correct (answerIndex 0-3).
- ${mixLine}
- ${style}
- csat: Concentrix voice/non-voice customer service scenarios (tone, escalations, holds, empathetic communication).
- explanation: concise 1-2 lines only (max 25 words).
JSON ONLY: {"questions":[{"section":"${activeSections.map((s) => s.id).join('|')}","topic":"...","prompt":"...","options":["a","b","c","d"],"answerIndex":0,"explanation":"..."${adaptive ? ',"difficulty":"easy|medium|hard"' : ''}}]}
No markdown, no commentary. Total questions: ${adaptive ? activeSections.length * 9 : activeSections.reduce((a, s) => a + s.count, 0)}.`;
}

function validDiff(d: any): 'easy' | 'medium' | 'hard' {
  return d === 'easy' || d === 'hard' ? d : 'medium';
}

function sanitise(parsed: any, trim = true, allowedSections?: SectionId[]): Question[] {
  const list: any[] = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(list)) throw new Error('AI returned no questions array');
  const validSections: SectionId[] = allowedSections || ['english', 'quant', 'logical', 'csat'];
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
      difficulty: validDiff(q.difficulty),
    });
  }
  const minRequired = allowedSections ? Math.max(3, allowedSections.reduce((acc, sId) => acc + (SECTIONS.find((s) => s.id === sId)?.count || 0), 0) - 4) : 10;
  if (out.length < minRequired) throw new Error('AI returned too few valid questions');
  if (!trim) return out;
  const sectionsToCheck = allowedSections ? SECTIONS.filter((s) => allowedSections.includes(s.id)) : SECTIONS;
  const grouped = new Map<SectionId, Question[]>();
  for (const s of sectionsToCheck) grouped.set(s.id, []);
  for (const q of out) if (grouped.has(q.section)) grouped.get(q.section)!.push(q);
  const final: Question[] = [];
  for (const s of sectionsToCheck) final.push(...grouped.get(s.id)!.slice(0, s.count));
  return final;
}

function geminiBody(prompt: string, maxTokens = 4500) {
  return {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
  };
}

function geminiText(data: any): string {
  return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
}

/** Live models, verified working 2026-10-03. 2.5 IDs are gated for new accounts (generate 404s); gemini-3-flash doesn't exist. */
const GEMINI_FALLBACKS = ['gemini-3.6-flash', 'gemini-3.8-flash'];

/** Direct Google Gemini API. Falls back through live models if the configured id is unknown. */
async function callGemini(prompt: string, adaptive = false, allowedSections?: SectionId[]): Promise<Question[]> {
  const maxTokens = adaptive ? 6000 : 4500;
  const models = [GEMINI_MODEL, ...GEMINI_FALLBACKS.filter((m) => m !== GEMINI_MODEL)];
  const viaProxy = ttsConfigured();
  let lastErr = '';
  for (const m of models) {
    // Prefer the self-hosted proxy (key never touches the browser).
    if (viaProxy) {
      try {
        const body = geminiBody(prompt, maxTokens);
        const text = geminiText(await geminiViaProxy(m, body.contents, body.generationConfig));
        if (!text) throw new Error('Empty Gemini response');
        return sanitise(extractJson(text), !adaptive, allowedSections);
      } catch (e: any) {
        lastErr = `Gemini proxy (${m}): ${e?.message || e}`;
        if (/429/.test(lastErr)) break; // throttled — retrying siblings would 429 too
        continue;
      }
    }
    if (!GEMINI_KEY) {
      lastErr = 'No Gemini key and no proxy configured';
      continue;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody(prompt, maxTokens)),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const text = geminiText(await res.json());
        if (!text) throw new Error('Empty Gemini response');
        return sanitise(extractJson(text), !adaptive, allowedSections);
      }
      lastErr = `Gemini HTTP ${res.status} (${m})`;
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      lastErr = `Gemini call failed (${m}): ${fetchErr?.message || fetchErr}`;
    }
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

/** Groq rotation: first 200 wins; dead (404) or exhausted (429) models fall through. */
async function callGroq(prompt: string, adaptive = false, allowedSections?: SectionId[]): Promise<Question[]> {
  let lastErr = 'Groq unavailable';
  for (const model of groqModelsFor()) {
    try {
      const text = await groqChat(
        model,
        'You are an AMCAT exam setter. Always reply with valid JSON only.',
        prompt + '\n\nReply with valid JSON only.',
        adaptive ? 6000 : 4500
      );
      return sanitise(extractJson(text), !adaptive, allowedSections);
    } catch (e: any) {
      lastErr = `Groq (${model}): ${e?.message || e}`;
      continue;
    }
  }
  throw new Error(lastErr);
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

async function callZen(prompt: string, adaptive = false): Promise<Question[]> {
  const maxTokens = adaptive ? 6000 : 4500;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${ZEN_KEY}` };

  if (ZEN_MODEL.startsWith('gemini')) {
    const url = `https://opencode.ai/zen/v1/models/${encodeURIComponent(ZEN_MODEL)}:generateContent`;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(geminiBody(prompt, maxTokens)) });
    if (!res.ok) throw new Error(`Zen HTTP ${res.status}`);
    const gdata = await res.json();
    throwIfZenError(gdata, `Zen HTTP ${res.status}`);
    const text = geminiText(gdata);
    if (!text) throw new Error('Empty Zen response');
    return sanitise(extractJson(text), !adaptive);
  }

  // Responses API (muse-spark-1.3-contributor-free lives here)
  const zenBody = { model: ZEN_MODEL, text: prompt + '\n\nReply with valid JSON only.', tokens: maxTokens };
  try {
    const res = await fetch('https://opencode.ai/zen/v1/responses', {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: zenBody.model, input: zenBody.text, max_output_tokens: zenBody.tokens }),
    });
    if (!res.ok) throw new Error(`Zen responses HTTP ${res.status}`);
    const rdata = await res.json();
    throwIfZenError(rdata, `Zen responses HTTP ${res.status}`);
    const text = extractResponsesText(rdata);
    if (!text) throw new Error('Empty Zen response');
    return sanitise(extractJson(text), !adaptive);
  } catch (e) {
    // Fallback: OpenAI-compatible chat completions
    const res = await fetch('https://opencode.ai/zen/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ZEN_MODEL,
        temperature: 0.7,
        max_tokens: maxTokens,
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
    return sanitise(extractJson(text), !adaptive);
  }
}

export function offlineSet(difficulty: Difficulty = 'medium', adaptive = false): ExamSet {
  const picked: Question[] = [];
  const tiers = ['easy', 'medium', 'hard'] as const;
  for (const s of SECTIONS) {
    const pool = shuffle(BANK.filter((q) => q.section === s.id));
    // Adaptive needs depth: keep the whole section pool and label by thirds
    // (fallback bank carries no labels of its own).
    const take = adaptive ? pool : pool.slice(0, s.count);
    take.forEach((q, i) => {
      const tier = tiers[Math.min(2, Math.floor((i / Math.max(1, take.length)) * 3))];
      // Shuffle option order (remapped answer) so repeat serves feel less identical.
      const order = shuffle([0, 1, 2, 3]);
      picked.push({
        ...q,
        id: uid(),
        difficulty: q.difficulty || tier,
        options: order.map((o) => q.options[o]) as [string, string, string, string],
        answerIndex: order.indexOf(q.answerIndex),
      });
    });
  }
  return { id: uid(), createdAt: Date.now(), source: 'offline-bank', difficulty, origin: 'offline', adaptive, questions: adaptive ? shuffle(picked) : shuffle(picked) };
}

/** Helper to call provider for a subset of sections or all sections. */
async function callProviderForSections(
  provider: 'groq' | 'gemini' | 'zen',
  seed: number,
  avoid: string[],
  difficulty: Difficulty,
  source: BankSource,
  adaptive: boolean,
  sections?: SectionId[]
): Promise<Question[]> {
  const prompt = buildPrompt(seed, avoid, difficulty, source, adaptive, sections);
  if (provider === 'groq') return callGroq(prompt, adaptive, sections);
  if (provider === 'gemini') return callGemini(prompt, adaptive, sections);
  return callZen(prompt, adaptive);
}

/** Generate a fresh set: shared pool first, then AI (published back), then offline bank. */
export async function generateSet(opts?: { difficulty?: Difficulty; pyq?: boolean; adaptive?: boolean }): Promise<ExamSet> {
  const difficulty: Difficulty = opts?.difficulty || 'medium';
  const source: BankSource = opts?.pyq ? 'pyq' : 'ai';
  const adaptive = !!opts?.adaptive;
  const userId = useSession.getState().userId;
  const tier = useSession.getState().profile?.tier ?? 'free';
  const seed = Math.floor(Math.random() * 1_000_000);
  const avoid = recentAvoid();

  // 1. serve a set this learner hasn't attempted yet (same tier only)
  const shared = await fetchUnattempted(userId, difficulty, source, tier);
  if (shared) {
    rememberAvoid(shared.questions);
    return shared;
  }

  // 2. make a new one with AI and share it with the pool.
  // The leaky bucket gates AI calls only — pool serves and the offline bank cost nothing.
  if (groqConfigured() || GEMINI_KEY || ttsConfigured() || ZEN_KEY) requireToken();
  // Groq goes first when keyed (generous shared free tier, tier-picked model),
  // then the configured providers, then the offline bank.
  const rest = PROVIDER === 'gemini' ? (['gemini', 'zen'] as const) : (['zen', 'gemini'] as const);
  const order = groqConfigured() ? (['groq', ...rest] as const) : rest;

  for (const p of order) {
    if (p === 'gemini' && !GEMINI_KEY && !ttsConfigured()) continue;
    if (p === 'zen' && !ZEN_KEY) continue;

    try {
      // Parallel section batching (English+CSAT vs Quant+Logical) for non-adaptive sets cuts generation time in half
      if (!adaptive && (p === 'groq' || p === 'gemini')) {
        try {
          const [batchA, batchB] = await Promise.all([
            callProviderForSections(p, seed, avoid, difficulty, source, false, ['english', 'csat']),
            callProviderForSections(p, seed + 1, avoid, difficulty, source, false, ['quant', 'logical']),
          ]);
          const qs = [...batchA, ...batchB];
          if (qs.length >= 24) {
            const set: ExamSet = { id: uid(), createdAt: Date.now(), source: `ai-${p}`, difficulty, origin: source, adaptive, questions: qs };
            rememberAvoid(qs);
            await publishSet(set, userId, difficulty, source, tier);
            return set;
          }
        } catch (parallelErr) {
          console.info(`Parallel call with ${p} skipped or failed, trying full set:`, parallelErr);
        }
      }

      // Single prompt fallback
      const qs = await callProviderForSections(p, seed, avoid, difficulty, source, adaptive);
      const set: ExamSet = { id: uid(), createdAt: Date.now(), source: `ai-${p}`, difficulty, origin: source, adaptive, questions: qs };
      rememberAvoid(qs);
      await publishSet(set, userId, difficulty, source, tier);
      return set;
    } catch (e) {
      if (e instanceof TypeError) console.info(`AI provider ${p} unreachable from browser — trying next.`);
      else console.warn(`AI provider ${p} failed, trying next:`, e);
    }
  }
  const set = offlineSet(difficulty, adaptive);
  rememberAvoid(set.questions);
  return set;
}
