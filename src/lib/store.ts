import type { ExamSet, Question } from '../types';
import { isDbConfigured, sb } from './supabase';

export interface Profile {
  userId: string;
  email: string;
  username: string;
  avatarId: number;
}

export interface ScoreSheet {
  id: string;
  userId: string;
  email: string;
  username: string;
  setId: string;
  source: string;
  difficulty: string;
  origin: string;
  createdAt: number;
  total: number;
  correct: number;
  pct: number;
  sections: Record<string, { c: number; t: number; name: string }>;
  answers: Record<string, number>;
  questions: Question[];
}

export interface Owner {
  userId: string;
  email: string;
  username: string;
}

// Clerk session JWT supplier, wired up by AuthContext (getToken()).
let tokenProvider: () => Promise<string | null> = async () => null;
export function setTokenProvider(fn: () => Promise<string | null>) {
  tokenProvider = fn;
}
/** Current Clerk session token (null when logged out). Shared by all cloud stores. */
export async function apiToken(): Promise<string | null> {
  try {
    return await tokenProvider();
  } catch {
    return null;
  }
}

// ---------- profiles ----------

const localProfile = (userId: string): Profile | null => {
  try {
    const raw = localStorage.getItem(`amcat_profile_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const token = await tokenProvider();
  const db = sb(token);
  if (db && token) {
    const { data, error } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!error && data) {
      const p: Profile = { userId, email: data.email, username: data.username, avatarId: data.avatar_id ?? 0 };
      localStorage.setItem(`amcat_profile_${userId}`, JSON.stringify(p));
      return p;
    }
  }
  return localProfile(userId);
}

/** Global uniqueness check for usernames (case-insensitive). */
export async function isUsernameTaken(username: string, exceptUserId?: string): Promise<boolean> {
  const uname = username.trim().toLowerCase();
  const token = await tokenProvider();
  const db = sb(token);
  if (db && token) {
    const { data } = await db.from('profiles').select('id').eq('username_lower', uname).limit(2);
    return (data || []).some((d: any) => d.id !== exceptUserId);
  }
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('amcat_profile_'));
    return keys.some((k) => {
      if (exceptUserId && k === `amcat_profile_${exceptUserId}`) return false;
      try {
        return String(JSON.parse(localStorage.getItem(k) || '{}').username || '').toLowerCase() === uname;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function validUsername(u: string): string {
  const t = u.trim();
  if (t.length < 3 || t.length > 20) return 'Username must be 3–20 characters.';
  if (!/^[A-Za-z0-9_]+$/.test(t)) return 'Only letters, numbers and underscore.';
  return '';
}

export async function saveProfile(p: Profile): Promise<'cloud' | 'local'> {
  localStorage.setItem(`amcat_profile_${p.userId}`, JSON.stringify(p));
  const token = await tokenProvider();
  const db = sb(token);
  if (db && token) {
    const { error } = await db.from('profiles').upsert(
      {
        id: p.userId,
        email: p.email,
        username: p.username,
        username_lower: p.username.toLowerCase(),
        avatar_id: p.avatarId,
      },
      { onConflict: 'id' }
    );
    if (error) {
      console.warn('Cloud profile save failed (kept locally):', error.message);
      return 'local';
    }
    return 'cloud';
  }
  return 'local';
}

// ---------- score sheets ----------

function localSheets(): ScoreSheet[] {
  try {
    return JSON.parse(localStorage.getItem('amcat_sheets') || '[]');
  } catch {
    return [];
  }
}

/**
  * Clerk already merges Google/GitHub logins that share a verified
 * email into ONE user id, so history is keyed on user_id alone.
 */
export async function saveScoreSheet(s: ScoreSheet): Promise<void> {
  const arr = [s, ...localSheets()].slice(0, 100);
  localStorage.setItem('amcat_sheets', JSON.stringify(arr));
  const token = await tokenProvider();
  const db = sb(token);
  if (db && token) {
    const { error } = await db.from('sheets').insert({
      id: s.id,
      user_id: s.userId,
      email: s.email,
      username: s.username,
      set_id: s.setId,
      source: s.source,
      difficulty: s.difficulty,
      origin: s.origin,
      total: s.total,
      correct: s.correct,
      pct: s.pct,
      sections: s.sections,
      answers: s.answers,
      questions: s.questions,
    });
    if (error) console.warn('Cloud save failed (kept locally):', error.message);
  }
}

export async function listScoreSheets(owner: Owner | null): Promise<ScoreSheet[]> {
  const local = localSheets();
  const token = await tokenProvider();
  const db = sb(token);
  if (!db || !token || !owner) {
    return owner ? local.filter((s) => s.userId === owner.userId) : local;
  }
  const { data, error } = await db
    .from('sheets')
    .select('*')
    .eq('user_id', owner.userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    console.warn('Cloud list failed (local only):', error.message);
    return local.filter((s) => s.userId === owner.userId);
  }
  const cloud: ScoreSheet[] = (data || []).map((d: any) => ({
    id: d.id,
    userId: d.user_id,
    email: d.email,
    username: d.username,
    setId: d.set_id,
    source: d.source,
    difficulty: d.difficulty || 'medium',
    origin: d.origin || 'offline',
    createdAt: new Date(d.created_at).getTime(),
    total: d.total,
    correct: d.correct,
    pct: d.pct,
    sections: d.sections || {},
    answers: d.answers || {},
    questions: d.questions || [],
  }));
  const seen = new Set(cloud.map((c) => `${c.setId}:${c.createdAt}`));
  const onlyLocal = local.filter((s) => !seen.has(`${s.setId}:${s.createdAt}`));
  return [...cloud, ...onlyLocal].slice(0, 100);
}

export async function deleteScoreSheet(sheet: ScoreSheet): Promise<void> {
  localStorage.setItem('amcat_sheets', JSON.stringify(localSheets().filter((s) => s.id !== sheet.id)));
  const token = await tokenProvider();
  const db = sb(token);
  if (db && token) {
    await db.from('sheets').delete().eq('id', sheet.id);
  }
}

export function sheetFromExam(owner: Owner, set: ExamSet, answers: Record<string, number>): ScoreSheet {
  const correct = set.questions.filter((q) => answers[q.id] === q.answerIndex).length;
  const sections: ScoreSheet['sections'] = {};
  for (const q of set.questions) {
    const s = (sections[q.section] ||= { c: 0, t: 0, name: q.section });
    s.t += 1;
    if (answers[q.id] === q.answerIndex) s.c += 1;
  }
  return {
    id: `${set.id}-${Date.now()}`,
    userId: owner.userId,
    email: owner.email,
    username: owner.username,
    setId: set.id,
    source: set.source,
    difficulty: set.difficulty || 'medium',
    origin: set.origin || 'offline',
    createdAt: Date.now(),
    total: set.questions.length,
    correct,
    pct: Math.round((correct / set.questions.length) * 100),
    sections,
    answers,
    questions: set.questions,
  };
}
