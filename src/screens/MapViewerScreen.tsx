import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon, type IconName } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { MapGeoLine } from '../components/MapGeoLine';
import { MapPin, MapWaypoint, FitBoundsToCoords } from '../components/MapMarkers';
import { ElevChart } from '../components/ElevChart';
import { svgArrayToGeo, svgToGeo, resolveCssVar, HAYFORK } from '../utils/geo';

const TRAIL_SVG: Array<[number, number]> = [
  [40, 480], [70, 440], [110, 410], [150, 420], [180, 380],
  [220, 340], [260, 300], [290, 250], [330, 210], [360, 170],
];

const VISTA_WAYPOINT_SVG: [number, number] = [220, 340];

const CONTROLS: Array<{ icon: IconName; label: string }> = [
  { icon: 'layers',   label: 'HILL' },
  { icon: 'mountain', label: '3D'   },
  { icon: 'compass',  label: 'N'    },
  { icon: 'target',   label: 'LOC'  },
];

export function MapViewerScreen() {
  const navigate = useNavigate();
  const trailGeo = useMemo(() => svgArrayToGeo(TRAIL_SVG), []);
  const vistaGeo = useMemo(() => svgToGeo(VISTA_WAYPOINT_SVG), []);
  const start = trailGeo[0];
  const end = trailGeo[trailGeo.length - 1];

  return (
    <div className="screen">
      <StatusBar />

      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <MapCanvas center={HAYFORK} zoom={14}>
          <FitBoundsToCoords coords={trailGeo} padding={48} />
          <MapGeoLine id="map-trail" coords={trailGeo} color={resolveCssVar('var(--blaze)')} width={4} onTop />
          <MapPin coord={start} background={resolveCssVar('var(--good)')}   size={16} />
          <MapPin coord={end}   background={resolveCssVar('var(--danger)')} size={16} />
          <MapWaypoint coord={vistaGeo} icon="V" color={resolveCssVar('var(--topo)')} size={20} />
        </MapCanvas>

        {/* Floating top bar — back + trail name + coords */}
        <div style={{ position: 'absolute', top: 12, left: 16, right: 16, display: 'flex', gap: 8 }}>
          <div
            style={{
              flex: 1,
              height: 44,
              borderRadius: 22,
              background: 'color-mix(in oklch, var(--surface) 88%, transparent)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--line-soft)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => navigate('/library')}
              style={{ display: 'grid', placeItems: 'center', color: 'var(--bone)' }}
              aria-label="Back to library"
            >
              <Icon name="back" size={18} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/details')}
              style={{ flex: 1, textAlign: 'left', color: 'var(--bone)' }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500 }}>
                Hayfork Loop
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--moss)',
                  letterSpacing: '0.08em',
                }}
              >
                40.7289° N · 122.5208° W
              </div>
            </button>
            <Icon name="share" size={18} color="var(--moss)" />
          </div>
        </div>

        {/* Right-side map tools */}
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: 72,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {CONTROLS.map((b, i) => (
            <div
              key={b.label}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'color-mix(in oklch, var(--surface) 90%, transparent)',
                backdropFilter: 'blur(8px)',
                border: '1px solid var(--line-soft)',
                display: 'grid',
                placeItems: 'center',
                position: 'relative',
              }}
            >
              <Icon name={b.icon} size={18} color={i === 0 ? 'var(--blaze)' : 'var(--bone)'} />
              <div
                style={{
                  position: 'absolute',
                  bottom: 3,
                  right: 4,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 8,
                  color: 'var(--moss)',
                }}
              >
                {b.label}
              </div>
            </div>
          ))}
        </div>

        {/* Scale + zoom readout */}
        <div
          style={{
            position: 'absolute',
            left: 16,
            bottom: 180,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--bone-dim)',
            letterSpacing: '0.08em',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 40, height: 2, background: 'var(--bone)' }} />
            <div style={{ width: 2, height: 6, background: 'var(--bone)' }} />
            <div style={{ width: 40, height: 2, background: 'var(--bone)' }} />
            <span>500 m</span>
          </div>
          <div style={{ marginTop: 4, color: 'var(--moss)' }}>ZOOM 14.2 · CONTOURS 10M</div>
        </div>
      </div>

      {/* Bottom peek sheet */}
      <div
        style={{
          background: 'var(--surface)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: '1px solid var(--line-soft)',
          marginTop: -12,
          position: 'relative',
          zIndex: 2,
          padding: '10px 20px 16px',
          boxShadow: 'var(--sheet-shadow)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--line)' }} />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: 10,
          }}
        >
          <div>
            <div className="stat-label">HAYFORK LOOP</div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              14.2{' '}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--moss)' }}>
                km · 3h 40m
              </span>
            </div>
          </div>
          <div className="chip blaze">OPTIMIZED</div>
        </div>

        <div style={{ marginTop: 12, height: 44 }}>
          <ElevChart data={[420, 430, 480, 520, 580, 610, 640, 620, 560, 500, 440, 420]} height={44} mark={6} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate('/details')}>
            <Icon name="route" size={16} /> Follow
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/editor')} aria-label="Edit vertices">
            <Icon name="edit" size={16} />
          </button>
          <button type="button" className="btn btn-ghost" aria-label="Share">
            <Icon name="share" size={16} />
          </button>
        </div>
      </div>
      <NavPill />
    </div>
  );
}
