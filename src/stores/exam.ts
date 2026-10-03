import { create } from 'zustand';
import type { ExamSet } from '../types';
import type { ScoreSheet } from '../lib/store';

export interface Violation {
  type: string;
  at: number;
}

const lastLog: Record<string, number> = {};

interface ExamState {
  activeSet: ExamSet | null;
  activeAnswers: Record<string, number>;
  lastSheet: ScoreSheet | null;
  difficulty: 'easy' | 'medium' | 'hard';
  pyq: boolean;
  proctored: boolean;
  violations: Violation[];
  setPrefs: (p: { difficulty?: 'easy' | 'medium' | 'hard'; pyq?: boolean }) => void;
  setProctored: (v: boolean) => void;
  logViolation: (v: Violation) => void;
  start: (set: ExamSet) => void;
  finish: (sheet: ScoreSheet, answers: Record<string, number>) => void;
  review: (sheet: ScoreSheet) => void;
  clear: () => void;
}

export const useExam = create<ExamState>()((set) => ({
  activeSet: null,
  activeAnswers: {},
  lastSheet: null,
  difficulty: 'medium',
  pyq: false,
  proctored: false,
  violations: [],

  setPrefs: (p) => set((s) => ({ difficulty: p.difficulty ?? s.difficulty, pyq: p.pyq ?? s.pyq })),

  setProctored: (v) => set({ proctored: v }),

  logViolation: (v) => {
    const now = Date.now();
    if (now - (lastLog[v.type] || 0) < 5000) return; // throttle bursts (alt-tab flurries)
    lastLog[v.type] = now;
    set((s) => ({ violations: [...s.violations, v] }));
  },

  start: (examSet) => set({ activeSet: examSet, activeAnswers: {}, lastSheet: null, violations: [] }),

  finish: (sheet, answers) => set({ lastSheet: sheet, activeAnswers: answers }),

  review: (sheet) =>
    set({
      activeSet: {
        id: sheet.setId,
        createdAt: sheet.createdAt,
        source: sheet.source as ExamSet['source'],
        difficulty: (sheet.difficulty as ExamSet['difficulty']) || 'medium',
        origin: (sheet.origin as ExamSet['origin']) || 'offline',
        adaptive: false,
        questions: sheet.questions,
      },
      activeAnswers: sheet.answers,
      lastSheet: sheet,
      violations: [],
    }),

  clear: () => set({ activeSet: null, activeAnswers: {}, lastSheet: null }),
}));
