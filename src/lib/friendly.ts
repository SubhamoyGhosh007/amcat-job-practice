/** Human words for set origins — raw ids like "ai-gemini" never reach the UI. */
export function sourceLabel(source: string, origin: string): string {
  if (origin === 'pyq') return 'Previous-year set';
  if (origin === 'shared' || source === 'shared-bank') return 'Shared practice set';
  if (source === 'offline-bank' || origin === 'offline') return 'Practice bank set';
  return 'Fresh AI set';
}
