import type { ReactNode } from 'react';

interface TopoMapProps {
  children?: ReactNode;
  variant?: 'default' | 'satellite';
  pitch?: number;
}

/** Topographic map illustration — two overlapping contour fans + background vignette. */
export function TopoMap({ children, variant = 'default', pitch = 0 }: TopoMapProps) {
  const contours: ReactNode[] = [];

  // Primary ridge (center-left)
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const cx = 160 + Math.sin(t * 3.2) * 30;
    const cy = 280 + Math.cos(t * 2.8) * 50;
    const rx = 40 + i * 22;
    const ry = 30 + i * 18;
    contours.push(
      <ellipse
        key={`a${i}`}
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={i % 5 === 0 ? 'var(--moss)' : 'var(--moss-dim)'}
        strokeWidth={i % 5 === 0 ? 0.8 : 0.4}
        opacity={i % 5 === 0 ? 0.7 : 0.4}
      />,
    );
  }

  // Secondary ridge (top-right)
  for (let i = 0; i < 10; i++) {
    const rx = 20 + i * 18;
    const ry = 15 + i * 14;
    contours.push(
      <ellipse
        key={`b${i}`}
        cx={340}
        cy={120}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={i % 5 === 0 ? 'var(--moss)' : 'var(--moss-dim)'}
        strokeWidth={i % 5 === 0 ? 0.8 : 0.4}
        opacity={i % 5 === 0 ? 0.55 : 0.3}
      />,
    );
  }

  const transform = pitch ? `perspective(900px) rotateX(${pitch}deg)` : undefined;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          variant === 'satellite'
            ? 'radial-gradient(ellipse at 30% 40%, #2d3a28 0%, #1a2016 50%, #12160F 100%)'
            : 'radial-gradient(ellipse at 30% 40%, #1e2519 0%, #151a12 60%, #0d1108 100%)',
        overflow: 'hidden',
        transform,
        transformOrigin: 'center bottom',
      }}
    >
      <svg
        viewBox="0 0 412 600"
        preserveAspectRatio="xMidYMid slice"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        {contours}
      </svg>
      {children}
    </div>
  );
}
