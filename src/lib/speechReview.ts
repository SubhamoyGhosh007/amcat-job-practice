import { groqChat, groqConfigured, groqModelsFor } from './groq';
import { extractJson } from './generator';

/**
 * Pronunciation review: Groq-hosted Whisper (large-v3-turbo, free tier)
 * transcribes the learner's recording; scoring runs 100% client-side.
 *
 * Honest labels only: what we measure is how accurately the recognizer heard
 * each word (clarity), plus pace (fluency) and coverage (completeness). That
 * is a pronunciation proxy — not a true accent classifier — and the UI says so.
 */

const GROQ_KEY = String(import.meta.env.VITE_GROQ_API_KEY || '');

export function reviewConfigured(): boolean {
  return Boolean(GROQ_KEY);
}

export interface WordMark {
  expected: string;
  heard: string | null;
  /** correct | substituted | deleted */
  status: 'correct' | 'substituted' | 'deleted';
}

export interface SpeechReview {
  at: number;
  transcript: string;
  /** 0–10 overall */
  marks: number;
  accuracy: number;
  completeness: number;
  fluency: number;
  wpm: number;
  words: WordMark[];
  /** Short, actionable improvement lines. */
  improvements: string[];
}

function norm(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Word-level Levenshtein alignment between expected and heard words. */
function align(expected: string[], heard: string[]): WordMark[] {
  const n = expected.length;
  const m = heard.length;
  const dp: number[][] = Array.from({ length: n + 1 }, (_, i) => [i, ...Array(m).fill(0)]);
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (expected[i - 1] === heard[j - 1] ? 0 : 1)
      );
    }
  }
  const out: WordMark[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && expected[i - 1] === heard[j - 1]) {
      out.push({ expected: expected[i - 1], heard: heard[j - 1], status: 'correct' });
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      out.push({ expected: expected[i - 1], heard: heard[j - 1], status: 'substituted' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j] === dp[i][j - 1] + 1)) {
      j--; // extra word the learner added — doesn't punish, doesn't reward
    } else {
      out.push({ expected: expected[i - 1], heard: null, status: 'deleted' });
      i--;
    }
  }
  return out.reverse();
}

export async function transcribeAudio(blob: Blob): Promise<{ text: string }> {
  if (!GROQ_KEY) throw new Error('Voice review needs the AI key configured.');
  const ext = (blob.type.split('/')[1] || 'webm').split(';')[0];
  const form = new FormData();
  form.append('file', blob, `attempt.${ext}`);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'json');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${GROQ_KEY}` },
      body: form,
    });
    if (res.status === 429) throw new Error('AI rate limited (429)');
    if (!res.ok) throw new Error(`Voice review HTTP ${res.status}`);
    const data = await res.json();
    const text = String(data?.text || '').trim();
    if (!text) throw new Error('Empty transcription — try recording a little louder, closer to the mic.');
    return { text };
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('Transcription timed out (12s). Try again.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Score an attempt: accuracy 50% (words heard correctly), completeness 30%
 * (expected words covered at all), fluency 20% (pace inside a natural band).
 */
export function scoreAttempt(target: string, transcript: string, durationSec: number): SpeechReview {
  const expected = norm(target);
  const heard = norm(transcript);
  const words = align(expected, heard);
  const correct = words.filter((w) => w.status === 'correct').length;
  const covered = words.filter((w) => w.status !== 'deleted').length;
  const accuracy = expected.length ? Math.round((correct / expected.length) * 100) : 0;
  const completeness = expected.length ? Math.round((covered / expected.length) * 100) : 0;

  const secs = Math.max(1, durationSec);
  const wpm = Math.round((heard.length / secs) * 60);
  // Natural read-aloud band ≈ 110–170 wpm; full marks inside, tapering outside.
  const fluency = wpm >= 110 && wpm <= 170 ? 100 : Math.max(0, 100 - Math.min(70, Math.abs(wpm - 140) * 1.2));

  const marks = Math.round((accuracy * 0.5 + completeness * 0.3 + fluency * 0.2) / 10);

  const improvements: string[] = [];
  const missed = words.filter((w) => w.status === 'deleted').map((w) => w.expected);
  const twisted = words.filter((w) => w.status === 'substituted');
  if (missed.length) improvements.push(`Skipped words to practise: ${[...new Set(missed)].slice(0, 6).join(', ')}.`);
  if (twisted.length)
    improvements.push(
      `Heard differently (slow down and shape these): ${[...new Set(twisted.map((w) => `${w.expected} → “${w.heard}”`))].slice(0, 5).join('; ')}.`
    );
  if (wpm > 0 && wpm < 110) improvements.push(`Pace is slow (${wpm} wpm) — aim for a steady 110–170, pausing only at commas.`);
  if (wpm > 170) improvements.push(`Pace is rushed (${wpm} wpm) — slow down so word endings land clearly.`);
  if (!improvements.length) improvements.push('Clean attempt — every word landed. Push the pace slightly and keep endings crisp.');

  return { at: Date.now(), transcript, marks, accuracy, completeness, fluency: Math.round(fluency), wpm, words, improvements };
}

const RKEY = 'amcat_svar_reviews';

export function readReview(itemId: string): SpeechReview | null {
  try {
    const all = JSON.parse(localStorage.getItem(RKEY) || '{}');
    return all[itemId] || null;
  } catch {
    return null;
  }
}

export function saveReview(itemId: string, r: SpeechReview) {
  try {
    const all = JSON.parse(localStorage.getItem(RKEY) || '{}');
    all[itemId] = r;
    localStorage.setItem(RKEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/* ---------------- JAM (extempore) grading ---------------- */

export interface JamGrade {
  at: number;
  topic: string;
  transcript: string;
  /** 0–10 overall */
  marks: number;
  content: number;
  language: number;
  delivery: number;
  wpm: number;
  fillers: number;
  feedback: string[];
  /** true when the LLM was unreachable and heuristics filled in */
  estimated: boolean;
}

const FILLER_RE = /\b(um+|uh+|erm+|ah+|er+|hmm+|like|basically|actually|you know|i mean)\b/gi;

function jamDelivery(wpm: number, fillerRate: number): number {
  const pace = wpm >= 110 && wpm <= 170 ? 100 : Math.max(0, 100 - Math.abs(wpm - 140) * 1.2);
  const clean = Math.max(0, 100 - fillerRate * 12);
  return Math.round(pace * 0.6 + clean * 0.4);
}

/**
 * Grade a 1-minute extempore: content + language from the LLM judge,
 * delivery from measured pace + filler rate. Heuristic fallback when the
 * LLM is unreachable (flagged as estimated in the UI).
 */
export async function gradeJam(topic: string, transcript: string, secs: number): Promise<JamGrade> {
  const words = norm(transcript);
  const wpm = Math.round((words.length / Math.max(1, secs)) * 60);
  const fillers = (transcript.match(FILLER_RE) || []).length;
  const fillerRate = words.length ? (fillers / words.length) * 100 : 0;
  const delivery = jamDelivery(wpm, fillerRate);

  const prompt =
    `You grade 1-minute extempore speeches for Concentrix screening (weights: ideas over polish).\n` +
    `Topic: "${topic}"\nSpeech (${secs}s, ~${words.length} words): "${transcript}"\n` +
    `Return ONLY JSON: {"content":0-10 (topic relevance, ideas, structure),` +
    `"language":0-10 (grammar, vocabulary range),` +
    `"feedback":["exactly 3 short actionable lines, each under 20 words"]}`;

  if (groqConfigured()) {
    let lastErr = 'No Groq model answered';
    for (const model of groqModelsFor()) {
      try {
        const text = await groqChat(
          model,
          'You are a strict but fair SVAR extempore examiner. Always reply with valid JSON only.',
          prompt + '\n\nReply with valid JSON only.',
          800
        );
        const g = extractJson(text);
        const content = Math.max(0, Math.min(10, Math.round(Number(g.content) || 0)));
        const language = Math.max(0, Math.min(10, Math.round(Number(g.language) || 0)));
        const feedback = Array.isArray(g.feedback) ? g.feedback.map(String).slice(0, 3) : [];
        const marks = Math.round(content * 0.4 + language * 0.3 + delivery * 0.3);
        return { at: Date.now(), topic, transcript, marks, content, language, delivery, wpm, fillers, feedback, estimated: false };
      } catch (e: any) {
        lastErr = String((e as any)?.message || e);
        continue;
      }
    }
    void lastErr;
  }

  // Heuristic fallback: length adequacy + vocabulary spread, honestly flagged.
  const uniq = new Set(words.filter((w) => w.length > 3)).size;
  const adequacy = Math.min(1, words.length / 110);
  const spread = Math.min(1, uniq / 60);
  const content = Math.round((adequacy * 0.6 + spread * 0.4) * 10);
  const language = Math.round(Math.min(10, 4 + spread * 6));
  const marks = Math.round(content * 0.4 + language * 0.3 + delivery * 0.3);
  const feedback = [
    `Spoke ~${words.length} words in ${secs}s — aim for 110–170 words in a minute.`,
    fillers > 3 ? `Cut filler sounds (${fillers} found: um, uh, like) — pause silently instead.` : 'Good control over filler sounds — keep pauses silent.',
    'AI judge unreachable, so this is an estimated score — retry with connection for full content feedback.',
  ];
  return { at: Date.now(), topic, transcript, marks, content, language, delivery, wpm, fillers, feedback, estimated: true };
}

/** One surprise topic when the bank runs out of surprises (Groq, else random). */
export async function surpriseTopic(fallback: string[]): Promise<{ topic: string; structure: string }> {
  const fallbackPick = () => ({
    topic: fallback[Math.floor(Math.random() * fallback.length)],
    structure: 'Opening line → 2 points → 1 example → Closing line',
  });
  if (!groqConfigured()) return fallbackPick();
  const prompt =
    `Give ONE original Just-A-Minute speech topic for Indian fresher job screening (workplace, society, or daily life — never politics or religion).\n` +
    `Avoid these recent topics: ${fallback.slice(0, 15).join(' | ')}.\n` +
    `Return ONLY JSON: {"topic":"...","structure":"..."} where structure is a 4-step speaking plan under 15 words.`;
  for (const model of groqModelsFor()) {
    try {
      const text = await groqChat(
        model,
        'You invent extempore topics. Always reply with valid JSON only.',
        prompt + '\n\nReply with valid JSON only.',
        300
      );
      const g = extractJson(text);
      if (typeof g.topic === 'string' && g.topic.trim().length > 4) {
        return { topic: g.topic.trim().slice(0, 120), structure: String(g.structure || '').slice(0, 160) || fallbackPick().structure };
      }
    } catch {
      continue;
    }
  }
  return fallbackPick();
}

const JKEY = 'amcat_jam_grades';

export function readJamGrade(topic: string): JamGrade | null {
  try {
    const all = JSON.parse(localStorage.getItem(JKEY) || '{}');
    return all[topic] || null;
  } catch {
    return null;
  }
}

export function saveJamGrade(topic: string, g: JamGrade) {
  try {
    const all = JSON.parse(localStorage.getItem(JKEY) || '{}');
    all[topic] = g;
    localStorage.setItem(JKEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
