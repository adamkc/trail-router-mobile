import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon, type IconName } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { MapGeoLine } from '../components/MapGeoLine';
import {
  MapPin,
  MapLabel,
  MapDraggableVertex,
  MapClickHandler,
  FitBoundsToCoords,
} from '../components/MapMarkers';
import { svgArrayToGeo, svgToGeo, resolveCssVar, HAYFORK } from '../utils/geo';
import { useLibrary, type LibraryRoute } from '../store/library';
import { useRecording, haversineKm } from '../store/recording';

/** Map a library route's status onto the network's layer-toggle key. */
const routeStatusToLayerKey = (s: LibraryRoute['status']): 'optimized' | 'built' | 'draft' | 'proposed' => {
  if (s === 'optimized') return 'optimized';
  if (s === 'built') return 'built';
  if (s === 'review') return 'proposed';
  return 'draft';
};

const tagToCssColor = (route: LibraryRoute): string => {
  if (route.status === 'optimized') return resolveCssVar('var(--blaze)');
  if (route.status === 'built') return resolveCssVar('var(--good)');
  if (route.status === 'review') return resolveCssVar('var(--topo)');
  return resolveCssVar('var(--bone)');
};

interface TrailSegment {
  name: string;
  status: 'optimized' | 'built' | 'draft' | 'proposed';
  color: string;
  /** Original SVG-coord points; converted to lng/lat at render time. */
  pts: Array<[number, number]>;
  solid: boolean;
}

const NETWORK: TrailSegment[] = [
  {
    name: 'Hayfork Loop',
    status: 'optimized',
    color: 'var(--blaze)',
    pts: [
      [40, 500], [70, 470], [110, 440], [150, 410], [185, 380], [220, 350],
      [255, 320], [290, 290], [325, 260], [355, 230], [370, 200], [360, 170], [340, 150],
    ],
    solid: true,
  },
  {
    name: 'North Ridge',
    status: 'built',
    color: 'var(--good)',
    pts: [[340, 150], [370, 120], [385, 90], [380, 60]],
    solid: true,
  },
  {
    name: 'Creek Cutoff',
    status: 'built',
    color: 'var(--good)',
    pts: [[150, 410], [120, 380], [90, 360], [65, 340]],
    solid: true,
  },
  {
    name: 'Manzanita SW',
    status: 'draft',
    color: 'var(--bone)',
    pts: [[255, 320], [270, 280], [255, 240], [275, 210], [260, 180], [290, 160]],
    solid: false,
  },
  {
    name: 'Meadow Link',
    status: 'proposed',
    color: 'var(--topo)',
    pts: [[220, 350], [190, 300], [170, 270], [155, 230]],
    solid: false,
  },
];

// Decorative trailhead + peak markers anchored to the project area.
const TRAILHEAD_SVG: [number, number] = [40, 500];
const PEAK_SVG: [number, number] = [380, 60];

type LayerKey = 'optimized' | 'built' | 'draft' | 'proposed';

const LEGEND_LAYERS: Array<{ key: LayerKey; label: string; color: string; n: number; solid: boolean }> = [
  { key: 'optimized', label: 'Optimized', color: 'var(--blaze)', n: 2, solid: true  },
  { key: 'built',     label: 'Built',     color: 'var(--good)',  n: 7, solid: true  },
  { key: 'draft',     label: 'Draft',     color: 'var(--bone)',  n: 3, solid: false },
  { key: 'proposed',  label: 'Proposed',  color: 'var(--topo)',  n: 2, solid: false },
];

const MAP_TOOLS: Array<{ icon: IconName; active?: boolean }> = [
  { icon: 'layers', active: true },
  { icon: 'mountain' },
  { icon: 'compass' },
  { icon: 'target' },
];

type SnapKey = 'JCT' | 'CNT' | 'GRD';

export function NetworkMapScreen() {
  const navigate = useNavigate();
  const loadPlotted = useRecording((s) => s.loadPlotted);

  const [layersOn, setLayersOn] = useState<Record<LayerKey, boolean>>({
    optimized: true, built: true, draft: true, proposed: true,
  });
  const [snaps, setSnaps] = useState<Record<SnapKey, boolean>>({ JCT: true, CNT: true, GRD: false });

  // Plot mode — when on, tapping the map drops a vertex.
  const [plotMode, setPlotMode] = useState(false);
  const [plotted, setPlotted] = useState<Array<[number, number]>>([]);

  const libraryRoutes = useLibrary((s) => s.routes);

  const toggleLayer = (k: LayerKey) => setLayersOn((s) => ({ ...s, [k]: !s[k] }));
  const toggleSnap = (k: SnapKey) => setSnaps((s) => ({ ...s, [k]: !s[k] }));

  const onMapTap = useCallback((lng: number, lat: number) => {
    if (!plotMode) return;
    let placed: [number, number] = [lng, lat];
    // JCT snap: if the snap chip is on, look across every visible library
    // route's vertices for the nearest one within 30m of the tap, and snap
    // to that. Tiny improvement, big "this feels real" payoff.
    if (snaps.JCT) {
      let bestDist = Infinity;
      let bestCoord: [number, number] | null = null;
      for (const r of libraryRoutes) {
        for (const v of r.geo) {
          const d = haversineKm([lng, lat], v) * 1000;
          if (d < bestDist) {
            bestDist = d;
            bestCoord = v;
          }
        }
      }
      if (bestCoord && bestDist < 30) placed = bestCoord;
    }
    setPlotted((p) => [...p, placed]);
  }, [plotMode, snaps.JCT, libraryRoutes]);

  const movePlottedVertex = useCallback((i: number, lng: number, lat: number) => {
    setPlotted((prev) => {
      const next = prev.slice();
      next[i] = [lng, lat];
      return next;
    });
  }, []);

  const undoPlot = () => setPlotted((p) => p.slice(0, -1));

  const enterPlotMode = () => {
    setPlotMode(true);
    setPlotted([]);
  };
  const cancelPlot = () => {
    setPlotMode(false);
    setPlotted([]);
  };
  const reviewPlot = () => {
    if (plotted.length < 2) return;
    loadPlotted(plotted);
    setPlotMode(false);
    setPlotted([]);
    navigate('/review');
  };

  // Live-distance estimate so the user has a feel for what they've sketched.
  const plottedKm = useMemo(() => {
    if (plotted.length < 2) return 0;
    let d = 0;
    for (let i = 1; i < plotted.length; i++) d += haversineKm(plotted[i - 1], plotted[i]);
    return d;
  }, [plotted]);

  // Library routes (saved + recorded) shown on the network map. The seed
  // network demo trails are dropped — library is the source of truth now.
  const visibleLibraryRoutes = useMemo(
    () =>
      libraryRoutes
        .filter((r) => r.geo.length >= 2)
        .filter((r) => layersOn[routeStatusToLayerKey(r.status)])
        .map((r) => ({ ...r, lineColor: tagToCssColor(r) })),
    [libraryRoutes, layersOn],
  );
  const allLibraryCoords = useMemo(
    () => visibleLibraryRoutes.flatMap((t) => t.geo),
    [visibleLibraryRoutes],
  );

  const geoTrailhead = useMemo(() => svgToGeo(TRAILHEAD_SVG), []);
  const geoPeak = useMemo(() => svgToGeo(PEAK_SVG), []);
  // Recompute legend counts from the library so the panel stays in sync.
  const liveLegend = useMemo(() => {
    const counts = { optimized: 0, built: 0, draft: 0, proposed: 0 };
    for (const r of libraryRoutes) counts[routeStatusToLayerKey(r.status)] += 1;
    return LEGEND_LAYERS.map((l) => ({ ...l, n: counts[l.key] }));
  }, [libraryRoutes]);

  const fitCoords = allLibraryCoords.length >= 2
    ? allLibraryCoords
    : svgArrayToGeo(NETWORK[0].pts); // fallback so the map still has bounds

  return (
    <div className="screen">
      <StatusBar />

      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <MapCanvas center={HAYFORK} zoom={14}>
          <FitBoundsToCoords coords={fitCoords} padding={48} />
          {visibleLibraryRoutes.map((r) => (
            <MapGeoLine
              key={r.id}
              id={`net-${r.id}`}
              coords={r.geo}
              color={r.lineColor}
              width={r.status === 'optimized' ? 3 : 2.5}
              dashed={r.status === 'draft' || r.status === 'review'}
              onTop={r.status === 'optimized'}
            />
          ))}
          {/* Tag each route with a small mono label at its midpoint */}
          {visibleLibraryRoutes.map((r) => {
            const mid = r.geo[Math.floor(r.geo.length / 2)];
            return (
              <MapLabel
                key={`label-${r.id}`}
                coord={mid}
                text={r.name.toUpperCase()}
                color={r.lineColor}
                offset={[0, -10]}
              />
            );
          })}
          <MapPin coord={geoTrailhead} background={resolveCssVar('var(--good)')}   size={14} />
          <MapPin coord={geoPeak}      background={resolveCssVar('var(--danger)')} size={14} />

          {/* Plot mode: tap-to-add + draggable in-progress vertices */}
          {plotMode && <MapClickHandler onTap={onMapTap} />}
          {plotMode && plotted.length >= 2 && (
            <MapGeoLine
              id="plot-inprogress"
              coords={plotted}
              color={resolveCssVar('var(--blaze)')}
              width={3.5}
              dashed
              onTop
            />
          )}
          {plotMode && plotted.map((coord, i) => (
            <MapDraggableVertex
              key={`plot-${i}`}
              coord={coord}
              color={resolveCssVar('var(--blaze)')}
              size={14}
              onDrag={(lng, lat) => movePlottedVertex(i, lng, lat)}
            />
          ))}
        </MapCanvas>

        {/* Top project switcher */}
        <div style={{ position: 'absolute', top: 12, left: 16, right: 16 }}>
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 14,
              background: 'color-mix(in oklch, var(--surface) 88%, transparent)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--line-soft)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => navigate('/projects')}
              style={{ display: 'grid', placeItems: 'center', color: 'var(--bone)' }}
              aria-label="Back to projects"
            >
              <Icon name="back" size={18} />
            </button>
            <div style={{ flex: 1 }}>
              <div className="eyebrow" style={{ color: 'var(--blaze)' }}>◉ PROJECT</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500 }}>Hayfork</div>
                <Icon name="chevron-right" size={14} color="var(--moss)" />
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--bone-dim)',
                    letterSpacing: '0.08em',
                  }}
                >
                  12 TRAILS · 42.8 KM
                </div>
              </div>
            </div>
            <Icon name="search" size={18} color="var(--moss)" />
          </div>
        </div>

        {/* Right map tools */}
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: 76,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {MAP_TOOLS.map((b, i) => (
            <div
              key={i}
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'color-mix(in oklch, var(--surface) 90%, transparent)',
                backdropFilter: 'blur(8px)',
                border: '1px solid var(--line-soft)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name={b.icon} size={18} color={b.active ? 'var(--blaze)' : 'var(--bone)'} />
            </div>
          ))}
        </div>

        {/* Left legend / layers panel */}
        <div
          style={{
            position: 'absolute',
            left: 12,
            top: 76,
            width: 132,
            padding: 10,
            borderRadius: 14,
            background: 'color-mix(in oklch, var(--surface) 90%, transparent)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--line-soft)',
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 6 }}>LAYERS</div>
          {liveLegend.map((l) => {
            const on = layersOn[l.key];
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => toggleLayer(l.key)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 0',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--bone-dim)',
                  letterSpacing: '0.05em',
                  background: 'transparent',
                  border: 'none',
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 3,
                    background: l.color,
                    opacity: on ? 1 : 0.3,
                    borderRadius: 2,
                    backgroundImage: l.solid
                      ? 'none'
                      : `repeating-linear-gradient(90deg, ${l.color} 0 4px, transparent 4px 7px)`,
                  }}
                />
                <span style={{ flex: 1, opacity: on ? 1 : 0.4, textAlign: 'left' }}>{l.label.toUpperCase()}</span>
                <span style={{ color: 'var(--moss)' }}>{l.n}</span>
              </button>
            );
          })}
          <div style={{ height: 1, background: 'var(--line-soft)', margin: '8px 0' }} />
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--moss)',
              letterSpacing: '0.08em',
            }}
          >
            CONTOURS 10M · HILLSHADE
          </div>
        </div>
      </div>

      {/* Plot-route dock */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          background: 'var(--surface)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: '1px solid var(--line-soft)',
          marginTop: -12,
          padding: '12px 16px 14px',
          boxShadow: 'var(--sheet-shadow)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="eyebrow" style={{ color: plotMode ? 'var(--blaze)' : undefined }}>
              {plotMode ? 'PLOT MODE · TAP THE MAP' : 'PLOT NEW ROUTE'}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                fontWeight: 500,
                marginTop: 2,
              }}
            >
              {plotMode
                ? `${plotted.length} vertex${plotted.length === 1 ? '' : 'es'} · ${plottedKm.toFixed(2)} km`
                : 'Snap to junctions, ridges, contours'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['JCT', 'CNT', 'GRD'] as const).map((label) => {
              const on = snaps[label];
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleSnap(label)}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 8,
                    background: on
                      ? 'color-mix(in oklch, var(--blaze) 18%, var(--surface-2))'
                      : 'var(--surface-2)',
                    border: `1px solid ${on ? 'color-mix(in oklch, var(--blaze) 40%, transparent)' : 'var(--line-soft)'}`,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.1em',
                    color: on ? 'var(--blaze)' : 'var(--moss)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {plotMode ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={cancelPlot}>
              <Icon name="close" size={16} /> Cancel
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={undoPlot}
              disabled={plotted.length === 0}
              style={{ opacity: plotted.length === 0 ? 0.4 : 1 }}
              aria-label="Undo last vertex"
            >
              <Icon name="undo" size={16} />
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 2, opacity: plotted.length < 2 ? 0.5 : 1 }}
              onClick={reviewPlot}
              disabled={plotted.length < 2}
            >
              <Icon name="chevron-right" size={16} /> Review {plotted.length} vertex{plotted.length === 1 ? '' : 'es'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={enterPlotMode}>
              <Icon name="plus" size={16} /> Draw route
            </button>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => navigate('/record')}>
              <Icon name="record" size={16} color="var(--danger)" /> Record
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/waypoints')} aria-label="Waypoints">
              <Icon name="waypoint" size={16} />
            </button>
          </div>
        )}

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--moss)',
            letterSpacing: '0.08em',
            marginTop: 10,
            textAlign: 'center',
          }}
        >
          {plotMode
            ? 'TAP MAP TO ADD · DRAG VERTEX TO MOVE · UNDO TO REMOVE'
            : 'TAP DRAW ROUTE · OR USE RECORD TO TRACE WHILE WALKING'}
        </div>
      </div>
      <NavPill />
    </div>
  );
}
