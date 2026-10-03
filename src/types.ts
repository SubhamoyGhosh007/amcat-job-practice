export type SectionId = 'english' | 'quant' | 'logical' | 'csat';

export interface Question {
  id: string;
  section: SectionId;
  topic: string;
  prompt: string;
  options: [string, string, string, string];
  answerIndex: number; // 0-3
  explanation: string;
  /** Speed trick for maths sets; missing = none. Shown on the sheet + PDF. */
  trick?: string;
  /** Difficulty label for adaptive mode; missing = medium. */
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface ExamSet {
  id: string;
  createdAt: number;
  source: 'ai-gemini' | 'ai-zen' | 'ai-free' | 'offline-bank' | 'shared-bank';
  difficulty: 'easy' | 'medium' | 'hard';
  origin: 'ai' | 'pyq' | 'offline' | 'shared';
  adaptive: boolean;
  questions: Question[];
}

export interface SectionMeta {
  id: SectionId;
  name: string;
  count: number;
  minutes: number;
  description: string;
}

export const SECTIONS: SectionMeta[] = [
  { id: 'english', name: 'English Ability', count: 8, minutes: 8, description: 'Comprehension, vocabulary, grammar, sentence ordering' },
  { id: 'quant', name: 'Quantitative Ability', count: 8, minutes: 9, description: 'Percentages, profit & loss, time-speed-distance, averages' },
  { id: 'logical', name: 'Logical Reasoning', count: 7, minutes: 8, description: 'Coding-decoding, blood relations, series, puzzles' },
  { id: 'csat', name: 'Customer Service (Concentrix)', count: 7, minutes: 7, description: 'Situational judgement, email etiquette, prioritisation' },
];

export const totalQuestions = SECTIONS.reduce((a, s) => a + s.count, 0);
export const totalMinutes = SECTIONS.reduce((a, s) => a + s.minutes, 0);

export type Provider = 'gemini' | 'zen' | 'offline';

export interface AiSettings {
  provider: Provider;
  apiKey: string;
  model: string;
}

export const DEFAULT_MODELS: Record<Exclude<Provider, 'offline'>, string> = {
  gemini: 'gemini-2.0-flash',
  zen: 'big-pickle',
};
