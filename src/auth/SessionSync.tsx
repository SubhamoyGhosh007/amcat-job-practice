import { useEffect } from 'react';
import { setTokenProvider } from '../lib/store';
import { authClient } from '../lib/supabase';
import { useSession } from '../stores/session';

/** Bridges Supabase Auth into the zustand session store. Render once at app root. */
export default function SessionSync() {
  const sync = useSession((s) => s.sync);

  useEffect(() => {
    const client = authClient();
    if (!client) {
      sync(null, '');
      return;
    }
    client.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      sync(u?.id ?? null, u?.email ?? '');
      useSession.getState().setHasCloudToken(data.session ? true : null);
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      sync(u?.id ?? null, u?.email ?? '');
      useSession.getState().setHasCloudToken(session ? true : null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [sync]);

  useEffect(() => {
    setTokenProvider(async () => {
      const c = authClient();
      if (!c) return null;
      const { data } = await c.auth.getSession();
      return data.session?.access_token ?? null;
    });
  }, []);

  return null;
}
