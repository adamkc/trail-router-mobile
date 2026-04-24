import type { ReactNode } from 'react';

export type ChipTone = 'neutral' | 'blaze' | 'topo' | 'good' | 'warn' | 'danger';

interface ChipProps {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
  onClick?: () => void;
}

/** Pill tag with optional status tone. */
export function Chip({ children, tone = 'neutral', className = '', onClick }: ChipProps) {
  const toneClass = tone === 'neutral' ? '' : tone;
  const cls = ['chip', toneClass, className].filter(Boolean).join(' ');
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>{children}</button>
  ) : (
    <span className={cls}>{children}</span>
  );
}
