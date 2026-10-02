import { create } from 'zustand';
import { getProfile, saveProfile, type Profile } from '../lib/store';

interface SessionState {
  userId: string | null;
  email: string;
  ready: boolean;
  profile: Profile | null;
  needsUsername: boolean;
  /** Whether we currently hold a token Supabase will accept (null = unknown yet). */
  hasCloudToken: boolean | null;
  /** Shown when the last profile save only reached this browser, not the cloud. */
  syncNote: string;
  sync: (userId: string | null, email: string) => Promise<void>;
  applyProfile: (username: string, avatarId: number) => Promise<void>;
  setHasCloudToken: (v: boolean | null) => void;
  dismissSyncNote: () => void;
  reset: () => void;
}

export const useSession = create<SessionState>()((set, get) => ({
  userId: null,
  email: '',
  ready: false,
  profile: null,
  needsUsername: false,
  hasCloudToken: null,
  syncNote: '',

  sync: async (userId, email) => {
    if (!userId) {
      set({ userId: null, email: '', ready: true, profile: null, needsUsername: false, syncNote: '', hasCloudToken: null });
      return;
    }
    try {
      const p = await getProfile(userId);
      if (p) set({ userId, email, ready: true, profile: { ...p, email: p.email || email }, needsUsername: false });
      else set({ userId, email, ready: true, profile: null, needsUsername: true });
    } catch {
      set({ userId, email, ready: true, profile: null, needsUsername: true });
    }
  },

  // Optimistic: the profile (avatar/username) applies instantly even if the
  // cloud is unreachable — the error no longer blocks the change.
  applyProfile: async (username, avatarId) => {
    const { userId, email } = get();
    if (!userId) throw new Error('Not logged in');
    const p: Profile = { userId, email, username: username.trim(), avatarId };
    const res = await saveProfile(p);
    set({
      profile: p,
      needsUsername: false,
      syncNote:
        res === 'local'
          ? 'Saved in this browser — it will sync to cloud automatically once the database is reachable.'
          : '',
    });
  },

  dismissSyncNote: () => set({ syncNote: '' }),

  setHasCloudToken: (v) => set({ hasCloudToken: v }),

  reset: () => set({ userId: null, email: '', ready: true, profile: null, needsUsername: false, syncNote: '', hasCloudToken: null }),
}));
