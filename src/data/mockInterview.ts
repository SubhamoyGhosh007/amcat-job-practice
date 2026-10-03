// Concentrix AMCAT-style mock interview: 7 spoken parts (A–G).
// Audio items are played ONCE (exam rule); answers are recorded with per-item timers.

export interface PartABItem {
  id: string;
  context: string;
  questions: { q: string; expected: string }[];
}

export interface SpeechLine {
  id: string;
  text: string;
}

export interface ReadLine extends SpeechLine {
  tip: string;
}

export interface PartEItem {
  id: string;
  topic: string;
  prepSec: number;
  speakSec: number;
}

export interface PartFItem {
  id: string;
  /** Spoken transcript — "dash" is read aloud, mirroring the real test. */
  audio: string;
  missing: string[];
  full: string;
}

export interface PartGItem {
  id: string;
  audio: string;
  corrected: string;
  rule: string;
}

export interface MockTest {
  test_id: string;
  sections: {
    part_a: PartABItem[];
    part_b: PartABItem[];
    part_c: ReadLine[];
    part_d: SpeechLine[];
    part_e: PartEItem[];
    part_f: PartFItem[];
    part_g: PartGItem[];
  };
}

export interface MockSession {
  id: string;
  at: number;
  answers: number;
  durationSec: number;
  /** Tab/fullscreen violations during the attempt. */
  flags?: number;
}

export const MOCK_TEST_01: MockTest = {
  test_id: 'concentrix_amcat_mock_01',
  sections: {
    part_a: [
      {
        id: 'a1',
        context: 'Your name is Emma. Today is your first day at your new job in a marketing company. You are a little nervous but mostly excited to meet your team and start working on real projects.',
        questions: [
          { q: 'What is your name?', expected: 'My name is Emma.' },
          { q: 'What special day is it today?', expected: 'Today is my first day at my new job in a marketing company.' },
          { q: 'How do you feel about your first day?', expected: 'I feel a little nervous but mostly excited.' },
        ],
      },
      {
        id: 'a2',
        context: 'Your name is David. You joined the customer support team last Monday. Your shift starts at nine in the morning, and your team leader’s name is Sarah.',
        questions: [
          { q: 'Which team did David join?', expected: 'He joined the customer support team.' },
          { q: 'When does his shift start?', expected: 'His shift starts at nine in the morning.' },
          { q: 'Who is his team leader?', expected: 'His team leader is Sarah.' },
        ],
      },
    ],
    part_b: [
      {
        id: 'b1',
        context: 'You and Patricia are planning a team-building workshop for your company. The workshop is scheduled for Friday afternoon in the main conference room. You are in charge of preparing the training materials and coordinating with the trainer. Patricia is arranging the seating and taking care of refreshments. The aim of the workshop is to improve communication and collaboration among team members.',
        questions: [
          { q: 'When is the workshop scheduled?', expected: 'The workshop is scheduled for Friday afternoon.' },
          { q: 'Where will the workshop take place?', expected: 'It will take place in the main conference room.' },
          { q: 'What are your responsibilities?', expected: 'I am in charge of preparing training materials and coordinating with the trainer.' },
        ],
      },
      {
        id: 'b2',
        context: 'You and Rohan handle night-shift support for a telecom client. Calls peak between eleven at night and two in the morning. Rohan takes billing queries while you handle network complaints. Every case must be logged in the tracker before the shift ends at six in the morning.',
        questions: [
          { q: 'When do calls peak?', expected: 'Calls peak between eleven at night and two in the morning.' },
          { q: 'Who handles billing queries?', expected: 'Rohan handles billing queries.' },
          { q: 'What must be done before six in the morning?', expected: 'Every case must be logged in the tracker.' },
        ],
      },
    ],
    part_c: [
      { id: 'c1', text: 'She submitted the final report after reviewing every detail carefully.', tip: 'Land the ending — trailing off makes you sound unsure.' },
      { id: 'c2', text: 'The technician explained how to reset the device step by step.', tip: 'Pause lightly at the commas; march through the steps evenly.' },
      { id: 'c3', text: 'Please let me know if you experience any issues with the login process.', tip: 'Polite + clear: this is a helpdesk sentence, sound helpful.' },
      { id: 'c4', text: 'Our manager approved the revised schedule for the upcoming product launch.', tip: '“Revised schedule” and “product launch” carry the news — give them weight.' },
      { id: 'c5', text: 'Customers appreciate quick responses and honest updates about delays.', tip: 'Two promises in one line — deliver both with equal warmth.' },
      { id: 'c6', text: 'The new trainee completed all three modules before joining the support floor.', tip: 'Numbers first, then the journey: three modules, then the floor.' },
    ],
    part_d: [
      { id: 'd1', text: 'I left my keys at home so I had to wait outside.' },
      { id: 'd2', text: 'I am running a little behind because the bus was delayed.' },
      { id: 'd3', text: 'Taking short breaks can help improve your focus.' },
      { id: 'd4', text: 'She booked a window seat for the morning flight to Delhi.' },
      { id: 'd5', text: 'Please switch off your mobile phones during the meeting.' },
      { id: 'd6', text: 'My neighbour waters the plants every single evening.' },
    ],
    part_e: [
      { id: 'e1', topic: 'How would you describe a playground full of children?', prepSec: 30, speakSec: 60 },
      { id: 'e2', topic: 'Who is your role model, and why do they inspire you?', prepSec: 30, speakSec: 60 },
      { id: 'e3', topic: 'Describe a difficult customer situation and how you would handle it calmly.', prepSec: 30, speakSec: 60 },
      { id: 'e4', topic: 'What does good teamwork look like in a customer support team?', prepSec: 30, speakSec: 60 },
    ],
    part_f: [
      { id: 'f1', audio: 'She promised to dash the book before the weekend.', missing: ['return'], full: 'She promised to return the book before the weekend.' },
      { id: 'f2', audio: 'Let us try that new café dash the train station tomorrow.', missing: ['near', 'by'], full: 'Let us try that new café near the train station tomorrow.' },
      { id: 'f3', audio: 'The manager asked everyone to dash the feedback form by Friday.', missing: ['submit', 'fill'], full: 'The manager asked everyone to submit the feedback form by Friday.' },
      { id: 'f4', audio: 'Please dash your seatbelts before the flight takes off.', missing: ['fasten'], full: 'Please fasten your seatbelts before the flight takes off.' },
      { id: 'f5', audio: 'He forgot his umbrella, so he had to dash back home.', missing: ['rush', 'run', 'go'], full: 'He forgot his umbrella, so he had to rush back home.' },
    ],
    part_g: [
      { id: 'g1', audio: 'Can you please arrange a follow-up calls with the manager?', corrected: 'Can you please arrange a follow-up call with the manager.', rule: '“A” is singular — the noun must be singular too: a call, not calls.' },
      { id: 'g2', audio: 'The team is reviewing the feedback before make changes.', corrected: 'The team is reviewing the feedback before making changes.', rule: 'After a preposition (“before”), the verb takes -ing: making.' },
      { id: 'g3', audio: 'I am met the new intern outside the reception area.', corrected: 'I met the new intern outside the reception area.', rule: 'Simple past needs no helper: “I met”, not “I am met”.' },
      { id: 'g4', audio: 'She don’t like working the night shift on weekends.', corrected: 'She doesn’t like working the night shift on weekends.', rule: 'Third-person singular takes “doesn’t”, not “don’t”.' },
      { id: 'g5', audio: 'The informations on the portal are updated every hour.', corrected: 'The information on the portal is updated every hour.', rule: '“Information” is uncountable — no plural, and it takes “is”.' },
    ],
  },
};

const MKEY = 'amcat_mock';
export function listMockSessions(): MockSession[] {
  try {
    return JSON.parse(localStorage.getItem(MKEY) || '[]');
  } catch {
    return [];
  }
}

export function saveMockSession(s: MockSession): MockSession[] {
  const arr = [s, ...listMockSessions()].slice(0, 50);
  try {
    localStorage.setItem(MKEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
  return arr;
}

export function deleteMockSession(id: string): MockSession[] {
  const arr = listMockSessions().filter((s) => s.id !== id);
  try {
    localStorage.setItem(MKEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
  return arr;
}

// ---------- one-interview-per-day lock (PAYWALL HOOK: swap this gate for tier checks later) ----------
// Free tier: 1 completion per user per day. Cloud row is the source of truth
// (survives devices); localStorage mirror covers offline + instant checks.

import { apiToken } from '../lib/store';
import { sb } from '../lib/supabase';

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const LKEY = 'amcat_mock_done';

export function getLastCompletion(userId: string | null): string {
  try {
    const o = JSON.parse(localStorage.getItem(LKEY) || '{}');
    return (userId && o[userId]) || '';
  } catch {
    return '';
  }
}

export function setLastCompletion(userId: string | null) {
  if (!userId) return;
  try {
    const o = JSON.parse(localStorage.getItem(LKEY) || '{}');
    o[userId] = todayKey();
    localStorage.setItem(LKEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

export async function fetchTodayRun(userId: string | null): Promise<boolean> {
  try {
    if (!userId) return false;
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return false;
    const { data } = await db.from('mock_runs').select('id').eq('user_id', userId).eq('day', todayKey()).limit(1);
    return !!data?.length;
  } catch {
    return false;
  }
}

export async function recordRun(userId: string | null, answers: number, durationSec: number): Promise<void> {
  setLastCompletion(userId);
  try {
    if (!userId) return;
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return;
    await db.from('mock_runs').insert({
      id: `${userId.slice(-6)}-${Date.now().toString(36)}`,
      user_id: userId,
      day: todayKey(),
      answers,
      duration_sec: durationSec,
    });
  } catch {
    /* duplicate or offline — the local lock still holds */
  }
}
