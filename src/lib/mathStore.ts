import type { Question } from '../types';
import { apiToken } from './store';
import { sb } from './supabase';

export interface MathSession {
  id: string;
  userId: string;
  username: string;
  at: number;
  correct: number;
  total: number;
  pct: number;
  answers: Record<string, number>;
  questions: Question[];
}

/** Set once the cloud table proves missing — stops spamming 404s until the SQL is run. */
let noTable = false;
function isMissingTable(error: any): boolean {
  if (noTable) return true;
  const msg = String(error?.message || '') + String(error?.code || '');
  if (/PGRST205|could not find the table/i.test(msg)) {
    noTable = true;
    return true;
  }
  return false;
}

export function mathSessionFromAnswers(
  owner: { userId: string; username: string },
  questions: Question[],
  answers: Record<string, number>
): MathSession {
  const correct = questions.filter((q) => answers[q.id] === q.answerIndex).length;
  return {
    id: `math-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    userId: owner.userId,
    username: owner.username,
    at: Date.now(),
    correct,
    total: questions.length,
    pct: questions.length ? Math.round((correct / questions.length) * 100) : 0,
    answers,
    questions,
  };
}

function localSessions(): MathSession[] {
  try {
    return JSON.parse(localStorage.getItem('amcat_math') || '[]');
  } catch {
    return [];
  }
}

/** Local-first save + best-effort cloud row (also stamps the 4h free quota). */
export async function saveMathSession(s: MathSession): Promise<void> {
  try {
    localStorage.setItem('amcat_math', JSON.stringify([s, ...localSessions()].slice(0, 50)));
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem('amcat_math_last', String(s.at));
  } catch {
    /* ignore */
  }
  try {
    if (noTable) return;
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return;
    const { error } = await db.from('math_sessions').insert({
      id: s.id,
      user_id: s.userId,
      username: s.username,
      correct: s.correct,
      total: s.total,
      pct: s.pct,
      answers: s.answers,
      questions: s.questions,
    });
    if (error) isMissingTable(error);
  } catch {
    /* table missing or offline — local copy still holds */
  }
}

export async function listMathSessions(userId: string | null): Promise<MathSession[]> {
  const local = localSessions().filter((s) => !userId || s.userId === userId);
  if (noTable) return local;
  try {
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token || !userId) return local;
    const { data, error } = await db
      .from('math_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error || !data) {
      if (error) isMissingTable(error);
      return local;
    }
    const cloud: MathSession[] = data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      username: d.username || '',
      at: new Date(d.created_at).getTime(),
      correct: d.correct,
      total: d.total,
      pct: d.pct,
      answers: d.answers || {},
      questions: d.questions || [],
    }));
    const seen = new Set(cloud.map((c) => c.id));
    return [...cloud, ...local.filter((s) => !seen.has(s.id))].slice(0, 50);
  } catch {
    return local;
  }
}

export async function deleteMathSession(id: string): Promise<void> {
  try {
    localStorage.setItem('amcat_math', JSON.stringify(localSessions().filter((s) => s.id !== id)));
  } catch {
    /* ignore */
  }
  try {
    if (noTable) return;
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return;
    const { error } = await db.from('math_sessions').delete().eq('id', id);
    if (error) isMissingTable(error);
  } catch {
    /* ignore */
  }
}

/** Newest cloud session timestamp (0 when the table is missing/offline). */
export async function lastCloudMathAt(userId: string | null): Promise<number> {
  try {
    if (!userId || noTable) return 0;
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return 0;
    const { data, error } = await db
      .from('math_sessions')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      if (error) isMissingTable(error);
      return 0;
    }
    return new Date(data.created_at).getTime();
  } catch {
    return 0;
  }
}

export function lastLocalMathAt(userId: string | null): number {
  void userId;
  try {
    return Number(localStorage.getItem('amcat_math_last') || 0);
  } catch {
    return 0;
  }
}
