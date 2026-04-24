interface DataRowProps {
  label: string;
  value: string | number;
  unit?: string;
  accent?: string;
}

/** Label + mono value + optional unit, separated by a soft rule. */
export function DataRow({ label, value, unit, accent = 'var(--bone)' }: DataRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '10px 0',
        borderBottom: '1px solid var(--line-soft)',
      }}
    >
      <span className="stat-label">{label}</span>
      <span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: accent, fontWeight: 500 }}>{value}</span>
        {unit && <span className="stat-unit">{unit}</span>}
      </span>
    </div>
  );
}
