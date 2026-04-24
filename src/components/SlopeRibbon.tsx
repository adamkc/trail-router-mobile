interface SlopeRibbonProps {
  data: number[];
  height?: number;
}

const gradeColor = (g: number): string => {
  if (g > 15) return 'var(--danger)';
  if (g > 8) return 'var(--warn)';
  if (g > 3) return 'var(--good)';
  if (g > -3) return 'var(--moss)';
  if (g > -10) return 'var(--topo)';
  return 'oklch(0.65 0.20 310)';
};

/** Slope-colored ribbon chart (positive up, negative down; each bar colored by grade). */
export function SlopeRibbon({ data, height = 50 }: SlopeRibbonProps) {
  const w = 100;
  const max = Math.max(...data.map((d) => Math.abs(d))) || 1;
  const barW = w / data.length;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block' }}
    >
      {data.map((g, i) => {
        const h = (Math.abs(g) / max) * (height / 2 - 2);
        const y = g >= 0 ? height / 2 - h : height / 2;
        return <rect key={i} x={i * barW} y={y} width={barW + 0.2} height={h || 0.4} fill={gradeColor(g)} />;
      })}
      <line
        x1="0"
        y1={height / 2}
        x2={w}
        y2={height / 2}
        stroke="var(--moss-dim)"
        strokeWidth="0.3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
