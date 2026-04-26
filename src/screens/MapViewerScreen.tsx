import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon, type IconName } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { MapGeoLine } from '../components/MapGeoLine';
import { MapPin, MapWaypoint, FitBoundsToCoords } from '../components/MapMarkers';
import { ElevChart } from '../components/ElevChart';
import { resolveCssVar, HAYFORK } from '../utils/geo';
import { routeChartData } from '../utils/elevation';
import { useLibrary } from '../store/library';
import type { ChipTone } from '../components/Chip';

const CONTROLS: Array<{ icon: IconName; label: string }> = [
  { icon: 'layers',   label: 'HILL' },
  { icon: 'mountain', label: '3D'   },
  { icon: 'compass',  label: 'N'    },
  { icon: 'target',   label: 'LOC'  },
];

const tagToCssColor = (tag: ChipTone | null): string =>
  tag === 'blaze' ? resolveCssVar('var(--blaze)')
  : tag === 'good' ? resolveCssVar('var(--good)')
  : tag === 'warn' ? resolveCssVar('var(--warn)')
  : tag === 'topo' ? resolveCssVar('var(--topo)')
  : resolveCssVar('var(--bone)');

const tagToChipClass = (tag: ChipTone | null): string => `chip ${tag ?? ''}`;

export function MapViewerScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const routes = useLibrary((s) => s.routes);

  const route = useMemo(
    () => (id ? routes.find((r) => r.id === id) : null) ?? routes[0],
    [id, routes],
  );

  if (!route) {
    return <div className="screen"><StatusBar /><NavPill /></div>;
  }

  const trailGeo = route.geo;
  const start = trailGeo[0];
  const end = trailGeo[trailGeo.length - 1];
  const accent = tagToCssColor(route.tag);

  return (
    <div className="screen">
      <StatusBar />

      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <MapCanvas center={HAYFORK} zoom={14}>
          <FitBoundsToCoords coords={trailGeo} padding={48} />
          <MapGeoLine id={`map-${route.id}`} coords={trailGeo} color={accent} width={4} onTop />
          <MapPin coord={start} background={resolveCssVar('var(--good)')}   size={16} />
          <MapPin coord={end}   background={resolveCssVar('var(--danger)')} size={16} />
          {route.waypoints.map((w) => (
            <MapWaypoint
              key={w.id}
              coord={w.coord}
              icon={w.icon}
              color={resolveCssVar(w.color)}
              size={20}
            />
          ))}
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
              onClick={() => navigate(`/details/${route.id}`)}
              style={{ flex: 1, textAlign: 'left', color: 'var(--bone)' }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500 }}>
                {route.name}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--moss)',
                  letterSpacing: '0.08em',
                }}
              >
                {start[1].toFixed(4)}° N · {Math.abs(start[0]).toFixed(4)}° W
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
          <div style={{ marginTop: 4, color: 'var(--moss)' }}>ZOOM 14 · {trailGeo.length} VTX</div>
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
            <div className="stat-label">{route.name.toUpperCase()}</div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              {route.km}{' '}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--moss)' }}>
                km · {route.gain} m gain
              </span>
            </div>
          </div>
          <div className={tagToChipClass(route.tag)}>{route.status.toUpperCase()}</div>
        </div>

        <div style={{ marginTop: 12, height: 44 }}>
          <ElevChart
            data={routeChartData(route, 60)}
            height={44}
            mark={Math.floor(routeChartData(route, 60).length / 2)}
            color={accent}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate(`/details/${route.id}`)}>
            <Icon name="route" size={16} /> Follow
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(`/editor/${route.id}`)} aria-label="Edit vertices">
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
