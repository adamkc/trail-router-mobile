import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon, type IconName } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { MapGeoLine } from '../components/MapGeoLine';
import { MapPin, MapActiveVertex, MapDraggableVertex, MapClickHandler, FitBoundsToCoords } from '../components/MapMarkers';
import { SlopeRibbon } from '../components/SlopeRibbon';
import { resolveCssVar, HAYFORK } from '../utils/geo';
import { useLibrary } from '../store/library';
import { haversineKm } from '../store/recording';

/** Point-to-segment distance in meters (lat/lng → simple Cartesian projection,
 *  fine for trail-scale meters; final distance via Haversine to keep accuracy). */
function pointToSegmentMeters(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): { dist: number; nearest: [number, number] } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  const tc = Math.max(0, Math.min(1, t));
  const nearest: [number, number] = [a[0] + tc * dx, a[1] + tc * dy];
  return { dist: haversineKm(nearest, p) * 1000, nearest };
}

type EditorTool = 'MOVE' | 'ADD' | 'DELETE' | 'FREEZE' | 'WAYPOINT' | 'OPTIMIZE';
const TOOLS: Array<{ icon: IconName; label: EditorTool }> = [
  { icon: 'edit',     label: 'MOVE'     },
  { icon: 'plus',     label: 'ADD'      },
  { icon: 'close',    label: 'DELETE'   },
  { icon: 'lock',     label: 'FREEZE'   },
  { icon: 'waypoint', label: 'WAYPOINT' },
  { icon: 'trend-up', label: 'OPTIMIZE' },
];

export function VertexEditorScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const routes = useLibrary((s) => s.routes);
  const updateRouteGeo = useLibrary((s) => s.updateRouteGeo);

  const route = useMemo(
    () => (id ? routes.find((r) => r.id === id) : null) ?? routes[0],
    [id, routes],
  );

  const [activeTool, setActiveTool] = useState<EditorTool>('MOVE');
  // Snapshot the route's geo when this screen mounts so Discard can revert,
  // and so dirty tracking compares against the persisted shape.
  const originalGeo = useMemo(() => route?.geo.slice() ?? [], [route?.id]);
  const [coords, setCoords] = useState<Array<[number, number]>>(originalGeo);
  // Default the active vertex to the midpoint of the trail.
  const [activeIdx, setActiveIdx] = useState(() => Math.floor((route?.geo.length ?? 1) / 2));
  const frozenIdx = useMemo(
    () => (originalGeo.length ? [0, originalGeo.length - 1] : []),
    [originalGeo.length],
  );

  const blaze = resolveCssVar('var(--blaze)');
  const topo = resolveCssVar('var(--topo)');

  const handleToolClick = (tool: EditorTool) => {
    if (tool === 'OPTIMIZE') {
      if (route) navigate(`/optimizer/${route.id}`);
    } else if (tool === 'WAYPOINT') {
      if (route) navigate(`/waypoints/${route.id}`);
    } else {
      setActiveTool(tool);
    }
  };

  const moveVertex = useCallback((i: number, lng: number, lat: number) => {
    setCoords((prev) => {
      const next = prev.slice();
      next[i] = [lng, lat];
      return next;
    });
  }, []);

  const insertVertexNear = useCallback((lng: number, lat: number) => {
    setCoords((prev) => {
      if (prev.length < 2) return [...prev, [lng, lat]];
      // Find the segment whose nearest point to the click is closest;
      // insert the new vertex right after that segment's start.
      let bestIdx = 0;
      let bestDist = Infinity;
      let bestNearest: [number, number] = [lng, lat];
      for (let i = 0; i < prev.length - 1; i++) {
        const { dist, nearest } = pointToSegmentMeters([lng, lat], prev[i], prev[i + 1]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
          bestNearest = nearest;
        }
      }
      // Snap to the segment's nearest point so the line stays continuous
      // (rather than the user's exact tap, which could create a kink).
      const next = prev.slice();
      next.splice(bestIdx + 1, 0, bestNearest);
      return next;
    });
    setActiveIdx((curr) => curr); // active idx index doesn't change semantically
  }, []);

  const deleteVertex = useCallback((i: number) => {
    setCoords((prev) => {
      if (prev.length <= 2) return prev; // keep at least the two endpoints
      const next = prev.slice();
      next.splice(i, 1);
      return next;
    });
    setActiveIdx((curr) => Math.max(0, curr >= i ? curr - 1 : curr));
  }, []);

  const onMapTap = useCallback(
    (lng: number, lat: number) => {
      if (activeTool === 'ADD') insertVertexNear(lng, lat);
    },
    [activeTool, insertVertexNear],
  );

  const onVertexSelect = useCallback(
    (i: number) => {
      if (activeTool === 'DELETE' && !frozenIdx.includes(i)) deleteVertex(i);
      else setActiveIdx(i);
    },
    [activeTool, frozenIdx, deleteVertex],
  );

  const editedCount = coords.reduce(
    (acc, c, i) => acc + (c[0] !== originalGeo[i]?.[0] || c[1] !== originalGeo[i]?.[1] ? 1 : 0),
    0,
  );
  const dirty = editedCount > 0;

  const handleDiscard = () => {
    if (dirty) setCoords(originalGeo);
    else navigate(route ? `/details/${route.id}` : '/details');
  };
  const handleSave = () => {
    if (route && dirty) updateRouteGeo(route.id, coords);
    navigate(route ? `/details/${route.id}` : '/details');
  };

  if (!route) {
    return <div className="screen"><StatusBar /><NavPill /></div>;
  }

  const activeVertex = coords[activeIdx] ?? coords[0];

  return (
    <div className="screen">
      <StatusBar />

      {/* Map */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapCanvas center={HAYFORK} zoom={15}>
          <FitBoundsToCoords coords={originalGeo} padding={48} />
          {activeTool === 'ADD' && <MapClickHandler onTap={onMapTap} />}
          <MapGeoLine id="edit-trail" coords={coords} color={blaze} width={3} onTop />
          {coords.map((coord, i) => {
            if (i === activeIdx) return null;
            if (frozenIdx.includes(i)) {
              // Frozen endpoints — non-draggable, topo-tinted.
              return <MapPin key={i} coord={coord} background={topo} size={10} ringOpacity={0} />;
            }
            // All other vertices: draggable; tap to make active.
            return (
              <MapDraggableVertex
                key={i}
                coord={coord}
                color="#E8E4D8"
                size={12}
                onDrag={(lng, lat) => moveVertex(i, lng, lat)}
                onSelect={() => onVertexSelect(i)}
              />
            );
          })}
          {/* Active vertex — dashed-ring highlight, also draggable */}
          <MapActiveVertex coord={activeVertex} color={blaze} />
          {!frozenIdx.includes(activeIdx) && (
            <MapDraggableVertex
              coord={activeVertex}
              color={blaze}
              size={16}
              onDrag={(lng, lat) => moveVertex(activeIdx, lng, lat)}
            />
          )}
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
          onClick={() => navigate(`/details/${route.id}`)}
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
              Edit · {route.name}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--moss)',
                letterSpacing: '0.08em',
              }}
            >
              VERTEX {activeIdx + 1} / {coords.length} · {dirty ? `${editedCount} EDITED` : 'CLEAN'}
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
            {TOOLS.map((t) => {
              const active = activeTool === t.label;
              return (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => handleToolClick(t.label)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '8px 10px',
                    minWidth: 60,
                    borderRadius: 10,
                    background: active ? 'var(--blaze)' : 'transparent',
                    color: active ? '#1A1208' : 'var(--bone-dim)',
                    border: 'none',
                  }}
                >
                  <Icon name={t.icon} size={18} color={active ? '#1A1208' : 'var(--bone-dim)'} />
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em' }}>
                    {t.label}
                  </div>
                </button>
              );
            })}
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
              onClick={handleDiscard}
            >
              {dirty ? 'Revert' : 'Discard'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, padding: '10px 12px', fontSize: 13, opacity: dirty ? 1 : 0.7 }}
              onClick={handleSave}
              disabled={!dirty}
            >
              <Icon name="download" size={14} /> {dirty ? `Save ${editedCount} edit${editedCount === 1 ? '' : 's'}` : 'Save'}
            </button>
          </div>
        </div>
      </div>
      <NavPill />
    </div>
  );
}
