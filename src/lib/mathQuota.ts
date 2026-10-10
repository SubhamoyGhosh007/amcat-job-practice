import { lastCloudMathAt, lastLocalMathAt } from './mathStore';
import type { Tier } from './usage';

export const MATH_FREE_WINDOW_MS = 4 * 3600 * 1000;

export interface MathQuota {
  allowed: boolean;
  /** ms until the next free session (0 when allowed). */
  retryInMs: number;
}

export function formatWait(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

/** Paid tiers = unlimited. Free = 1 maths session per 4 hours (cloud truth, local mirror). */
export async function mathQuotaStatus(userId: string | null, tier: Tier = 'free'): Promise<MathQuota> {
  if (tier !== 'free') return { allowed: true, retryInMs: 0 };
  const [cloud, local] = await Promise.all([lastCloudMathAt(userId), Promise.resolve(lastLocalMathAt(userId))]);
  const last = Math.max(cloud, local);
  const elapsed = Date.now() - last;
  if (last <= 0 || elapsed >= MATH_FREE_WINDOW_MS) return { allowed: true, retryInMs: 0 };
  return { allowed: false, retryInMs: MATH_FREE_WINDOW_MS - elapsed };
}
