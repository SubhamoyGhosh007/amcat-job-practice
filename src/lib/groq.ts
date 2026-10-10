import { useSession } from '../stores/session';

/**
 * Groq (OpenAI-compatible, generous free tier) — tried before Gemini so the
 * Google quota lasts. Model choice is entirely backend: currently only
 * `openai/gpt-oss-120b` answers on this account, so both tiers use it.
 * The rotation machinery stays: if it ever 404s/429s, add the replacement ID
 * to the list and the first 200 wins again. The user never picks, never sees names.
 * Key lives in VITE_GROQ_API_KEY (same handling as the existing Zen key).
 */
export const GROQ_FREE_MODELS = ['openai/gpt-oss-120b'];
export const GROQ_PRO_MODELS = ['openai/gpt-oss-120b'];

const GROQ_KEY = String(import.meta.env.VITE_GROQ_API_KEY || '');

export function groqConfigured(): boolean {
  return Boolean(GROQ_KEY);
}

/** Ordered rotation for this user: free gets the light pair, pro the heavies first. */
export function groqModelsFor(): string[] {
  try {
    const tier = useSession.getState().profile?.tier ?? 'free';
    return [...(tier === 'free' ? GROQ_FREE_MODELS : GROQ_PRO_MODELS)];
  } catch {
    return [...GROQ_FREE_MODELS];
  }
}

export async function groqChat(model: string, system: string, user: string, maxTokens: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model,
        temperature: 0.7,
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
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error(`Groq request timed out (12s) for ${model}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
