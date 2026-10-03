// Piper TTS client (self-hosted voice server on the VPS).
// Configure with VITE_TTS_URL (+VITE_TTS_TOKEN). Responses are cached per
// sentence so repeats are instant and the server barely notices.

const TTS_URL = String(import.meta.env.VITE_TTS_URL || '').replace(/\/+$/, '');
const TTS_TOKEN = String(import.meta.env.VITE_TTS_TOKEN || '');

export function ttsConfigured(): boolean {
  return Boolean(TTS_URL);
}

const cache = new Map<string, string>();

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
    headers: {
      'Content-Type': 'application/json',
      ...(TTS_TOKEN ? { 'X-TTS-Token': TTS_TOKEN } : {}),
    },
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
 */
export async function geminiViaProxy(model: string, contents: unknown, generationConfig?: unknown): Promise<any> {
  const res = await fetch(`${TTS_URL}/gemini`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(TTS_TOKEN ? { 'X-TTS-Token': TTS_TOKEN } : {}),
    },
    body: JSON.stringify({ model, contents, generationConfig }),
  });
  if (res.status === 429) throw new Error('AI is busy — too many requests, try again in a minute.');
  if (!res.ok) {
    // The sidecar names the real cause in the body ("AI upstream 429" etc.) —
    // surface it so the console says WHY, not just 502.
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      /* ignore */
    }
    throw new Error(`AI proxy HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
}
