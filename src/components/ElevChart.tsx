interface ElevChartProps {
  data: number[];
  height?: number;
  color?: string;
  fill?: boolean;
  /** Index into data to mark with a vertical guide + dot. */
  mark?: number;
}

/** Compact elevation sparkline. */
export function ElevChart({ data, height = 60, color = 'var(--blaze)', fill = true, mark }: ElevChartProps) {
  const w = 100;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((d, i) => [
    (i / (data.length - 1)) * w,
    height - ((d - min) / range) * (height - 4) - 2,
  ]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const area = `${path} L ${w} ${height} L 0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block' }}
    >
      {fill && <path d={area} fill={color} opacity="0.18" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      {mark !== undefined && pts[mark] && (
        <g>
          <line
            x1={pts[mark][0]}
            y1={0}
            x2={pts[mark][0]}
            y2={height}
            stroke="var(--bone)"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
            opacity="0.6"
          />
          <circle cx={pts[mark][0]} cy={pts[mark][1]} r="2" fill="var(--bone)" />
        </g>
      )}
    </svg>
  );
}
