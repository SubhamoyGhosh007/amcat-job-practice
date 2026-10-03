import { useSession } from '../stores/session';

/**
 * Groq (OpenAI-compatible, generous free tier) — tried before Gemini so the
 * Google quota lasts. Model depends on tier:
 * - free: llama-3.1-8b-instant (fast, cheap, always available)
 * - pro: the user's picked heavyweight (stored pick, see GROQ_PRO_MODELS)
 * Key lives in VITE_GROQ_API_KEY (same handling as the existing Zen key).
 */
export const GROQ_FREE_MODEL = 'llama-3.1-8b-instant';
export const GROQ_PRO_MODELS = [
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'moonshotai/kimi-k2-instruct',
] as const;

const GROQ_KEY = String(import.meta.env.VITE_GROQ_API_KEY || '');
const GROQ_PICK_KEY = 'amcat_groq_model';

export function groqConfigured(): boolean {
  return Boolean(GROQ_KEY);
}

export function groqProPick(): string {
  try {
    const v = localStorage.getItem(GROQ_PICK_KEY) || '';
    if ((GROQ_PRO_MODELS as readonly string[]).includes(v)) return v;
  } catch {
    /* ignore */
  }
  return GROQ_PRO_MODELS[0];
}

export function setGroqProPick(m: string) {
  try {
    if ((GROQ_PRO_MODELS as readonly string[]).includes(m)) localStorage.setItem(GROQ_PICK_KEY, m);
  } catch {
    /* ignore */
  }
}

/** Which Groq model this user gets: fixed 8b for free, picked heavyweight for pro. */
export function groqModelFor(): string {
  try {
    const tier = useSession.getState().profile?.tier ?? 'free';
    if (tier === 'pro') return groqProPick();
  } catch {
    /* ignore */
  }
  return GROQ_FREE_MODEL;
}

export async function groqChat(model: string, system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (res.status === 429) throw new Error('Groq rate limited (429)');
  if (!res.ok) throw new Error(`Groq HTTP ${res.status} (${model})`);
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Empty Groq response');
  if (/decommissioned|model_not_found|does not exist/i.test(text)) throw new Error(`Groq retired model (${model})`);
  return text;
}
