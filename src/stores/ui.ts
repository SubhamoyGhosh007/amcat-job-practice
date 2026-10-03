import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ConfirmOptions {
  title: string;
  description?: string;
  actionLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface UiState {
  collapsed: boolean;
  mobileOpen: boolean;
  dialog: ConfirmOptions | null;
  toggleCollapsed: () => void;
  setMobileOpen: (v: boolean) => void;
  ask: (o: ConfirmOptions) => Promise<boolean>;
  answer: (v: boolean) => void;
}

let pending: ((v: boolean) => void) | null = null;

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      collapsed: false,
      mobileOpen: false,
      dialog: null,
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
      setMobileOpen: (v) => set({ mobileOpen: v }),
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
    { name: 'amcat-ui', partialize: (s) => ({ collapsed: s.collapsed, mobileOpen: false }) as UiState }
  )
);
