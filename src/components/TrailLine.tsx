interface TrailLineProps {
  points: Array<[number, number]>;
  color?: string;
  width?: number;
  dashed?: boolean;
  animate?: boolean;
  showVertices?: boolean;
  frozenIdx?: number[];
}

/** SVG trail overlay drawn in the same viewBox as <TopoMap/>. */
export function TrailLine({
  points,
  color = 'var(--blaze)',
  width = 3.5,
  dashed = false,
  animate = false,
  showVertices = false,
  frozenIdx = [],
}: TrailLineProps) {
  if (points.length < 2) return null;
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');

  return (
    <svg
      viewBox="0 0 412 600"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {/* glow */}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width + 5}
        opacity="0.18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? '6 5' : undefined}
        style={animate ? { animation: 'dash 2s linear infinite' } : undefined}
      />
      {showVertices &&
        points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p[0]}
              cy={p[1]}
              r={6}
              fill={frozenIdx.includes(i) ? 'var(--topo)' : '#fff'}
              stroke="#12160F"
              strokeWidth="1.5"
            />
            {frozenIdx.includes(i) && <circle cx={p[0]} cy={p[1]} r={2.2} fill="#12160F" />}
          </g>
        ))}
    </svg>
  );
}
