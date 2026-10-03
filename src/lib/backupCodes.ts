import { apiToken } from './store';
import { authClient, sb } from './supabase';

// Backup codes: the account-recovery path for lost authenticators.
// Security model:
// - Codes are random (~40-bit), shown ONCE, then only salted SHA-256 hashes
//   exist anywhere. No plaintext, no recovery of shown codes.
// - Burns happen ONLY inside the SECURITY DEFINER function below — clients
//   can never mark codes used, and hashes are never readable pre-login.
// - The function throttles: >20 bad guesses/hour per email = locked out.
// - A redeemed code buys a magic-link email, never a session directly.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion

export function genBackupCodes(n = 8): string[] {
  const rnd = new Uint8Array(n * 8);
  crypto.getRandomValues(rnd);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let s = '';
    for (let j = 0; j < 8; j++) s += ALPHABET[rnd[i * 8 + j] % ALPHABET.length];
    out.push(`${s.slice(0, 4)}-${s.slice(4)}`);
  }
  return out;
}

function randSalt(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export interface BackupCodeRow {
  id: string;
  used: boolean;
  createdAt: number;
}

/** Replace all codes (generation + revocation in one move). */
export async function replaceBackupCodes(userId: string, codes: string[]): Promise<void> {
  const token = await apiToken();
  const db = sb(token);
  if (!db || !token) throw new Error('Cloud unreachable — connect and retry.');
  const { error: delErr } = await db.from('mfa_recovery_codes').delete().eq('user_id', userId);
  if (delErr) throw new Error(delErr.message);
  const rows = [];
  for (const c of codes) {
    const salt = randSalt();
    rows.push({
      id: `${Date.now().toString(36)}${salt.slice(0, 6)}`,
      user_id: userId,
      salt,
      code_hash: await sha256Hex(`${salt}:${normalizeCode(c)}`),
      used: false,
    });
  }
  const { error } = await db.from('mfa_recovery_codes').insert(rows);
  if (error) throw new Error(error.message);
}

export async function listBackupCodes(userId: string | null): Promise<BackupCodeRow[]> {
  try {
    if (!userId) return [];
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return [];
    const { data, error } = await db
      .from('mfa_recovery_codes')
      .select('id,used,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error || !data) return [];
    return (data as any[]).map((d) => ({ id: d.id, used: !!d.used, createdAt: new Date(d.created_at).getTime() }));
  } catch {
    return [];
  }
}

export async function revokeAllBackupCodes(userId: string): Promise<void> {
  const token = await apiToken();
  const db = sb(token);
  if (!db || !token) throw new Error('Cloud unreachable — connect and retry.');
  const { error } = await db.from('mfa_recovery_codes').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/** Pre-login: verify email + unused code server-side (hashes never leave the DB). */
export async function redeemBackupCode(email: string, code: string): Promise<boolean> {
  const token = await apiToken();
  const db = sb(token);
  const client = db || authClient();
  if (!client) return false;
  const { data, error } = await client.rpc('redeem_recovery_code', { p_email: email.trim(), p_code: code.trim() });
  if (error) return false;
  return data === true;
}

/** After a good redeem, the way back in is a magic link (never a minted session). */
export async function sendRecoveryLink(email: string): Promise<void> {
  const c = authClient();
  if (!c) throw new Error('Database is not configured.');
  const { error } = await c.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${window.location.origin}/app` },
  });
  if (error) throw error;
}
