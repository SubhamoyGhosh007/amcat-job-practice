import { groqChat, groqConfigured, groqModelsFor } from './groq';
import { geminiViaProxy, ttsConfigured } from './tts';
import { extractJson } from './generator';

const GEMINI_KEY = String(import.meta.env.VITE_GEMINI_API_KEY || '');
const GEMINI_MODEL = String(import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash');

export interface VoiceSample {
  id: string;
  kind: 'read' | 'repeat';
  text: string;
  tip?: string;
}

/** AI-written speaking material. Small, fast, original — never bank paraphrase. */
export async function generateVoiceBatch(
  kind: 'read' | 'repeat',
  count: number
): Promise<Omit<VoiceSample, 'id'>[]> {
  const seed = Math.floor(Math.random() * 1_000_000);
  const brief =
    kind === 'read'
      ? `Write ${count} original read-aloud sentences (12–20 words each) for Concentrix customer-support voice screening: helpdesk promises, schedule updates, polite requests. Varied vocabulary, no clichés.`
      : `Write ${count} original short sentences (8–14 words each) for a repeat-after-me speaking test: everyday workplace lines a trainee must echo verbatim. Simple words, exact meaning must survive hearing once.`;
  const prompt =
    `Fresh seed ${seed}. ${brief}\n` +
    `Each item also gets a one-line coach tip (delivery advice for that exact sentence).\n` +
    `Return ONLY a JSON object: {"items":[{"text":"...","tip":"..."}]} — exactly ${count} items, no markdown fences, no extra text.`;
  const parsed = await generateVoiceJson(prompt);
  const list: any[] = Array.isArray(parsed) ? parsed : parsed?.items;
  if (!Array.isArray(list)) throw new Error('AI returned no voice items');
  const out: Omit<VoiceSample, 'id'>[] = [];
  for (const it of list) {
    const text = String(it?.text || '').trim();
    if (text.length < 20 || text.length > 600) continue;
    out.push({
      kind,
      text: text.slice(0, 600),
      tip: String(it?.tip || '').slice(0, 300) || undefined,
    });
    if (out.length >= count) break;
  }
  if (!out.length) throw new Error('AI returned no usable voice items');
  return out;
}

async function generateVoiceJson(prompt: string): Promise<any> {
  const user = prompt + '\n\nReply with valid JSON only.';
  // Groq rotation first (first 200 wins across tier models).
  if (groqConfigured()) {
    let lastErr = 'No Groq model answered';
    for (const model of groqModelsFor()) {
      try {
        const text = await groqChat(
          model,
          'You are a SVAR speaking-test setter. Always reply with valid JSON only.',
          user,
          2500
        );
        return extractJson(text);
      } catch (e: any) {
        lastErr = `Groq (${model}): ${e?.message || e}`;
        continue;
      }
    }
    throw new Error(lastErr);
  }
  // Gemini via self-hosted proxy (key never touches the browser).
  if (ttsConfigured() || GEMINI_KEY) {
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 2500, responseMimeType: 'application/json' },
    };
    if (ttsConfigured()) {
      const data = await geminiViaProxy(GEMINI_MODEL, body.contents, body.generationConfig);
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
      if (!text) throw new Error('Empty Gemini response');
      return extractJson(text);
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    if (!text) throw new Error('Empty Gemini response');
    return extractJson(text);
  }
  throw new Error('No AI configured for voice samples');
}
