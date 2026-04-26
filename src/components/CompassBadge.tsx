import { useHeading } from '../hooks/useHeading';

/**
 * Compact compass badge for the record screen. Renders the live device
 * heading as a rotating arrow + numeric bearing. On iOS the user has to
 * tap the badge once to grant orientation permission; before that we
 * show a "TAP TO ENABLE" prompt instead of a stale arrow.
 *
 * Designed to live as an absolutely-positioned overlay (caller controls
 * `top`/`right`/`left`/`bottom` via inline style or wrapping div).
 */
export function CompassBadge() {
  const { heading, available, needsPermission, requestPermission } = useHeading();

  if (!available) return null;

  const ringStyle: React.CSSProperties = {
    width: 56,
    height: 56,
    borderRadius: 28,
    background: 'color-mix(in oklch, var(--surface) 88%, transparent)',
    backdropFilter: 'blur(10px)',
    border: '1px solid var(--line-soft)',
    display: 'grid',
    placeItems: 'center',
    position: 'relative',
    color: 'var(--bone)',
  };

  if (needsPermission) {
    return (
      <button
        type="button"
        onClick={requestPermission}
        aria-label="Enable compass"
        style={{ ...ringStyle, padding: 0, cursor: 'pointer' }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            color: 'var(--moss)',
            letterSpacing: '0.08em',
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          TAP TO<br />ENABLE
        </div>
      </button>
    );
  }

  const bearing = heading ?? 0;
  // SVG arrow points up by default; rotate counter to the heading so the tip
  // always points at magnetic north regardless of how the device is held.
  return (
    <div style={ringStyle}>
      <svg
        width={36}
        height={36}
        viewBox="0 0 36 36"
        style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform 100ms linear' }}
      >
        {/* North arrow (red tip), south tail (gray) */}
        <path d="M 18 4 L 24 22 L 18 18 L 12 22 Z" fill="var(--danger)" />
        <path d="M 18 32 L 12 14 L 18 18 L 24 14 Z" fill="var(--moss)" opacity="0.5" />
        <circle cx={18} cy={18} r={2} fill="var(--bone)" />
      </svg>
      <div
        style={{
          position: 'absolute',
          bottom: -14,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: heading === null ? 'var(--moss)' : 'var(--bone)',
          letterSpacing: '0.08em',
        }}
      >
        {heading === null ? '— —°' : `${Math.round(bearing)}°`}
      </div>
    </div>
  );
}
