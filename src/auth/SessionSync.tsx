import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import { useEffect, useRef } from 'react';
import { setTokenProvider } from '../lib/store';
import { getSupabaseToken } from '../lib/token';
import { useSession } from '../stores/session';

/** Bridges Clerk hooks into the zustand session store. Render once at app root. */
export default function SessionSync() {
  const { user, isLoaded } = useUser();
  const { getToken } = useClerkAuth();
  const sync = useSession((s) => s.sync);
  const setHasCloudToken = useSession((s) => s.setHasCloudToken);
  const probed = useRef<string | null>(null);

  useEffect(() => {
    setTokenProvider(() => getSupabaseToken(getToken));
  }, [getToken]);

  useEffect(() => {
    if (isLoaded) {
      sync(user?.id ?? null, user?.primaryEmailAddress?.emailAddress ?? '');
    }
  }, [isLoaded, user, sync]);

  // Resolve once per login whether we hold a token Supabase will accept, so
  // the Health page can report paused-vs-backing-up honestly.
  useEffect(() => {
    if (!isLoaded || probed.current === (user?.id ?? null)) return;
    probed.current = user?.id ?? null;
    if (!user?.id) {
      setHasCloudToken(null);
      return;
    }
    getSupabaseToken(getToken).then(
      (t) => setHasCloudToken(t !== null),
      () => setHasCloudToken(false)
    );
  }, [isLoaded, user, getToken, setHasCloudToken]);

  return null;
}
