/** Original geometric SVG icons for the landing — drawn for this project. */
import type { ReactNode } from 'react';

function Base({ children, size = 30 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

export function IconBook({ size }: { size?: number }) {
  return (
    <Base size={size}>
      <path d="M7 5.5A2.5 2.5 0 0 1 9.5 3H24v22.5H9.5A2.5 2.5 0 0 0 7 28V5.5Z" fill="currentColor" opacity="0.9" />
      <path d="M7 5.5A2.5 2.5 0 0 1 9.5 3H24v3H9.5a2.5 2.5 0 0 0-2.5 2.5" fill="#fff" opacity="0.35" />
      <rect x="12" y="9" width="8" height="2.4" rx="1.2" fill="#fff" opacity="0.85" />
      <rect x="12" y="13.5" width="8" height="2.4" rx="1.2" fill="#fff" opacity="0.55" />
      <rect x="12" y="18" width="5.5" height="2.4" rx="1.2" fill="#fff" opacity="0.55" />
    </Base>
  );
}

export function IconCalc({ size }: { size?: number }) {
  return (
    <Base size={size}>
      <rect x="7" y="3" width="18" height="26" rx="3.5" fill="currentColor" opacity="0.9" />
      <rect x="10.5" y="6.5" width="11" height="4.5" rx="1.5" fill="#fff" opacity="0.85" />
      <g fill="#fff" opacity="0.7">
        <rect x="10.5" y="13.5" width="3" height="3" rx="1" />
        <rect x="14.5" y="13.5" width="3" height="3" rx="1" />
        <rect x="18.5" y="13.5" width="3" height="3" rx="1" />
        <rect x="10.5" y="18" width="3" height="3" rx="1" />
        <rect x="14.5" y="18" width="3" height="3" rx="1" />
        <rect x="18.5" y="18" width="3" height="3" rx="1" />
        <rect x="10.5" y="22.5" width="11" height="3" rx="1" />
      </g>
    </Base>
  );
}

export function IconPuzzle({ size }: { size?: number }) {
  return (
    <Base size={size}>
      <path
        d="M12 5h4v3.2a2.3 2.3 0 1 0 4 0V5h4v5h-3.2a2.3 2.3 0 1 0 0 4H24v5h-5v-3.2a2.3 2.3 0 1 0-4 0V19h-3v-5h3.2a2.3 2.3 0 1 0 0-4H12V5Z"
        fill="currentColor"
        opacity="0.9"
      />
    </Base>
  );
}

export function IconMic({ size }: { size?: number }) {
  return (
    <Base size={size}>
      <rect x="12.5" y="3" width="7" height="13" rx="3.5" fill="currentColor" opacity="0.9" />
      <path d="M7 14.5a9 9 0 0 0 18 0" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
      <line x1="16" y1="23.5" x2="16" y2="28.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
      <line x1="11.5" y1="28.5" x2="20.5" y2="28.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
    </Base>
  );
}

export function IconTimer({ size }: { size?: number }) {
  return (
    <Base size={size}>
      <circle cx="16" cy="17" r="10.5" stroke="currentColor" strokeWidth="2.8" opacity="0.9" />
      <path d="M16 12.5V17l3.5 2.2" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" opacity="0.9" />
      <line x1="12.5" y1="3.5" x2="19.5" y2="3.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" opacity="0.9" />
      <line x1="16" y1="3.5" x2="16" y2="6.5" stroke="currentColor" strokeWidth="2.8" opacity="0.9" />
    </Base>
  );
}

export function IconCheck({ size }: { size?: number }) {
  return (
    <Base size={size}>
      <circle cx="16" cy="16" r="12.5" fill="currentColor" opacity="0.9" />
      <path d="M10.5 16.5 14.5 20.5 21.5 12.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  );
}

export function IconChat({ size }: { size?: number }) {
  return (
    <Base size={size}>
      <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h15A3.5 3.5 0 0 1 27 6.5v11a3.5 3.5 0 0 1-3.5 3.5H14l-5.5 4.5V21H8.5A3.5 3.5 0 0 1 5 17.5v-11Z" fill="currentColor" opacity="0.9" />
      <rect x="10" y="9.5" width="12" height="2.4" rx="1.2" fill="#fff" opacity="0.8" />
      <rect x="10" y="14" width="8" height="2.4" rx="1.2" fill="#fff" opacity="0.55" />
    </Base>
  );
}

export function IconWave({ size }: { size?: number }) {
  return (
    <Base size={size}>
      <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" opacity="0.9">
        <line x1="5" y1="13" x2="5" y2="19" />
        <line x1="10" y1="9" x2="10" y2="23" />
        <line x1="15" y1="5" x2="15" y2="27" />
        <line x1="20" y1="10" x2="20" y2="22" />
        <line x1="25" y1="14" x2="25" y2="18" />
      </g>
    </Base>
  );
}
