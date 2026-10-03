import { useCallback } from 'react';
import { authClient } from '../lib/supabase';
import { verifyLoginMfa } from '../lib/mfa';
import { useSession } from '../stores/session';

export type OAuthProvider = 'google' | 'github';

export interface Identity {
  provider: string;
  email: string;
}

function needClient() {
  const c = authClient();
  if (!c) throw new Error('Database is not configured yet — add the Supabase URL + key to .env (see README).');
  return c;
}

export function useAuthActions() {
  const login = useCallback(async (p: OAuthProvider) => {
    const c = needClient();
    const { error } = await c.auth.signInWithOAuth({
      provider: p,
      options: { redirectTo: `${window.location.origin}/app` },
    });
    if (error) throw error;
  }, []);

  const loginEmail = useCallback(async (em: string, pw: string): Promise<'done' | 'mfa'> => {
    const c = needClient();
    const { error } = await c.auth.signInWithPassword({ email: em, password: pw });
    if (error) throw error;
    try {
      const { data } = await c.auth.mfa.getAuthenticatorAssuranceLevel();
      if ((data as any)?.nextLevel === 'aal2') return 'mfa';
    } catch {
      /* no MFA enrolled — plain login */
    }
    return 'done';
  }, []);

  const verifyMfa = useCallback(async (code: string) => {
    await verifyLoginMfa(code);
  }, []);

  const registerEmail = useCallback(async (_name: string, em: string, pw: string): Promise<'done' | 'confirm'> => {
    const c = needClient();
    const { data, error } = await c.auth.signUp({ email: em, password: pw });
    if (error) throw error;
    return data.session ? 'done' : 'confirm';
  }, []);

  const resendConfirm = useCallback(async (em: string) => {
    const c = needClient();
    const { error } = await c.auth.resend({ type: 'signup', email: em });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    try {
      await needClient().auth.signOut();
    } catch {
      /* ignore */
    }
    useSession.getState().reset();
  }, []);

  return { login, loginEmail, verifyMfa, registerEmail, resendConfirm, logout };
}
