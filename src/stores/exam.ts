import { create } from 'zustand';
import type { ExamSet } from '../types';
import type { ScoreSheet } from '../lib/store';

interface ExamState {
  activeSet: ExamSet | null;
  activeAnswers: Record<string, number>;
  lastSheet: ScoreSheet | null;
  difficulty: 'easy' | 'medium' | 'hard';
  pyq: boolean;
  setPrefs: (p: { difficulty?: 'easy' | 'medium' | 'hard'; pyq?: boolean }) => void;
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

  setPrefs: (p) => set((s) => ({ difficulty: p.difficulty ?? s.difficulty, pyq: p.pyq ?? s.pyq })),

  start: (examSet) => set({ activeSet: examSet, activeAnswers: {}, lastSheet: null }),

  finish: (sheet, answers) => set({ lastSheet: sheet, activeAnswers: answers }),

  review: (sheet) =>
    set({
      activeSet: {
        id: sheet.setId,
        createdAt: sheet.createdAt,
        source: sheet.source as ExamSet['source'],
        difficulty: (sheet.difficulty as ExamSet['difficulty']) || 'medium',
        origin: (sheet.origin as ExamSet['origin']) || 'offline',
        questions: sheet.questions,
      },
      activeAnswers: sheet.answers,
      lastSheet: sheet,
    }),

  clear: () => set({ activeSet: null, activeAnswers: {}, lastSheet: null }),
}));
