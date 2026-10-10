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
  /** Which test paper was used (pool id or static id). */
  testId?: string;
  /** Extempore marks graded after the run (best-effort, may be absent). */
  grades?: { label: string; marks: number }[];
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

export const MOCK_TEST_02: MockTest = {
  test_id: 'concentrix_amcat_mock_02',
  sections: {
    part_a: [
      {
        id: 'a1_m2',
        context: 'Your name is Ravi. This morning you missed the bus, so you borrowed your neighbor’s bicycle. On the way to work, the tire burst. A local shopkeeper helped you fix it. You reached the office ten minutes late, apologized to your manager, and promised to leave earlier tomorrow.',
        questions: [
          { q: 'Why did Ravi borrow his neighbor’s bicycle?', expected: 'He borrowed it because he missed the morning bus.' },
          { q: 'What happened on his way to work?', expected: 'The tire burst, and a local shopkeeper helped him fix it.' },
          { q: 'What did Ravi tell his manager?', expected: 'He apologized for being ten minutes late and promised to leave earlier tomorrow.' },
        ],
      },
      {
        id: 'a2_m2',
        context: 'Your name is Anita. You recently completed your B.Com degree and joined Concentrix as a customer service associate. Your training runs from Monday to Friday, and your supervisor’s name is Mr. Sharma.',
        questions: [
          { q: 'What degree did Anita complete?', expected: 'She completed her B.Com degree.' },
          { q: 'What role did she join at Concentrix?', expected: 'She joined as a customer service associate.' },
          { q: 'Who is her supervisor?', expected: 'Her supervisor is Mr. Sharma.' },
        ],
      },
    ],
    part_b: [
      {
        id: 'b1_m2',
        context: 'Your name is Meena. You ordered a special gift for your mother’s birthday, but the courier delivered it to the wrong address. You contacted customer support right away. The agent apologized, confirmed the correct address, and arranged for the proper parcel to arrive the next day along with a discount coupon. You thanked the agent for the quick assistance.',
        questions: [
          { q: 'Why did Meena order a gift?', expected: 'She ordered a gift for her mother’s birthday.' },
          { q: 'What was the problem with the delivery?', expected: 'The courier delivered the parcel to the wrong address.' },
          { q: 'How did the agent resolve the issue?', expected: 'The agent arranged for the correct parcel to arrive the next day with a discount coupon.' },
        ],
      },
      {
        id: 'b2_m2',
        context: 'Arjun works at a travel desk in Pune. Every morning he checks customer emails and processes ticket updates. Yesterday, a passenger called to reschedule her flight booking. Arjun verified the schedule, explained the minor fare difference, and completed the revised ticket within ten minutes.',
        questions: [
          { q: 'Where does Arjun work?', expected: 'He works at a travel desk in Pune.' },
          { q: 'Why did the passenger call yesterday?', expected: 'The passenger called to reschedule her flight booking.' },
          { q: 'How long did it take Arjun to update the ticket?', expected: 'It took him ten minutes.' },
        ],
      },
    ],
    part_c: [
      { id: 'c1_m2', text: 'Thank you for calling customer support. How may I assist you today?', tip: 'A warm, upbeat opening greeting sets the tone for the entire interaction.' },
      { id: 'c2_m2', text: 'I understand your concern, and I will do my best to resolve this as quickly as possible.', tip: 'Pace your empathy statement calmly without rushing.' },
      { id: 'c3_m2', text: 'The supervisor confirmed that the new training session will begin on Monday morning.', tip: 'Pronounce word endings clearly (-ed in confirmed, -ing in training).' },
      { id: 'c4_m2', text: 'Our customer service team is available from nine in the morning to six in the evening.', tip: 'Maintain a steady, measured pace across the numbers.' },
      { id: 'c5_m2', text: 'Could you please confirm your registered email address and phone number for verification?', tip: 'Keep the tone courteous and respectful during account verification.' },
      { id: 'c6_m2', text: 'The weather has been unpredictable this week, so several regional flights were delayed.', tip: 'Emphasize key operational terms: unpredictable, regional flights, delayed.' },
    ],
    part_d: [
      { id: 'd1_m2', text: 'The class starts at nine o\'clock.' },
      { id: 'd2_m2', text: 'Could you please send me the details by this evening?' },
      { id: 'd3_m2', text: 'The customer has requested a refund for the damaged product.' },
      { id: 'd4_m2', text: 'Although it was raining heavily, the team completed the delivery on time.' },
      { id: 'd5_m2', text: 'We will review your application and get back to you within three working days.' },
      { id: 'd6_m2', text: 'Please hold the line while I check your account details.' },
    ],
    part_e: [
      { id: 'e1_m2', topic: 'Why is punctuality important in a customer service role?', prepSec: 30, speakSec: 60 },
      { id: 'e2_m2', topic: 'How do you handle a customer who is shouting and demanding an immediate refund?', prepSec: 30, speakSec: 60 },
      { id: 'e3_m2', topic: 'Explain the difference between working from home and working from an office.', prepSec: 30, speakSec: 60 },
      { id: 'e4_m2', topic: 'Describe a challenge you faced during your college or project work and how you handled it.', prepSec: 30, speakSec: 60 },
    ],
    part_f: [
      { id: 'f1_m2', audio: 'She dash working here since twenty twenty-two.', missing: ['has been'], full: 'She has been working here since 2022.' },
      { id: 'f2_m2', audio: 'Neither of the answers dash correct.', missing: ['is'], full: 'Neither of the answers is correct.' },
      { id: 'f3_m2', audio: 'I look forward to dash you tomorrow.', missing: ['meeting'], full: 'I look forward to meeting you tomorrow.' },
      { id: 'f4_m2', audio: 'He apologised dash being late for the team meeting.', missing: ['for'], full: 'He apologised for being late for the team meeting.' },
      { id: 'f5_m2', audio: 'If it rains tomorrow, we dash cancel the outdoor session.', missing: ['will'], full: 'If it rains tomorrow, we will cancel the outdoor session.' },
    ],
    part_g: [
      { id: 'g1_m2', audio: 'I am having a doubt regarding the escalation process.', corrected: 'I have a doubt regarding the escalation process.', rule: 'Stative verbs like “have” indicating possession or state do not take continuous -ing: “I have a doubt”.' },
      { id: 'g2_m2', audio: 'Please return back the borrowed training files by Friday.', corrected: 'Please return the borrowed training files by Friday.', rule: '“Return” already incorporates “back”; saying “return back” is a redundant repetition.' },
      { id: 'g3_m2', audio: 'Neither of the two candidates were present for the briefing.', corrected: 'Neither of the two candidates was present for the briefing.', rule: '“Neither” is singular and always takes a singular verb: was, not were.' },
      { id: 'g4_m2', audio: 'The supervisor gave me an advice on ticket prioritisation.', corrected: 'The supervisor gave me advice on ticket prioritisation.', rule: '“Advice” is uncountable — never say “an advice”; use “advice” or “a piece of advice”.' },
      { id: 'g5_m2', audio: 'Can we prepone the review to tomorrow morning?', corrected: 'Can we reschedule the review to tomorrow morning?', rule: '“Prepone” is informal; professional business English uses “reschedule to an earlier time” or “move forward”.' },
    ],
  },
};

export const STATIC_MOCK_TESTS: MockTest[] = [MOCK_TEST_01, MOCK_TEST_02];

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

/** Patch grades onto an already-saved session (background extempore grading). */
export function patchMockGrades(id: string, grades: { label: string; marks: number }[]): MockSession[] {
  const arr = listMockSessions().map((s) => (s.id === id ? { ...s, grades } : s));
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
    const t: Record<string, number> = JSON.parse(localStorage.getItem(MLASTKEY) || '{}');
    t[userId] = Date.now();
    localStorage.setItem(MLASTKEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}

const MLASTKEY = 'amcat_mock_last';

/** Pro window: one mock per 3 hours. Premium: unlimited. Free: calendar day. */
export const MOCK_PRO_WINDOW_MS = 3 * 3600 * 1000;

export interface MockQuota {
  locked: boolean;
  retryInMs: number;
}

function msUntilMidnight(): number {
  const end = new Date();
  end.setHours(24, 0, 0, 0);
  return Math.max(0, end.getTime() - Date.now());
}

async function lastCloudMockAt(userId: string | null): Promise<number> {
  try {
    if (!userId) return 0;
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return 0;
    const { data, error } = await db
      .from('mock_runs')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return 0;
    return new Date(data.created_at).getTime();
  } catch {
    return 0;
  }
}

function lastLocalMockAt(userId: string | null): number {
  try {
    if (!userId) return 0;
    return Number(JSON.parse(localStorage.getItem(MLASTKEY) || '{}')[userId] || 0);
  } catch {
    return 0;
  }
}

export async function mockQuotaStatus(
  userId: string | null,
  tier: 'free' | 'pro' | 'premium' = 'free'
): Promise<MockQuota> {
  if (tier === 'premium') return { locked: false, retryInMs: 0 };
  if (tier === 'pro') {
    const last = Math.max(lastLocalMockAt(userId), await lastCloudMockAt(userId));
    const elapsed = Date.now() - last;
    if (last > 0 && elapsed < MOCK_PRO_WINDOW_MS) {
      return { locked: true, retryInMs: MOCK_PRO_WINDOW_MS - elapsed };
    }
    return { locked: false, retryInMs: 0 };
  }
  if (getLastCompletion(userId) === todayKey()) return { locked: true, retryInMs: msUntilMidnight() };
  const cloud = await fetchTodayRun(userId);
  return cloud ? { locked: true, retryInMs: msUntilMidnight() } : { locked: false, retryInMs: 0 };
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

// ---------- mock test pool (tier-separated, MOCK_TEST_01 fallback) ----------
// mock_tests rows: { id: "<test_id>:<tier>", test_id, tier, sections }.
// mock_test_attempts rows: { user_id, test_id }. Both tables may not exist yet
// (pre-SQL tolerance): every pool call degrades to the static MOCK_TEST_01.

export type MockTier = 'free' | 'pro';

function poolId(testId: string, tier: MockTier): string {
  return `${testId}:${tier}`;
}

/** A pooled test this user hasn't completed, or null (static fallback applies). */
export async function fetchUnattemptedMockTest(userId: string | null, tier: MockTier = 'free'): Promise<MockTest | null> {
  try {
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return null;
    const done = new Set<string>();
    if (userId) {
      const { data, error } = await db.from('mock_test_attempts').select('test_id').eq('user_id', userId);
      if (error) return null;
      for (const d of (data || []) as any[]) done.add(String(d.test_id));
    }
    // Exclusion in JS over a native Set — no `not.in` filter is ever sent.
    const { data, error } = await db.from('mock_tests').select('*').eq('tier', tier).limit(25);
    if (error || !data) return null;
    const row = (data as any[]).find((r) => r?.sections && !done.has(String(r.test_id)));
    if (!row) return null;
    return { test_id: row.test_id, sections: row.sections } as MockTest;
  } catch {
    return null;
  }
}

/** Publish a full mock test to the pool (insert-or-ignore, never throws). */
export async function publishMockTest(test: MockTest, tier: MockTier = 'free'): Promise<void> {
  try {
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return;
    await db.from('mock_tests').upsert(
      { id: poolId(test.test_id, tier), test_id: test.test_id, tier, sections: test.sections },
      { onConflict: 'id', ignoreDuplicates: true }
    );
  } catch {
    /* table missing or offline — static bank still works */
  }
}

/** Record that a user completed a pooled test (best-effort, never throws). */
export async function recordMockAttempt(userId: string | null, testId: string): Promise<void> {
  if (!userId) return;
  try {
    const token = await apiToken();
    const db = sb(token);
    if (!db || !token) return;
    await db.from('mock_test_attempts').insert({ user_id: userId, test_id: testId });
  } catch {
    /* duplicate, missing table, or offline — ignore */
  }
}
