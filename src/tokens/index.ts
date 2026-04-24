/**
 * Design tokens mirrored from styles/tokens.css for JS/TS consumption.
 * CSS variables remain the source of truth; these constants let SVG/canvas
 * code read resolved values without DOM queries.
 */

export const colors = {
  bg: 'var(--bg)',
  pageBg: 'var(--page-bg)',
  surface: 'var(--surface)',
  surface2: 'var(--surface-2)',
  surface3: 'var(--surface-3)',
  line: 'var(--line)',
  lineSoft: 'var(--line-soft)',
  bone: 'var(--bone)',
  boneDim: 'var(--bone-dim)',
  moss: 'var(--moss)',
  mossDim: 'var(--moss-dim)',
  blaze: 'var(--blaze)',
  blazeDim: 'var(--blaze-dim)',
  topo: 'var(--topo)',
  topoDim: 'var(--topo-dim)',
  danger: 'var(--danger)',
  good: 'var(--good)',
  warn: 'var(--warn)',
} as const;

export const space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
} as const;

export const radius = {
  pill: 100,
  sm: 10,
  md: 12,
  card: 14,
  lg: 16,
  sheet: 20,
} as const;

export const font = {
  display: 'var(--font-display)',
  body: 'var(--font-body)',
  mono: 'var(--font-mono)',
} as const;

/** Trail status → stroke color + style */
export const trailStatusStyle = {
  optimized: { color: colors.blaze, dashed: false },
  built:     { color: colors.good,  dashed: false },
  draft:     { color: colors.bone,  dashed: true  },
  proposed:  { color: colors.topo,  dashed: true  },
} as const;

export type TrailStatus = keyof typeof trailStatusStyle;
