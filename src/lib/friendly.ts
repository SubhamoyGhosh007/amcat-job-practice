/** Human words for set origins — raw ids like "ai-gemini" never reach the UI. */
export function sourceLabel(source: string, origin: string): string {
  if (origin === 'pyq') return 'Previous-year set';
  if (origin === 'shared' || source === 'shared-bank') return 'Shared practice set';
  if (source === 'offline-bank' || origin === 'offline') return 'Practice bank set';
  return 'Fresh AI set';
}

/**
 * Every user-visible error goes through here. Never show raw error.message,
 * Supabase codes, table names, model IDs, SQL, or stack traces in the UI.
 */
export function friendlyError(e: unknown): string {
  const m = String((e as any)?.message ?? e ?? '');
  if (/quota|429|rate limit|too many requests/i.test(m))
    return 'Daily AI limit reached — fresh sets resume tomorrow. Saved sessions and PDFs still work.';
  if (/Failed to fetch|NetworkError|network|offline|ERR_FAILED|unreachable|timeout/i.test(m))
    return 'No connection right now — check your internet and retry. Offline practice still works.';
  if (/session expired|expired|invalid.*token|unauthorized|401/i.test(m))
    return 'Your login expired — sign out and back in, then retry.';
  if (/camera|webcam|video.*permission|NotAllowedError.*video/i.test(m))
    return 'Camera is blocked — allow camera access in the browser and retry.';
  if (/microphone|mic.*blocked|NotAllowedError.*audio|allow mic/i.test(m))
    return 'Microphone is blocked — allow mic access in the browser and retry.';
  if (/model not allowed|AI upstream 4\d\d|Gemini HTTP 4\d\d|Groq HTTP 4\d\d/i.test(m))
    return 'The AI writer stumbled on its configuration — retry in a minute.';
  if (/AI returned|incomplete|Empty .* response/i.test(m))
    return 'The AI writer returned a half-made set — retry once for a fresh one.';
  return 'Something hiccuped on our side — retry in a minute.';
}
