import { useSession } from '../stores/session';

/**
 * Groq (OpenAI-compatible, generous free tier) — tried before Gemini so the
 * Google quota lasts. Model choice is entirely backend: each tier gets an
 * ordered rotation, first 200 wins. Dead IDs (404) and exhausted models (429)
 * just fall through to the next — the user never picks, never sees names.
 * Key lives in VITE_GROQ_API_KEY (same handling as the existing Zen key).
 */
export const GROQ_FREE_MODELS = ['llama-3.1-8b-instant', 'openai/gpt-oss-120b'];
export const GROQ_PRO_MODELS = [
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'moonshotai/kimi-k2-instruct',
  'llama-3.1-8b-instant',
];

const GROQ_KEY = String(import.meta.env.VITE_GROQ_API_KEY || '');

export function groqConfigured(): boolean {
  return Boolean(GROQ_KEY);
}

/** Ordered rotation for this user: free gets the light pair, pro the heavies first. */
export function groqModelsFor(): string[] {
  try {
    const tier = useSession.getState().profile?.tier ?? 'free';
    return [...(tier === 'pro' ? GROQ_PRO_MODELS : GROQ_FREE_MODELS)];
  } catch {
    return [...GROQ_FREE_MODELS];
  }
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
