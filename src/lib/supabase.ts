import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const RAW_URL = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
// Must be the bare project URL (https://xyz.supabase.co) —
// the client appends /rest/v1 itself, so strip it (and stray slashes) if present.
const URL = RAW_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
const ANON = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export function isDbConfigured(): boolean {
  return Boolean(URL && ANON);
}

/**
 * Browser-safe client. The anon key is public by design; row access is
 * enforced by Postgres RLS policies that read the Supabase user id out of the
 * validated session JWT (native Supabase Auth — no third-party handshake).
 */
export function sb(token?: string | null): SupabaseClient | null {
  if (!isDbConfigured()) return null;
  return createClient(
    URL,
    ANON,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined
  );
}

let _auth: SupabaseClient | null = null;

/** Singleton for auth ops (sign-in/out, session, subscription). One client only. */
export function authClient(): SupabaseClient | null {
  if (!isDbConfigured()) return null;
  if (!_auth) _auth = createClient(URL, ANON);
  return _auth;
}

export interface DbDiagnosis {
  ok: boolean;
  title: string;
  detail: string;
}

/**
 * Pinpoints the broken link without ever exposing keys: step 1 checks the
 * anon/publishable key alone, step 2 checks the login session, and
 * a 404 at either step means the tables were never created.
 */
export async function diagnoseDb(sessionToken: string | null): Promise<DbDiagnosis> {
  if (!isDbConfigured()) {
    return { ok: false, title: 'Database not configured', detail: 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are empty. Add them to .env and restart the dev server.' };
  }
  const probe = `${URL}/rest/v1/profiles?select=id&limit=1`;
  let anonRes: Response;
  try {
    anonRes = await fetch(probe, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  } catch {
    return { ok: false, title: 'Cannot reach Supabase', detail: 'Network error reaching the project URL. Check VITE_SUPABASE_URL and your internet connection.' };
  }
  if (anonRes.status === 401) {
    return { ok: false, title: 'API key rejected (401)', detail: 'The key in VITE_SUPABASE_ANON_KEY does not match this project. Copy the Project URL + publishable key from the SAME project (Supabase → Project Settings → API) into .env, then restart the dev server.' };
  }
  if (anonRes.status === 404) {
    return { ok: false, title: 'Tables not found (404)', detail: 'The key works, but the profiles table does not exist. Run the README SQL snippet once in the Supabase SQL editor.' };
  }
  if (!sessionToken) {
    return { ok: false, title: 'Key OK, login unchecked', detail: 'API key works. Stay logged in and test again to verify the session.' };
  }
  let authRes: Response;
  try {
    authRes = await fetch(probe, { headers: { apikey: ANON, Authorization: `Bearer ${sessionToken}` } });
  } catch {
    return { ok: false, title: 'Cannot reach Supabase', detail: 'Network error on the authenticated check. Retry in a moment.' };
  }
  if (authRes.status === 401) {
    return { ok: false, title: 'Login token rejected (401)', detail: 'API key is fine, but the login session was rejected. Sign out and back in, then test again.' };
  }
  if (authRes.status === 404) {
    return { ok: false, title: 'Tables not found (404)', detail: 'Key and login both work, but the tables are missing. Run the README SQL snippet once in the Supabase SQL editor.' };
  }
  return { ok: true, title: 'Connection healthy ✓', detail: 'Key, login handshake and tables all respond. If a save still fails, re-run the README SQL to restore the RLS policies.' };
}
