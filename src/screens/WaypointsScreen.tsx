import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { MapGeoLine } from '../components/MapGeoLine';
import { MapWaypoint, FitBoundsToCoords } from '../components/MapMarkers';
import { svgArrayToGeo, resolveCssVar, HAYFORK } from '../utils/geo';

const TRAIL_SVG: Array<[number, number]> = [
  [40, 500], [80, 470], [130, 450], [175, 420], [220, 390],
  [260, 360], [300, 320], [340, 280], [370, 230],
];

const MAP_PINS_SVG: Array<{ pos: [number, number]; icon: string; color: string }> = [
  { pos: [80, 470],  icon: 'W', color: 'var(--topo)'   },
  { pos: [175, 420], icon: 'H', color: 'var(--danger)' },
  { pos: [260, 360], icon: 'V', color: 'var(--warn)'   },
  { pos: [300, 320], icon: 'P', color: 'var(--good)'   },
  { pos: [370, 230], icon: 'C', color: 'var(--bone)'   },
];

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

const FILTER_CHIPS = ['ALL 5', 'WATER 1', 'HAZARD 1', 'VISTA 1', 'PHOTO 1', 'CAMP 1'];

export function WaypointsScreen() {
  const navigate = useNavigate();
  const trailGeo = useMemo(() => svgArrayToGeo(TRAIL_SVG), []);
  const pinsGeo  = useMemo(
    () => MAP_PINS_SVG.map((p) => ({ ...p, coord: svgArrayToGeo([p.pos])[0] })),
    [],
  );
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
        <MapCanvas center={HAYFORK} zoom={14} interactive={false}>
          <FitBoundsToCoords coords={trailGeo} padding={36} />
          <MapGeoLine id="wp-trail" coords={trailGeo} color={resolveCssVar('var(--blaze)')} width={2.5} onTop />
          {pinsGeo.map((p) => (
            <MapWaypoint key={p.icon} coord={p.coord} icon={p.icon} color={resolveCssVar(p.color)} size={20} />
          ))}
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
