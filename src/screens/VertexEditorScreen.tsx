import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon, type IconName } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { MapGeoLine } from '../components/MapGeoLine';
import { MapPin, MapActiveVertex, FitBoundsToCoords } from '../components/MapMarkers';
import { SlopeRibbon } from '../components/SlopeRibbon';
import { svgArrayToGeo, resolveCssVar, HAYFORK } from '../utils/geo';

const TRAIL_SVG: Array<[number, number]> = [
  [50, 500], [85, 470], [125, 455], [165, 440], [200, 420],
  [240, 400], [275, 370], [310, 335], [340, 295], [370, 250],
];
const FROZEN_IDX = [0, 9];
const ACTIVE_IDX = 4;

const TOOLS: Array<{ icon: IconName; label: string; active?: boolean }> = [
  { icon: 'edit',     label: 'MOVE', active: true },
  { icon: 'plus',     label: 'ADD'      },
  { icon: 'close',    label: 'DELETE'   },
  { icon: 'lock',     label: 'FREEZE'   },
  { icon: 'waypoint', label: 'WAYPOINT' },
  { icon: 'trend-up', label: 'OPTIMIZE' },
];

export function VertexEditorScreen() {
  const navigate = useNavigate();
  const trailGeo = useMemo(() => svgArrayToGeo(TRAIL_SVG), []);
  const activeVertex = trailGeo[ACTIVE_IDX];
  const blaze = resolveCssVar('var(--blaze)');
  const topo = resolveCssVar('var(--topo)');

  return (
    <div className="screen">
      <StatusBar />

      {/* Map */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapCanvas center={HAYFORK} zoom={15}>
          <FitBoundsToCoords coords={trailGeo} padding={48} />
          <MapGeoLine id="edit-trail" coords={trailGeo} color={blaze} width={3} onTop />
          {/* Per-vertex dot — frozen idx use topo, others use bone */}
          {trailGeo.map((coord, i) =>
            i === ACTIVE_IDX ? null : (
              <MapPin
                key={i}
                coord={coord}
                background={FROZEN_IDX.includes(i) ? topo : '#E8E4D8'}
                size={10}
                ringOpacity={0}
              />
            ),
          )}
          <MapActiveVertex coord={activeVertex} color={blaze} />
        </MapCanvas>
      </div>

      {/* Top toolbar — back / trail label / undo */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '4px 12px 0',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/details')}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'color-mix(in oklch, var(--surface) 90%, transparent)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--line-soft)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--bone)',
          }}
          aria-label="Back to details"
        >
          <Icon name="back" size={18} />
        </button>
        <div
          style={{
            flex: 1,
            height: 40,
            borderRadius: 12,
            background: 'color-mix(in oklch, var(--surface) 90%, transparent)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--line-soft)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500 }}>
              Edit · Hayfork Loop
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--moss)',
                letterSpacing: '0.08em',
              }}
            >
              VERTEX 5 / 10 · UNSAVED
            </div>
          </div>
          <div className="chip blaze" style={{ padding: '2px 8px' }}>EDIT</div>
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'color-mix(in oklch, var(--surface) 90%, transparent)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--line-soft)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon name="undo" size={18} />
        </div>
      </div>

      {/* Vertex inspector (floating left) */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: 110,
          width: 150,
          padding: 12,
          borderRadius: 14,
          background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--line-soft)',
          zIndex: 2,
        }}
      >
        <div className="eyebrow">VERTEX 5</div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--bone-dim)',
            lineHeight: 1.6,
            marginTop: 6,
          }}
        >
          <div>LAT  40.73421°</div>
          <div>LON −122.5194°</div>
          <div>ELEV <span style={{ color: 'var(--bone)' }}>486</span> m</div>
        </div>
        <div style={{ height: 1, background: 'var(--line-soft)', margin: '10px 0' }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div>
            <div className="stat-label">IN</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--good)', fontWeight: 500 }}>
              +6.8%
            </div>
          </div>
          <div>
            <div className="stat-label">OUT</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--warn)', fontWeight: 500 }}>
              +9.1%
            </div>
          </div>
        </div>
      </div>

      {/* Freeze legend (floating right) */}
      <div
        style={{
          position: 'absolute',
          right: 12,
          top: 110,
          padding: 10,
          borderRadius: 14,
          background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--line-soft)',
          zIndex: 2,
        }}
      >
        <div className="eyebrow">LEGEND</div>
        {[
          { label: 'VERTEX', color: '#fff' },
          { label: 'FROZEN', color: 'var(--topo)' },
          { label: 'ACTIVE', color: 'var(--blaze)' },
        ].map((l, i) => (
          <div
            key={l.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: i === 0 ? 6 : 5,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--bone-dim)',
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 5, background: l.color }} /> {l.label}
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Bottom tool dock */}
      <div style={{ position: 'relative', zIndex: 2, margin: '0 12px 8px' }}>
        <div
          style={{
            padding: 10,
            borderRadius: 18,
            background: 'color-mix(in oklch, var(--surface) 94%, transparent)',
            backdropFilter: 'blur(14px)',
            border: '1px solid var(--line-soft)',
          }}
        >
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {TOOLS.map((t) => (
              <div
                key={t.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '8px 10px',
                  minWidth: 60,
                  borderRadius: 10,
                  background: t.active ? 'var(--blaze)' : 'transparent',
                  color: t.active ? '#1A1208' : 'var(--bone-dim)',
                }}
              >
                <Icon name={t.icon} size={18} color={t.active ? '#1A1208' : 'var(--bone-dim)'} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em' }}>
                  {t.label}
                </div>
              </div>
            ))}
          </div>

          {/* Grade mini-ribbon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 10,
              padding: '8px 10px',
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--line-soft)',
            }}
          >
            <div className="eyebrow" style={{ whiteSpace: 'nowrap' }}>GRADE</div>
            <div style={{ flex: 1, height: 22 }}>
              <SlopeRibbon data={[3, 5, 7, 8, 9, 11, 8, 6, 4, -2, -5, -8, -10]} height={22} />
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--warn)' }}>
              MAX 11.2%
            </div>
          </div>

          {/* Save row */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ flex: 1, padding: '10px 12px', fontSize: 13 }}
              onClick={() => navigate('/details')}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, padding: '10px 12px', fontSize: 13 }}
              onClick={() => navigate('/details')}
            >
              <Icon name="download" size={14} /> Save 7 edits
            </button>
          </div>
        </div>
      </div>
      <NavPill />
    </div>
  );
}
