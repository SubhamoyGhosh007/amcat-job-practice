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
  tier?: string;
  questions: Question[];
  times_used: number;
}

export type Tier = 'free' | 'pro';

function toExamSet(row: SharedRow, difficulty: Difficulty): ExamSet {
  return {
    id: row.id,
    createdAt: Date.now(),
    source: 'shared-bank' as ExamSet['source'],
    difficulty,
    origin: row.source === 'pyq' ? 'pyq' : 'ai',
    adaptive: false,
    questions: row.questions,
  };
}

/** Atomic usage bump; false when the RPC is missing (caller falls back). */
async function bumpUsage(db: any, setId: string): Promise<boolean> {
  try {
    const { error } = await db.rpc('increment_set_usage', { set_id: setId });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Shared question pool: generated sheets are published here; learners are
 * served sets they have NOT attempted yet. Free and pro pools are strictly
 * separate. When the pool runs dry for a (difficulty, source, tier) combo,
 * a fresh AI set is generated and shared.
 *
 * Pre-SQL tolerance: the `tier` column and `increment_set_usage` RPC may not
 * exist yet — every tiered/RPC step falls back to the legacy path instead of
 * throwing, so the app works before and after the migration.
 */
export async function fetchUnattempted(
  userId: string | null,
  difficulty: Difficulty,
  source: BankSource,
  tier: Tier = 'free'
): Promise<ExamSet | null> {
  try {
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return null;

    // Native JS array — never a hand-built string (see .not() below).
    let doneIds: string[] = [];
    if (userId) {
      const { data } = await db.from('set_attempts').select('set_id').eq('user_id', userId);
      doneIds = (data || []).map((d: any) => d.set_id);
    }
    const exclude = (q: any) => (doneIds.length ? q.not('id', 'in', doneIds) : q);
    const withTier = (q: any) => q.eq('tier', tier);

    // exact match first, then same difficulty any source (tier still respected)
    for (const src of [source, null] as const) {
      const build = (tiered: boolean) => {
        let q = db.from('shared_sets').select('*').eq('difficulty', difficulty);
        if (tiered) q = withTier(q);
        if (src) q = q.eq('source', src);
        return exclude(q.order('times_used', { ascending: true }).limit(1));
      };
      // Tiered pass; if the column doesn't exist yet, PostgREST errors and we
      // retry the identical query untiered.
      let res = await build(true);
      if (res.error) res = await build(false);
      const row = (res.data as SharedRow[] | null)?.[0];
      if (row && Array.isArray(row.questions) && row.questions.length >= 10) {
        const atomic = await bumpUsage(db, row.id);
        if (!atomic) {
          await db
            .from('shared_sets')
            .update({ times_used: (row.times_used || 0) + 1 })
            .eq('id', row.id);
        }
        return toExamSet(row, difficulty);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Publish a freshly generated set to the pool (best-effort, never throws). */
export async function publishSet(
  set: ExamSet,
  userId: string | null,
  difficulty: Difficulty,
  source: BankSource,
  tier: Tier = 'free'
): Promise<void> {
  try {
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return;
    const base = {
      id: set.id,
      created_by: userId || 'guest',
      difficulty,
      source,
      questions: set.questions,
      times_used: 1,
    };
    const tiered = await db.from('shared_sets').insert({ ...base, tier });
    if (tiered.error) await db.from('shared_sets').insert(base);
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
