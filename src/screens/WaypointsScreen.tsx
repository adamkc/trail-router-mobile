import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { TrailLine } from '../components/TrailLine';

interface Waypoint {
  id: number;
  icon: string;
  type: string;
  color: string;
  label: string;
  note: string;
  dist: string;
}

const WAYPOINTS: Waypoint[] = [
  { id: 1, icon: 'W', type: 'Water',  color: 'var(--topo)',   label: 'Big Creek spring',  note: 'Perennial · cold',          dist: '0.8 km' },
  { id: 2, icon: 'H', type: 'Hazard', color: 'var(--danger)', label: 'Loose scree',        note: 'North face · ~30m',         dist: '1.4 km' },
  { id: 3, icon: 'V', type: 'Vista',  color: 'var(--warn)',   label: 'Ridge overlook',     note: 'SW exposure',               dist: '2.1 km' },
  { id: 4, icon: 'P', type: 'Photo',  color: 'var(--good)',   label: 'Fallen oak',         note: '3 photos',                  dist: '3.0 km' },
  { id: 5, icon: 'C', type: 'Camp',   color: 'var(--bone)',   label: 'Meadow bivy',        note: 'Flat · wind-protected',    dist: '3.8 km' },
];

const MAP_PINS: Array<[number, number, string, string]> = [
  [80, 470,  'W', 'var(--topo)'],
  [175, 420, 'H', 'var(--danger)'],
  [260, 360, 'V', 'var(--warn)'],
  [300, 320, 'P', 'var(--good)'],
  [370, 230, 'C', 'var(--bone)'],
];

const FILTER_CHIPS = ['ALL 5', 'WATER 1', 'HAZARD 1', 'VISTA 1', 'PHOTO 1', 'CAMP 1'];

export function WaypointsScreen() {
  const navigate = useNavigate();
  return (
    <div className="screen">
      <StatusBar />

      {/* Header */}
      <div style={{ padding: '6px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={() => navigate('/details')}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--surface-2)',
            border: '1px solid var(--line-soft)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--bone)',
          }}
          aria-label="Back to details"
        >
          <Icon name="back" size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="eyebrow">HAYFORK LOOP</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>
            Waypoints{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--moss)' }}>· 5</span>
          </div>
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--blaze)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon name="plus" size={18} color="#1A1208" />
        </div>
      </div>

      {/* Mini map */}
      <div
        style={{
          height: 180,
          margin: '0 12px',
          borderRadius: 16,
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid var(--line-soft)',
        }}
      >
        <MapCanvas>
          <TrailLine
            points={[
              [40, 500], [80, 470], [130, 450], [175, 420], [220, 390],
              [260, 360], [300, 320], [340, 280], [370, 230],
            ]}
            color="var(--blaze)"
            width={2.5}
          />
          <svg
            viewBox="0 0 412 600"
            preserveAspectRatio="xMidYMid slice"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            {MAP_PINS.map((w, i) => (
              <g key={i} transform={`translate(${w[0]}, ${w[1]})`}>
                <circle r="12" fill={w[3]} opacity="0.2" />
                <circle r="8" fill="var(--surface)" stroke={w[3]} strokeWidth="1.5" />
                <text
                  y="3"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize="8"
                  fontWeight="700"
                  fill={w[3]}
                >
                  {w[2]}
                </text>
              </g>
            ))}
          </svg>
        </MapCanvas>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 16px 8px', overflowX: 'auto' }}>
        {FILTER_CHIPS.map((c, i) => (
          <div
            key={c}
            style={{
              flexShrink: 0,
              padding: '5px 10px',
              borderRadius: 100,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              background: i === 0 ? 'var(--bone)' : 'var(--surface-2)',
              color: i === 0 ? 'var(--bg)' : 'var(--bone-dim)',
              border: i === 0 ? 'none' : '1px solid var(--line-soft)',
            }}
          >
            {c}
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
        {WAYPOINTS.map((w) => (
          <div
            key={w.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              background: 'var(--surface)',
              border: '1px solid var(--line-soft)',
              borderRadius: 14,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: 'var(--surface-2)',
                border: `1.5px solid ${w.color}`,
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 700,
                color: w.color,
                flexShrink: 0,
              }}
            >
              {w.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500 }}>
                {w.label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--moss)',
                  letterSpacing: '0.06em',
                  marginTop: 2,
                }}
              >
                {w.type.toUpperCase()} · {w.note.toUpperCase()}
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone-dim)' }}>
              {w.dist}
            </div>
          </div>
        ))}
      </div>
      <NavPill />
    </div>
  );
}
