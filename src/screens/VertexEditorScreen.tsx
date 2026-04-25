import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon, type IconName } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { MapGeoLine } from '../components/MapGeoLine';
import { MapPin, MapActiveVertex, MapDraggableVertex, FitBoundsToCoords } from '../components/MapMarkers';
import { SlopeRibbon } from '../components/SlopeRibbon';
import { svgArrayToGeo, resolveCssVar, HAYFORK } from '../utils/geo';

const TRAIL_SVG: Array<[number, number]> = [
  [50, 500], [85, 470], [125, 455], [165, 440], [200, 420],
  [240, 400], [275, 370], [310, 335], [340, 295], [370, 250],
];
const FROZEN_IDX = [0, 9];
const ACTIVE_IDX = 4;

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
  const [activeTool, setActiveTool] = useState<EditorTool>('MOVE');
  const originalGeo = useMemo(() => svgArrayToGeo(TRAIL_SVG), []);
  const [coords, setCoords] = useState<Array<[number, number]>>(originalGeo);
  const [activeIdx, setActiveIdx] = useState(ACTIVE_IDX);
  const blaze = resolveCssVar('var(--blaze)');
  const topo = resolveCssVar('var(--topo)');

  const handleToolClick = (tool: EditorTool) => {
    if (tool === 'OPTIMIZE') {
      navigate('/optimizer');
    } else if (tool === 'WAYPOINT') {
      navigate('/waypoints');
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

  const editedCount = coords.reduce(
    (acc, c, i) => acc + (c[0] !== originalGeo[i][0] || c[1] !== originalGeo[i][1] ? 1 : 0),
    0,
  );
  const dirty = editedCount > 0;

  const handleDiscard = () => {
    if (dirty) setCoords(originalGeo);
    else navigate('/details');
  };
  const handleSave = () => {
    // For now, "save" just exits — the trail is local state, not persisted.
    // Persistence will hook into the library store when we have per-route geometry.
    navigate('/details');
  };

  const activeVertex = coords[activeIdx];

  return (
    <div className="screen">
      <StatusBar />

      {/* Map */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapCanvas center={HAYFORK} zoom={15}>
          <FitBoundsToCoords coords={originalGeo} padding={48} />
          <MapGeoLine id="edit-trail" coords={coords} color={blaze} width={3} onTop />
          {coords.map((coord, i) => {
            if (i === activeIdx) return null;
            if (FROZEN_IDX.includes(i)) {
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
                onSelect={() => setActiveIdx(i)}
              />
            );
          })}
          {/* Active vertex — dashed-ring highlight, also draggable */}
          <MapActiveVertex coord={activeVertex} color={blaze} />
          {!FROZEN_IDX.includes(activeIdx) && (
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
