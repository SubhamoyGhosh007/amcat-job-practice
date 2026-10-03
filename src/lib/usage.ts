import { apiToken } from './store';
import { sb } from './supabase';

// Free-tier daily quotas. PAYWALL HOOK: TIERS is the single source of truth —
// a pricing page later just moves users between keys here.
// Pro = effectively unlimited (Number.MAX_SAFE_INTEGER reads as "Unlimited" in UI).
export const FREE_QUOTAS = { sets: 5, speaking: 5, typing: 10 } as const;
const PRO_QUOTAS = {
  sets: Number.MAX_SAFE_INTEGER,
  speaking: Number.MAX_SAFE_INTEGER,
  typing: Number.MAX_SAFE_INTEGER,
} as const;
export type QuotaKind = keyof typeof FREE_QUOTAS;
export type Tier = 'free' | 'pro';

export function quotasFor(tier: Tier | undefined): Record<QuotaKind, number> {
  return tier === 'pro' ? { ...PRO_QUOTAS } : { ...FREE_QUOTAS };
}

export interface QuotaStatus {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** True when cloud is unreachable — grace mode, local only. */
  offline: boolean;
}

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Cloud counts are truth when reachable; offline we allow with grace. */
export async function quotaStatus(kind: QuotaKind, userId: string | null, tier: Tier = 'free'): Promise<QuotaStatus> {
  const limit = quotasFor(tier)[kind];
  if (limit === Number.MAX_SAFE_INTEGER) {
    return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, limit, offline: false };
  }
  try {
    if (!userId) return { allowed: true, remaining: limit, limit, offline: true };
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return { allowed: true, remaining: limit, limit, offline: true };
    const { data, error } = await db
      .from('daily_usage')
      .select('sets,speaking,typing')
      .eq('user_id', userId)
      .eq('day', todayKey())
      .maybeSingle();
    if (error) return { allowed: true, remaining: limit, limit, offline: true };
    const used = data?.[kind] ?? 0;
    return { allowed: used < limit, remaining: Math.max(0, limit - used), limit, offline: false };
  } catch {
    return { allowed: true, remaining: limit, limit, offline: true };
  }
}

/** Increment today's counter (best-effort, never throws). */
export async function bumpQuota(kind: QuotaKind, userId: string | null): Promise<void> {
  try {
    if (!userId) return;
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return;
    const { data } = await db
      .from('daily_usage')
      .select('sets,speaking,typing')
      .eq('user_id', userId)
      .eq('day', todayKey())
      .maybeSingle();
    const cur = { sets: 0, speaking: 0, typing: 0, ...(data || {}) };
    await db.from('daily_usage').upsert(
      { user_id: userId, day: todayKey(), sets: cur.sets, speaking: cur.speaking, typing: cur.typing, [kind]: ((cur as any)[kind] || 0) + 1 },
      { onConflict: 'user_id,day' }
    );
  } catch {
    /* offline — grace mode */
  }
}
