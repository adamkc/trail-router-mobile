import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapInstance } from './MapCanvas';

/** Plain colored dot at a lng/lat (start/end markers, waypoint base layer, etc). */
export function MapPin({
  coord,
  background,
  size = 14,
  ringOpacity = 0x33,
}: {
  coord: [number, number];
  background: string;
  size?: number;
  /** Hex byte (0-255) for the soft outer ring's alpha. Pass 0 to disable. */
  ringOpacity?: number;
}) {
  const { map } = useMapInstance();
  const ref = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    const el = document.createElement('div');
    const ring = ringOpacity > 0
      ? `box-shadow: 0 0 0 2px ${background}${ringOpacity.toString(16).padStart(2, '0')};`
      : '';
    el.style.cssText = `
      width: ${size}px; height: ${size}px; border-radius: 50%;
      background: ${background}; border: 2px solid #12160F; ${ring}
    `;
    const marker = new maplibregl.Marker({ element: el }).setLngLat(coord).addTo(map);
    ref.current = marker;
    return () => { marker.remove(); ref.current = null; };
  }, [map, background, size, ringOpacity]);

  useEffect(() => { ref.current?.setLngLat(coord); }, [coord[0], coord[1]]);
  return null;
}

/** Typed waypoint marker — circle with a single-letter glyph (W/H/V/P/C). */
export function MapWaypoint({
  coord,
  icon,
  color,
  size = 22,
}: {
  coord: [number, number];
  icon: string;
  color: string;
  size?: number;
}) {
  const { map } = useMapInstance();
  const ref = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <div style="position:absolute;inset:-4px;border-radius:50%;background:${color};opacity:0.25;"></div>
        <div style="position:absolute;inset:0;border-radius:50%;background:${color};border:1.5px solid #12160F;display:grid;place-items:center;font-family:var(--font-mono);font-size:10px;font-weight:700;color:#12160F;">${icon}</div>
      </div>
    `;
    const marker = new maplibregl.Marker({ element: el }).setLngLat(coord).addTo(map);
    ref.current = marker;
    return () => { marker.remove(); ref.current = null; };
  }, [map, icon, color, size]);

  useEffect(() => { ref.current?.setLngLat(coord); }, [coord[0], coord[1]]);
  return null;
}

/** Junction node — bone outline on a surface fill. */
export function MapJunction({ coord, size = 12 }: { coord: [number, number]; size?: number }) {
  const { map } = useMapInstance();
  const ref = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    const el = document.createElement('div');
    el.style.cssText = `
      width: ${size}px; height: ${size}px; border-radius: 50%;
      background: #262C22; border: 1.5px solid #E8E4D8;
    `;
    const marker = new maplibregl.Marker({ element: el }).setLngLat(coord).addTo(map);
    ref.current = marker;
    return () => { marker.remove(); ref.current = null; };
  }, [map, size]);

  useEffect(() => { ref.current?.setLngLat(coord); }, [coord[0], coord[1]]);
  return null;
}

/** Plain text label anchored to lng/lat — used for trail names on the network map. */
export function MapLabel({
  coord,
  text,
  color = '#BCB8AC',
  offset = [0, 0],
}: {
  coord: [number, number];
  text: string;
  color?: string;
  offset?: [number, number];
}) {
  const { map } = useMapInstance();
  const ref = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    if (!map) return;
    const el = document.createElement('div');
    el.style.cssText = `
      font-family: var(--font-mono);
      font-size: 9px;
      letter-spacing: 0.06em;
      color: ${color};
      white-space: nowrap;
      pointer-events: none;
      text-shadow: 0 0 4px #0a0d07, 0 0 4px #0a0d07;
    `;
    el.textContent = text;
    const marker = new maplibregl.Marker({ element: el, offset }).setLngLat(coord).addTo(map);
    ref.current = marker;
    return () => { marker.remove(); ref.current = null; };
  }, [map, text, color, offset[0], offset[1]]);
  useEffect(() => { ref.current?.setLngLat(coord); }, [coord[0], coord[1]]);
  return null;
}

/** Active vertex highlight (dashed ring + fill — used by Vertex Editor). */
export function MapActiveVertex({ coord, color = '#E88A3C' }: { coord: [number, number]; color?: string }) {
  const { map } = useMapInstance();
  const ref = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    if (!map) return;
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="position:relative;width:36px;height:36px;">
        <div style="position:absolute;inset:0;border-radius:50%;border:1.5px dashed ${color};opacity:0.85;"></div>
        <div style="position:absolute;left:9px;top:9px;width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #12160F;"></div>
      </div>
    `;
    const marker = new maplibregl.Marker({ element: el }).setLngLat(coord).addTo(map);
    ref.current = marker;
    return () => { marker.remove(); ref.current = null; };
  }, [map, color]);
  useEffect(() => { ref.current?.setLngLat(coord); }, [coord[0], coord[1]]);
  return null;
}

/** Fit the map's viewport to enclose all coords (called once when coords arrive). */
export function FitBoundsToCoords({
  coords,
  padding = 32,
  maxZoom = 17,
  duration = 0,
}: {
  coords: Array<[number, number]>;
  padding?: number;
  maxZoom?: number;
  duration?: number;
}) {
  const { map, styleLoaded } = useMapInstance();
  useEffect(() => {
    if (!map || !styleLoaded || coords.length < 2) return;
    let minLng = coords[0][0]; let maxLng = coords[0][0];
    let minLat = coords[0][1]; let maxLat = coords[0][1];
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
    }
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding, duration, maxZoom });
  }, [map, styleLoaded, coords, padding, maxZoom, duration]);
  return null;
}
