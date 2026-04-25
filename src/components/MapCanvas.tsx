import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import maplibregl, { type Map as MlMap } from 'maplibre-gl';
import { TopoMap } from './TopoMap';

export interface MapCanvasProps {
  children?: ReactNode;
  /** [lng, lat] — default is the Hayfork, CA area from the handoff copy. */
  center?: [number, number];
  zoom?: number;
  variant?: 'default' | 'satellite';
  /** Preserved from TopoMap's API — MapLibre is north-always-up here, kept for prop compat. */
  pitch?: number;
  interactive?: boolean;
}

const HAYFORK: [number, number] = [-122.5208, 40.7289];

/**
 * Carto's hosted "Dark Matter" vector style — free, no API key, under OSM/ODbL.
 * Matches the desktop trail editor's visual tone and the app's dark aesthetic.
 */
const DARK_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface MapInstanceCtx {
  map: MlMap | null;
  styleLoaded: boolean;
}

const MapInstanceContext = createContext<MapInstanceCtx>({ map: null, styleLoaded: false });

/**
 * Children of <MapCanvas> can call this to access the underlying MapLibre instance
 * (e.g. to add GeoJSON sources/layers). Returns null on the SVG fallback path.
 * `styleLoaded` flips to true once the basemap style has finished loading,
 * which is when sources/layers can be safely added.
 */
export function useMapInstance(): MapInstanceCtx {
  return useContext(MapInstanceContext);
}

/**
 * Real MapLibre basemap. Drop-in replacement for <TopoMap>.
 * If WebGL / style loading fails, falls back to the decorative SVG TopoMap.
 */
export function MapCanvas({
  children,
  center = HAYFORK,
  zoom = 13,
  variant = 'default',
  interactive = true,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MlMap | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Freeze initial params so the effect has stable [] deps and never re-initializes the map.
  const initial = useRef({ center, zoom, interactive });

  useEffect(() => {
    if (!containerRef.current) return;
    let m: MlMap | null = null;
    try {
      m = new maplibregl.Map({
        container: containerRef.current,
        style: DARK_STYLE_URL,
        center: initial.current.center,
        zoom: initial.current.zoom,
        attributionControl: false,
        interactive: initial.current.interactive,
      });
      // Set state so children rerender with the live map ref.
      setMap(m);
      m.once('load', () => {
        setStyleLoaded(true);
        m?.resize();
      });
    } catch {
      setFailed(true);
    }
    return () => {
      m?.remove();
      setMap(null);
      setStyleLoaded(false);
    };
  }, []);

  if (failed) {
    return <TopoMap variant={variant}>{children}</TopoMap>;
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: variant === 'satellite' ? '#1a2016' : '#12160F',
      }}
    >
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {/* Warm-tinted vignette keeps the app's visual identity over raw raster tiles */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at 30% 40%, rgba(18, 22, 15, 0) 45%, rgba(18, 22, 15, 0.55) 100%)',
        }}
      />
      <MapInstanceContext.Provider value={{ map, styleLoaded }}>
        {children}
      </MapInstanceContext.Provider>
    </div>
  );
}
