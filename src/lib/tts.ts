// Piper TTS client (self-hosted voice server on the VPS).
// Configure with VITE_TTS_URL (+VITE_TTS_TOKEN). Responses are cached per
// sentence so repeats are instant and the server barely notices.
import { useSession } from '../stores/session';

const TTS_URL = String(import.meta.env.VITE_TTS_URL || '').replace(/\/+$/, '');
const TTS_TOKEN = String(import.meta.env.VITE_TTS_TOKEN || '');

export function ttsConfigured(): boolean {
  return Boolean(TTS_URL);
}

const cache = new Map<string, string>();

/**
 * Stable per-user id for the VPS sliding-window limiter (X-User-Id header).
 * Logged-in users send their user_id; guests send a persisted random id so
 * one guest can't burn the shared IP bucket for everyone behind the IP.
 */
function callerId(): string {
  try {
    const uid = useSession.getState().userId;
    if (uid) return uid;
    let g = localStorage.getItem('amcat_guest');
    if (!g) {
      g = `guest-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('amcat_guest', g);
    }
    return g;
  } catch {
    return 'guest-unknown';
  }
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(TTS_TOKEN ? { 'X-TTS-Token': TTS_TOKEN } : {}),
    'X-User-Id': callerId(),
  };
}

function evict() {
  if (cache.size <= 60) return;
  const first = cache.keys().next().value as string | undefined;
  if (first) {
    const url = cache.get(first);
    if (url) URL.revokeObjectURL(url);
    cache.delete(first);
  }
}

/** Speak text → object URL of WAV audio. Throws with status on failure. */
export async function speak(text: string, opts?: { voice?: string }): Promise<string> {
  const key = text.trim().slice(0, 3000);
  if (!key) throw new Error('Nothing to speak.');
  const voice = (opts?.voice || '').trim().toLowerCase();
  const cacheKey = `${voice || 'default'}::${key}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const res = await fetch(`${TTS_URL}/speak`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ text: key, ...(voice ? { voice } : {}) }),
  });
  if (!res.ok) throw new Error(`Voice server answered ${res.status}. Check VITE_TTS_URL / token.`);
  const url = URL.createObjectURL(await res.blob());
  cache.set(cacheKey, url);
  evict();
  return url;
}

/** Split a passage into speakable chunks (one request per chunk). */export function chunkText(text: string, max = 700): string[] {
  const parts = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["']?|\S[^.!?]*$/g) || [text];
  const out: string[] = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + ' ' + p).trim().length > max && cur) {
      out.push(cur.trim());
      cur = p;
    } else {
      cur += ' ' + p;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * AI generation through the self-hosted proxy (same VPS box as TTS).
 * The Google key lives only in the server's env — the browser sends just
 * the model + contents + the shared token. Returns Gemini-shaped JSON.
 *
 * Google answers heavy generations with transient 502/503s when overloaded;
 * those retry with backoff. 400s (bad model/shape) and 429s (quota) fail
 * fast — retrying those only burns quota or loops forever.
 */
export async function geminiViaProxy(model: string, contents: unknown, generationConfig?: unknown): Promise<any> {
  const delays = [0, 4000, 10000];
  let lastErr = '';
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, delays[attempt]));
    const res = await fetch(`${TTS_URL}/gemini`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ model, contents, generationConfig }),
    });
    if (res.status === 429) throw new Error('AI is busy — too many requests, try again in a minute.');
    if (res.ok) return res.json();
    // The sidecar names the real cause in the body ("AI upstream 429" etc.) —
    // surface it so the console says WHY, not just 502.
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      /* ignore */
    }
    lastErr = `AI proxy HTTP ${res.status}${detail ? `: ${detail}` : ''}`;
    if (res.status === 502 || res.status === 503) continue;
    throw new Error(lastErr);
  }
  throw new Error(lastErr);
}
