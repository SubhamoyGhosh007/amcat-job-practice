/**
 * Token for Supabase calls.
 *
 * Primary path for the native Clerk↔Supabase integration: the standard
 * session token already carries the extra claim Supabase validates, so plain
 * getToken() is all that's needed.
 *
 * Fallback: older/alternate setups mint a dedicated `supabase` JWT template —
 * still honored if present.
 */
export async function getSupabaseToken(
  getToken: (opts?: Record<string, unknown>) => Promise<string | null>
): Promise<string | null> {
  try {
    const t = await getToken();
    if (t) return t;
  } catch {
    /* fall through to template */
  }
  try {
    const t = await getToken({ template: 'supabase' });
    if (t) return t;
  } catch {
    /* no template — caller falls back to local */
  }
  return null;
}
