// 16 built-in avatar choices (gradient + glyph, zero assets, works offline).
export interface Avatar {
  id: number;
  bg: string;
  glyph: string;
  label: string;
}

export const AVATARS: Avatar[] = [
  { id: 0, bg: 'linear-gradient(135deg,#6366f1,#8b5cf6)', glyph: '🦊', label: 'Fox' },
  { id: 1, bg: 'linear-gradient(135deg,#0ea5e9,#22d3ee)', glyph: '🐬', label: 'Dolphin' },
  { id: 2, bg: 'linear-gradient(135deg,#f59e0b,#ef4444)', glyph: '🦁', label: 'Lion' },
  { id: 3, bg: 'linear-gradient(135deg,#10b981,#84cc16)', glyph: '🐸', label: 'Frog' },
  { id: 4, bg: 'linear-gradient(135deg,#ec4899,#f43f5e)', glyph: '🦄', label: 'Unicorn' },
  { id: 5, bg: 'linear-gradient(135deg,#8b5cf6,#d946ef)', glyph: '🐼', label: 'Panda' },
  { id: 6, bg: 'linear-gradient(135deg,#f97316,#facc15)', glyph: '🐯', label: 'Tiger' },
  { id: 7, bg: 'linear-gradient(135deg,#14b8a6,#3b82f6)', glyph: '🐢', label: 'Turtle' },
  { id: 8, bg: 'linear-gradient(135deg,#ef4444,#f97316)', glyph: '🦅', label: 'Eagle' },
  { id: 9, bg: 'linear-gradient(135deg,#3b82f6,#6366f1)', glyph: '🐧', label: 'Penguin' },
  { id: 10, bg: 'linear-gradient(135deg,#a855f7,#ec4899)', glyph: '🐰', label: 'Bunny' },
  { id: 11, bg: 'linear-gradient(135deg,#22c55e,#14b8a6)', glyph: '🦉', label: 'Owl' },
  { id: 12, bg: 'linear-gradient(135deg,#eab308,#22c55e)', glyph: '🐝', label: 'Bee' },
  { id: 13, bg: 'linear-gradient(135deg,#64748b,#334155)', glyph: '🐺', label: 'Wolf' },
  { id: 14, bg: 'linear-gradient(135deg,#f43f5e,#fb923c)', glyph: '🦋', label: 'Butterfly' },
  { id: 15, bg: 'linear-gradient(135deg,#06b6d4,#6366f1)', glyph: '🐙', label: 'Octopus' },
];

export function avatarById(id: number): Avatar {
  return AVATARS[((id % AVATARS.length) + AVATARS.length) % AVATARS.length];
}
