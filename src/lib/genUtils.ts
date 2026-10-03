/** Shared generation utilities. Single home — never copy-paste per file. */

export const uid = () => Math.random().toString(36).slice(2, 9);

export const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const AVOID_KEY = 'amcat_avoid';

export function recentAvoid(): string[] {
  try {
    return JSON.parse(localStorage.getItem(AVOID_KEY) || '[]');
  } catch {
    return [];
  }
}

export function rememberAvoid(qs: { prompt: string }[]) {
  try {
    const prev: string[] = recentAvoid();
    const topics = qs.map((q) => q.prompt.slice(0, 80));
    localStorage.setItem(AVOID_KEY, JSON.stringify([...topics, ...prev].slice(0, 60)));
  } catch {
    /* ignore */
  }
}

/** String-aware bracket matcher: finds where the JSON value starting at s[0] ends. */
function findJsonEnd(s: string): number {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Canonical JSON extractor (single home — import, don't duplicate).
 * The old lastIndexOf approach broke when a trailing brace lived inside a
 * string or when prose followed the JSON; this scans with string awareness.
 */
export function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.search(/[{[]/);
  if (start < 0) throw new Error('AI returned no JSON');
  const slice = raw.slice(start);
  const end = findJsonEnd(slice);
  if (end < 0) throw new Error('AI returned truncated JSON');
  return JSON.parse(slice.slice(0, end + 1));
}
