import type { ExamSet, Question } from '../types';
import { apiToken } from './store';
import { sb } from './supabase';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type BankSource = 'ai' | 'pyq';

interface SharedRow {
  id: string;
  created_by: string;
  difficulty: string;
  source: string;
  questions: Question[];
  times_used: number;
}

/**
 * Shared question pool: generated sheets are published here; learners are
 * served sets they have NOT attempted yet. When the pool runs dry for a
 * (difficulty, source) combo, a fresh AI set is generated and shared.
 */
export async function fetchUnattempted(
  userId: string | null,
  difficulty: Difficulty,
  source: BankSource
): Promise<ExamSet | null> {
  try {
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return null;

    let doneIds: string[] = [];
    if (userId) {
      const { data } = await db.from('set_attempts').select('set_id').eq('user_id', userId);
      doneIds = (data || []).map((d: any) => d.set_id);
    }
    const exclude = (q: any) => {
      if (!doneIds.length) return q;
      const list = `(${doneIds.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
      return q.not('id', 'in', list);
    };

    // exact match first, then same difficulty any source
    for (const src of [source, null] as const) {
      let q = db
        .from('shared_sets')
        .select('*')
        .eq('difficulty', difficulty)
        .order('times_used', { ascending: true })
        .limit(1);
      if (src) q = q.eq('source', src);
      const res = await exclude(q);
      const row = (res.data as SharedRow[] | null)?.[0];
      if (row && Array.isArray(row.questions) && row.questions.length >= 10) {
        await db.from('shared_sets').update({ times_used: (row.times_used || 0) + 1 }).eq('id', row.id);
        return {
          id: row.id,
          createdAt: Date.now(),
          source: 'shared-bank' as ExamSet['source'],
          difficulty,
          origin: row.source === 'pyq' ? 'pyq' : 'ai',
          questions: row.questions,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Publish a freshly generated set to the pool (best-effort, never throws). */
export async function publishSet(set: ExamSet, userId: string | null, difficulty: Difficulty, source: BankSource): Promise<void> {
  try {
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return;
    await db.from('shared_sets').insert({
      id: set.id,
      created_by: userId || 'guest',
      difficulty,
      source,
      questions: set.questions,
      times_used: 1,
    });
  } catch {
    /* pool unavailable — the set still works locally */
  }
}

/** Record that a user finished a set (best-effort, never throws). */
export async function recordAttempt(
  userId: string | null,
  setId: string,
  correct: number,
  total: number,
  pct: number
): Promise<void> {
  if (!userId) return;
  try {
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return;
    await db.from('set_attempts').insert({
      id: `${userId.slice(-6)}-${setId}-${Date.now().toString(36)}`,
      user_id: userId,
      set_id: setId,
      correct,
      total,
      pct,
    });
  } catch {
    /* duplicate or offline — ignore */
  }
}
