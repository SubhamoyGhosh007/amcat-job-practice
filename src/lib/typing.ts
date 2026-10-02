import { WORDS } from '../data/words';
import { apiToken } from './store';
import { sb } from './supabase';

export type TypingMode = 'time' | 'words';

export interface TypingTest {
  id: string;
  userId: string;
  createdAt: number;
  mode: TypingMode;
  amount: number; // seconds (time) or word count (words)
  durationSec: number; // actual elapsed
  wpm: number;
  raw: number;
  acc: number;
  consistency: number;
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function genWords(mode: TypingMode, amount: number): string[] {
  const n = mode === 'time' ? 120 : amount;
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  return out;
}

export interface CharCounts {
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
}

/** Compare committed words + in-progress buffer against targets. */
export function countChars(words: string[], submitted: string[], wordIdx: number, current: string): CharCounts {
  let correct = 0;
  let incorrect = 0;
  let extra = 0;
  let missed = 0;
  const commit = (w: string, typed: string, partial: boolean) => {
    const n = Math.max(w.length, typed.length);
    for (let j = 0; j < n; j++) {
      const a = w[j];
      const b = typed[j];
      if (a === undefined) extra++;
      else if (b === undefined) {
        if (!partial) missed++;
      } else if (a === b) correct++;
      else incorrect++;
    }
  };
  for (let i = 0; i < wordIdx; i++) commit(words[i], submitted[i] || '', false);
  if (words[wordIdx] !== undefined) commit(words[wordIdx], current, true);
  correct += wordIdx; // one space per submitted word
  return { correct, incorrect, extra, missed };
}

export interface TypingStats extends CharCounts {
  wpm: number;
  raw: number;
  acc: number;
}

/** Net WPM = (correct/5)/min, raw = (all keystrokes/5)/min — the monkeytype standard. */
export function calcStats(c: CharCounts, keystrokes: number, elapsedSec: number): TypingStats {
  const minutes = Math.max(elapsedSec, 0.5) / 60;
  const typed = c.correct + c.incorrect + c.extra;
  return {
    ...c,
    wpm: Math.round(c.correct / 5 / minutes),
    raw: Math.round(keystrokes / 5 / minutes),
    acc: typed === 0 ? 100 : Math.round((c.correct / typed) * 100),
  };
}

/** Consistency from per-tick raw-WPM variance (monkeytype-style). */
export function calcConsistency(samples: number[]): number {
  const s = samples.slice(1);
  if (s.length < 2) return 100;
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  if (mean <= 0) return 100;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
  return Math.max(0, Math.round((1 - sd / mean) * 100));
}

// ---------- storage: local always, cloud when the table exists ----------

const KEY = 'amcat_typing';

function localTests(): TypingTest[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function toRow(t: TypingTest) {
  return {
    id: t.id,
    user_id: t.userId,
    mode: t.mode,
    amount: t.amount,
    duration_sec: t.durationSec,
    wpm: t.wpm,
    raw: t.raw,
    acc: t.acc,
    consistency: t.consistency,
    c_correct: t.correct,
    c_incorrect: t.incorrect,
    c_extra: t.extra,
    c_missed: t.missed,
  };
}

function fromRow(d: any): TypingTest {
  return {
    id: d.id,
    userId: d.user_id,
    createdAt: new Date(d.created_at).getTime(),
    mode: d.mode,
    amount: d.amount,
    durationSec: Number(d.duration_sec),
    wpm: d.wpm,
    raw: d.raw,
    acc: d.acc,
    consistency: d.consistency,
    correct: d.c_correct,
    incorrect: d.c_incorrect,
    extra: d.c_extra,
    missed: d.c_missed,
  };
}

export function newId() {
  return uid();
}

let cloudStatus: boolean | null = null;

/** Does the `typing_tests` table exist and answer? Cached per session. */
export async function typingCloudStatus(): Promise<boolean> {
  if (cloudStatus !== null) return cloudStatus;
  try {
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) {
      cloudStatus = false;
      return false;
    }
    const { error } = await db.from('typing_tests').select('id').limit(1);
    cloudStatus = !error;
  } catch {
    cloudStatus = false;
  }
  return cloudStatus;
}

export async function saveTypingTest(t: TypingTest): Promise<void> {
  localStorage.setItem(KEY, JSON.stringify([t, ...localTests()].slice(0, 100)));
  try {
    const token = await apiToken();
    const db = sb(token);
    if (db && token) await db.from('typing_tests').insert(toRow(t));
  } catch {
    /* table may not exist yet — local copy is the backup */
  }
}

export async function listTypingTests(userId: string | null): Promise<TypingTest[]> {
  const local = localTests();
  try {
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token || !userId) return userId ? local.filter((t) => t.userId === userId) : local;
    const { data, error } = await db
      .from('typing_tests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error || !data) return local.filter((t) => t.userId === userId);
    const cloud = (data as any[]).map(fromRow);
    const seen = new Set(cloud.map((c) => c.id));
    return [...cloud, ...local.filter((t) => !seen.has(t.id))].slice(0, 100);
  } catch {
    return userId ? local.filter((t) => t.userId === userId) : local;
  }
}

export async function deleteTypingTest(t: TypingTest): Promise<void> {
  localStorage.setItem(KEY, JSON.stringify(localTests().filter((x) => x.id !== t.id)));
  try {
    const token = await apiToken();
    const db = sb(token);
    if (db && token) await db.from('typing_tests').delete().eq('id', t.id);
  } catch {
    /* ignore */
  }
}
