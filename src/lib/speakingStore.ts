import type { SpeechReview } from './speechReview';
import { apiToken } from './store';
import { sb } from './supabase';

/** One finished speaking session: per-item reviews + overall marks. */
export interface SpeakingReport {
  id: string;
  userId: string;
  username: string;
  at: number;
  /** average marks 0–10 across scored items */
  marks: number;
  items: {
    key: string;
    kind: 'read' | 'repeat';
    text: string;
    secs: number;
    review: SpeechReview | null;
    poolId?: string;
  }[];
}

/** Fixed upper-bound recording limits (seconds) — the timer, not a guess. */
export const SPEAK_LIMITS = { read: 45, repeat: 25 } as const;

export function speakingReportFromItems(
  owner: { userId: string; username: string },
  items: SpeakingReport['items']
): SpeakingReport {
  const scored = items.filter((i) => i.review);
  const marks = scored.length ? Math.round((scored.reduce((a, i) => a + (i.review?.marks ?? 0), 0) / scored.length) * 10) / 10 : 0;
  return {
    id: `speak-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    userId: owner.userId,
    username: owner.username,
    at: Date.now(),
    marks,
    items,
  };
}

const LKEY = 'amcat_speaking_reports';

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

function localReports(): SpeakingReport[] {
  try {
    return JSON.parse(localStorage.getItem(LKEY) || '[]');
  } catch {
    return [];
  }
}

/** Local-first save + best-effort cloud row. Local part is synchronous. */
export async function saveSpeakingReport(r: SpeakingReport): Promise<void> {
  try {
    localStorage.setItem(LKEY, JSON.stringify([r, ...localReports()].slice(0, 50)));
  } catch {
    /* ignore */
  }
  try {
    if (noTable) return;
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return;
    const { error } = await db.from('speaking_reports').insert({
      id: r.id,
      user_id: r.userId,
      username: r.username,
      marks: r.marks,
      items: r.items,
    });
    if (error) isMissingTable(error);
  } catch {
    /* table missing or offline — local copy still holds */
  }
}

export async function listSpeakingReports(userId: string | null): Promise<SpeakingReport[]> {
  const local = localReports().filter((s) => !userId || s.userId === userId);
  if (noTable) return local;
  try {
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token || !userId) return local;
    const { data, error } = await db
      .from('speaking_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error || !data) {
      if (error) isMissingTable(error);
      return local;
    }
    const cloud: SpeakingReport[] = data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      username: d.username || '',
      at: new Date(d.created_at).getTime(),
      marks: d.marks,
      items: d.items || [],
    }));
    const seen = new Set(cloud.map((c) => c.id));
    return [...cloud, ...local.filter((s) => !seen.has(s.id))].slice(0, 50);
  } catch {
    return local;
  }
}

export async function deleteSpeakingReport(id: string): Promise<void> {
  try {
    localStorage.setItem(LKEY, JSON.stringify(localReports().filter((s) => s.id !== id)));
  } catch {
    /* ignore */
  }
  try {
    if (noTable) return;
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return;
    const { error } = await db.from('speaking_reports').delete().eq('id', id);
    if (error) isMissingTable(error);
  } catch {
    /* ignore */
  }
}
