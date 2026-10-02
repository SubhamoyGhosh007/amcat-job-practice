import { useCallback } from 'react';
import { useClerk, useSignIn, useSignUp } from '@clerk/clerk-react';
import { useSession } from '../stores/session';

export type OAuthProvider = 'google' | 'github' | 'facebook';

const STRATEGY: Record<OAuthProvider, string> = {
  google: 'oauth_google',
  github: 'oauth_github',
  facebook: 'oauth_facebook',
};

export function useAuthActions() {
  const { signIn } = useSignIn();
  const { signUp, setActive: suActive } = useSignUp();
  const { setActive: siActive, signOut } = useClerk();

  const login = useCallback(
    async (p: OAuthProvider) => {
      if (!signIn) throw new Error('Sign-in is still loading — try again in a second.');
      await signIn.authenticateWithRedirect({
        strategy: STRATEGY[p] as any,
        redirectUrl: `${window.location.origin}/?auth=callback`,
        redirectUrlComplete: '/app',
      });
    },
    [signIn]
  );

  const loginEmail = useCallback(
    async (em: string, pw: string) => {
      if (!signIn) throw new Error('Sign-in is still loading — try again in a second.');
      const r = await signIn.create({ identifier: em, password: pw });
      if (r.status === 'complete') {
        await siActive({ session: r.createdSessionId });
      } else {
        throw new Error('This account needs another verification step — use an OAuth button instead.');
      }
    },
    [signIn, siActive]
  );

  const registerEmail = useCallback(
    async (name: string, em: string, pw: string): Promise<'done' | 'verify'> => {
      if (!signUp) throw new Error('Sign-up is still loading — try again in a second.');
      const r = await signUp.create({ emailAddress: em, password: pw, firstName: name || undefined });
      if (r.status === 'complete') {
        await suActive({ session: r.createdSessionId });
        return 'done';
      }
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      return 'verify';
    },
    [signUp, suActive]
  );

  const verifyEmailCode = useCallback(
    async (code: string) => {
      if (!signUp) throw new Error('Sign-up expired — start over.');
      const r = await signUp.attemptEmailAddressVerification({ code });
      if (r.status === 'complete') {
        await suActive({ session: r.createdSessionId });
      } else {
        throw new Error('Code not accepted — check it and retry.');
      }
    },
    [signUp, suActive]
  );

  const logout = useCallback(async () => {
    await signOut();
    useSession.getState().reset();
  }, [signOut]);

  return { login, loginEmail, registerEmail, verifyEmailCode, logout };
}
