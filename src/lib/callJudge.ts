import { groqChat, groqConfigured, groqModelsFor } from './groq';
import { extractJson } from './generator';

/**
 * Live mock-call engine. The AI roleplays the customer; a separate judge
 * decides when it is satisfied. The LOOP ITSELF is capped client-side
 * (MAX_TURNS + min-turns + miss counting), so no prompt can run forever —
 * even a misbehaving model gets exactly MAX_TURNS replies, then a closing.
 */

export const CALL_MAX_TURNS = 8;
export const CALL_MIN_TURNS = 2;

export interface CallTurn {
  speaker: 'customer' | 'agent';
  text: string;
  coachNote?: string;
}

export interface CallNext {
  customerSay: string;
  satisfied: boolean;
  coachNote: string;
}

const PERSONA = (title: string, brief: string) =>
  `You roleplay an upset Concentrix customer on a support call. Scenario: "${title}" — ${brief}\n` +
  `Stay in character: frustrated but realistic, never abusive, never breaking role. ` +
  `Reply with 1–2 spoken sentences only (no stage directions, no quotes around everything).\n` +
  `Also judge the agent's LAST reply like a strict Concentrix QA analyst.\n` +
  `Set satisfied=true ONLY when the agent BOTH showed empathy AND moved the issue toward a concrete resolution. ` +
  `One-line pleasantries, blame, or asking the customer to solve it themselves are never satisfying.\n` +
  `Return ONLY JSON: {"customerSay":"...","satisfied":true|false,"coachNote":"one short line on the agent's last reply"}.`;

function transcriptText(t: CallTurn[]): string {
  return t.map((x) => `${x.speaker === 'customer' ? 'Customer' : 'Agent'}: ${x.text}`).join('\n');
}

async function llmJson(system: string, user: string, maxTokens: number): Promise<any> {
  if (!groqConfigured()) throw new Error('AI unavailable for live calls.');
  let lastErr = 'No Groq model answered';
  for (const model of groqModelsFor()) {
    try {
      const text = await groqChat(model, system + ' Always reply with valid JSON only.', user + '\n\nReply with valid JSON only.', maxTokens);
      return extractJson(text);
    } catch (e: any) {
      lastErr = String((e as any)?.message || e);
      continue;
    }
  }
  throw new Error(lastErr);
}

/** Next customer line + satisfaction verdict for the agent's last reply. */
export async function nextCustomerTurn(
  title: string,
  brief: string,
  transcript: CallTurn[]
): Promise<CallNext> {
  const g = await llmJson(
    PERSONA(title, brief),
    `Conversation so far:\n${transcriptText(transcript)}`,
    400
  );
  const customerSay = String(g.customerSay || '').trim().slice(0, 400);
  if (!customerSay) throw new Error('Empty customer reply');
  return {
    customerSay,
    satisfied: g.satisfied === true,
    coachNote: String(g.coachNote || '').slice(0, 200),
  };
}

export interface CallGrade {
  marks: number;
  empathy: number;
  resolution: number;
  professionalism: number;
  feedback: string[];
  estimated: boolean;
}

/** Final marks for a finished call. Heuristic fallback when the LLM is down. */
export async function gradeCall(title: string, transcript: CallTurn[]): Promise<CallGrade> {
  const agentLines = transcript.filter((t) => t.speaker === 'agent' && t.text.trim().length > 3);
  try {
    const g = await llmJson(
      `You are a strict Concentrix QA analyst grading a support call. Always reply with valid JSON only.`,
      `Scenario: "${title}"\nFull transcript:\n${transcriptText(transcript)}\n` +
        `Return ONLY JSON: {"empathy":0-10,"resolution":0-10,"professionalism":0-10,` +
        `"feedback":["exactly 3 short actionable lines, each under 20 words"]}`,
      600
    );
    const empathy = Math.max(0, Math.min(10, Math.round(Number(g.empathy) || 0)));
    const resolution = Math.max(0, Math.min(10, Math.round(Number(g.resolution) || 0)));
    const professionalism = Math.max(0, Math.min(10, Math.round(Number(g.professionalism) || 0)));
    return {
      marks: Math.round((empathy + resolution + professionalism) / 3),
      empathy,
      resolution,
      professionalism,
      feedback: Array.isArray(g.feedback) ? g.feedback.map(String).slice(0, 3) : [],
      estimated: false,
    };
  } catch {
    const turns = Math.min(agentLines.length, CALL_MAX_TURNS);
    const marks = Math.max(1, Math.min(8, 3 + Math.round(turns / 2)));
    return {
      marks,
      empathy: marks,
      resolution: marks,
      professionalism: marks,
      feedback: [
        `Completed ${turns} exchanges — longer professional calls score higher.`,
        'AI judge unreachable, so this is an estimated score.',
        'Retry with connection for line-by-line empathy and resolution feedback.',
      ],
      estimated: true,
    };
  }
}

/** Scripted safety net: used when the LLM fails mid-call (never ends the call). */
export function fallbackCustomerLine(misses: number): string {
  return misses > 0
    ? 'Sorry, the line is breaking up. Could you please repeat that slowly?'
    : 'Hmm, I am not sure that answers my problem. What exactly are you going to do about it?';
}
