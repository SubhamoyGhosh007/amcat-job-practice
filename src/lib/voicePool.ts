import { apiToken } from './store';
import { sb } from './supabase';
import type { VoiceSample } from './voiceGen';

export type VoiceTier = 'free' | 'pro';

/** Set once the cloud tables prove missing — stops spamming 404s until the SQL is run. */
let noTable = false;
function isMissingTable(error: any): boolean {
  if (noTable) return true;
  const msg = String(error?.message || '') + String(error?.code || '') + String(error?.status || '') + String(error?.details || '');
  if (/PGRST205|could not find the table|404|not found/i.test(msg) || error?.code === '404' || error?.status === 404) {
    noTable = true;
    return true;
  }
  return false;
}

async function bumpUsage(db: any, id: string): Promise<void> {
  try {
    const { error } = await db.rpc('increment_voice_usage', { sample_id: id });
    if (error) throw error;
  } catch {
    try {
      const { data } = await db.from('voice_samples').select('times_used').eq('id', id).maybeSingle();
      await db.from('voice_samples').update({ times_used: ((data as any)?.times_used || 0) + 1 }).eq('id', id);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Unattempted pooled voice samples for this user (same tier first).
 * Users who haven't finished old samples keep getting them until done;
 * only exhausted pools trigger fresh AI batches. Empty array when the
 * tables are missing/offline — the static banks cover that case.
 */
export async function fetchUnattemptedSamples(
  userId: string | null,
  kind: 'read' | 'repeat',
  limit: number,
  tier: VoiceTier = 'free'
): Promise<VoiceSample[]> {
  if (noTable) return [];
  try {
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return [];
    const done = new Set<string>();
    if (userId) {
      const { data, error } = await db.from('voice_sample_attempts').select('sample_id').eq('user_id', userId);
      if (error) {
        if (isMissingTable(error)) return [];
      } else {
        for (const d of (data || []) as any[]) done.add(String(d.sample_id));
      }
    }
    const build = (tiered: boolean) => {
      let q = db
        .from('voice_samples')
        .select('id,kind,text,tip,times_used')
        .eq('kind', kind)
        .order('times_used', { ascending: true })
        .limit(25);
      if (tiered) q = q.eq('tier', tier);
      return q;
    };
    let res = await build(true);
    if (res.error) {
      if (isMissingTable(res.error)) return [];
      res = await build(false);
      if (res.error) return [];
    }
    const out: VoiceSample[] = [];
    for (const r of ((res.data as any[]) || [])) {
      if (done.has(String(r.id))) continue;
      out.push({ id: String(r.id), kind, text: String(r.text || ''), tip: r.tip ? String(r.tip) : undefined });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Publish fresh AI samples to the pool; returns them with ids (empty on failure). */
export async function publishSamples(
  rows: { kind: 'read' | 'repeat'; text: string; tip?: string }[],
  tier: VoiceTier = 'free'
): Promise<VoiceSample[]> {
  if (noTable || !rows.length) return [];
  try {
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return [];
    const stamp = Date.now().toString(36);
    const withIds = rows.map((r, i) => ({
      id: `vs-${stamp}-${Math.random().toString(36).slice(2, 6)}${i}`,
      kind: r.kind,
      tier,
      text: r.text,
      tip: r.tip || '',
      times_used: 1,
    }));
    const { error } = await db.from('voice_samples').insert(withIds);
    if (error) {
      isMissingTable(error);
      return [];
    }
    for (const w of withIds) void bumpUsage(db, w.id);
    return withIds.map((w) => ({ id: w.id, kind: w.kind as 'read' | 'repeat', text: w.text, tip: w.tip || undefined }));
  } catch {
    return [];
  }
}

/** Mark pool samples completed by this user (best-effort, never throws). */
export async function recordSampleCompletions(userId: string | null, sampleIds: string[]): Promise<void> {
  if (!userId || !sampleIds.length || noTable) return;
  try {
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return;
    const { error } = await db
      .from('voice_sample_attempts')
      .upsert(sampleIds.map((sample_id) => ({ user_id: userId, sample_id })), {
        onConflict: 'user_id,sample_id',
        ignoreDuplicates: true,
      });
    if (error) isMissingTable(error);
  } catch {
    /* ignore */
  }
}
