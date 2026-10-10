import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ConfirmOptions {
  title: string;
  description?: string;
  actionLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface LeaveGuard {
  /** Called when the user confirms leaving (records the flag, discards the attempt). */
  confirmLeave: () => void;
}

interface UiState {
  collapsed: boolean;
  mobileOpen: boolean;
  theme: 'light' | 'dark';
  dialog: ConfirmOptions | null;
  /** Set while a monitored mock interview is running; sidebar/logout consult it. */
  leaveGuard: LeaveGuard | null;
  toggleCollapsed: () => void;
  setMobileOpen: (v: boolean) => void;
  toggleTheme: () => void;
  setLeaveGuard: (g: LeaveGuard | null) => void;
  ask: (o: ConfirmOptions) => Promise<boolean>;
  answer: (v: boolean) => void;
}

let pending: ((v: boolean) => void) | null = null;

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      collapsed: false,
      mobileOpen: false,
      theme: 'light',
      dialog: null,
      leaveGuard: null,
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
      setMobileOpen: (v) => set({ mobileOpen: v }),
      toggleTheme: () =>
        set((s) => {
          const next = s.theme === 'light' ? 'dark' : 'light';
          try {
            document.documentElement.setAttribute('data-theme', next);
          } catch {
            /* ignore */
          }
          return { theme: next };
        }),
      setLeaveGuard: (g) => set({ leaveGuard: g }),
      ask: (o) =>
        new Promise<boolean>((resolve) => {
          pending = resolve;
          set({ dialog: o });
        }),
      answer: (v) => {
        pending?.(v);
        pending = null;
        set({ dialog: null });
      },
    }),
      { name: 'amcat-ui', partialize: (s) => ({ collapsed: s.collapsed, mobileOpen: false, theme: s.theme }) as UiState }
  )
);
