import { authClient } from './supabase';

export interface TotpEnrollment {
  factorId: string;
  /** QR code as an SVG string — render it for the authenticator app to scan. */
  qrCode: string;
  /** Manual-entry secret, shown once. */
  secret: string;
  uri: string;
}

function needClient() {
  const c = authClient();
  if (!c) throw new Error('Database is not configured.');
  return c;
}

export async function listVerifiedTotp(): Promise<{ id: string; createdAt: string }[]> {
  const c = needClient();
  const { data, error } = await c.auth.mfa.listFactors();
  if (error) throw error;
  const all: any[] = (data as any)?.totp ?? (data as any)?.all ?? [];
  return all
    .filter((f) => f?.status === 'verified')
    .map((f: any) => ({ id: String(f.id), createdAt: String(f.created_at || '') }));
}

/** Starts enrollment. Show qrCode + secret, then confirm with a live code. */
export async function enrollTotp(): Promise<TotpEnrollment> {
  const c = needClient();
  const { data, error } = await c.auth.mfa.enroll({ factorType: 'totp' });
  if (error) throw error;
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

/** Confirms a fresh enrollment with a live 6-digit code. */
export async function confirmEnroll(factorId: string, code: string): Promise<void> {
  const c = needClient();
  const { error } = await c.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  if (error) throw error;
}

/** Disable: prove possession with a fresh code first, then remove. */
export async function removeTotp(factorId: string, code: string): Promise<void> {
  const c = needClient();
  const v = await c.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  if (v.error) throw v.error;
  const { error } = await c.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

/** Step-up at login: verify a code against the account's factor. */
export async function verifyLoginMfa(code: string): Promise<void> {
  const c = needClient();
  const factors = await listVerifiedTotp();
  if (!factors.length) throw new Error('No authenticator is linked to this account.');
  const { error } = await c.auth.mfa.challengeAndVerify({ factorId: factors[0].id, code: code.trim() });
  if (error) throw error;
}
