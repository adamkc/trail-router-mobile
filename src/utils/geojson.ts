/**
 * GeoJSON I/O for trail routes.
 *
 * Reads `Feature<LineString>` and `Feature<MultiLineString>` (and bare
 * `LineString` features inside a `FeatureCollection`) into the same shape the
 * library stores. Writes back as a `FeatureCollection<LineString>` using the
 * library route fields as feature properties — round-trips cleanly through
 * any GeoJSON consumer (Strava, AllTrails, iD editor, QGIS, geojson.io).
 */

import { haversineKm } from '../store/recording';
import type { LibraryRoute, RouteStatus } from '../store/library';
import type { ChipTone } from '../components/Chip';

type Coord = [number, number];

interface FeatureLike {
  type?: string;
  geometry?: { type: string; coordinates: unknown };
  properties?: Record<string, unknown> | null;
}

/** Parse a GeoJSON string into a list of route candidates ready for addRoute(). */
export function parseGeoJsonRoutes(text: string): Array<Omit<LibraryRoute, 'id'>> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`);
  }

  // Accept FeatureCollection, single Feature, or bare Geometry.
  const features: FeatureLike[] = (() => {
    const j = json as { type?: string; features?: FeatureLike[] };
    if (j?.type === 'FeatureCollection' && Array.isArray(j.features)) return j.features;
    if (j?.type === 'Feature') return [j as FeatureLike];
    if (j?.type === 'LineString' || j?.type === 'MultiLineString') {
      return [{ type: 'Feature', geometry: j as FeatureLike['geometry'], properties: {} }];
    }
    return [];
  })();

  const routes: Array<Omit<LibraryRoute, 'id'>> = [];
  for (const f of features) {
    const geom = f.geometry;
    if (!geom) continue;

    const lineStrings: Coord[][] = (() => {
      if (geom.type === 'LineString') return [geom.coordinates as Coord[]];
      if (geom.type === 'MultiLineString') return geom.coordinates as Coord[][];
      return [];
    })();

    for (const line of lineStrings) {
      if (line.length < 2) continue;
      // Defensive: keep only [lng, lat] pairs (drop optional elevation/time as 3rd+ items).
      const coords: Coord[] = line.map((c) => [Number(c[0]), Number(c[1])]);

      // Accumulate km via Haversine. Climb/grade aren't reliably present in
      // generic GeoJSON, so default to 0 (the user can still see the line).
      let km = 0;
      for (let i = 1; i < coords.length; i++) km += haversineKm(coords[i - 1], coords[i]);

      const props = (f.properties ?? {}) as Record<string, unknown>;
      const name = String(props.name ?? props.title ?? 'Imported route');
      const elevs: number[] = Array.isArray(props.elev) ? (props.elev as number[]) : [];
      const status = (() => {
        const s = String(props.status ?? '').toLowerCase();
        if (s === 'optimized' || s === 'built' || s === 'draft' || s === 'review') return s as RouteStatus;
        return 'draft';
      })();
      const tag = (() => {
        const t = String(props.tag ?? '').toLowerCase();
        if (t === 'blaze' || t === 'good' || t === 'warn' || t === 'topo' || t === 'danger' || t === 'neutral') return t as ChipTone;
        return null;
      })();

      // Synthetic spark: if no elev provided, fall back to a slightly varying
      // ramp (so the elevation chart isn't a flat line).
      const fallbackSpark = (() => {
        const n = Math.max(8, Math.min(coords.length, 20));
        return Array.from({ length: n }, (_, i) => Math.round(420 + (i * 30) / n + Math.sin(i / 3) * 6));
      })();

      routes.push({
        name,
        km: km.toFixed(1),
        gain: typeof props.gain === 'string' || typeof props.gain === 'number' ? `+${props.gain}` : '+0',
        grade: typeof props.grade === 'string' || typeof props.grade === 'number' ? String(props.grade) : '0.0',
        status,
        tag,
        spark: elevs.length >= 2 ? elevs : fallbackSpark,
        geo: coords,
      });
    }
  }
  return routes;
}

/** Serialize one or more LibraryRoute objects to a GeoJSON FeatureCollection. */
export function serializeRoutesToGeoJson(routes: LibraryRoute[]): string {
  const features = routes.map((r) => ({
    type: 'Feature' as const,
    properties: {
      id: r.id,
      name: r.name,
      status: r.status,
      tag: r.tag,
      km: r.km,
      gain: r.gain,
      grade: r.grade,
      // Embed elevation as a custom property — non-standard but useful round-trip.
      elev: r.spark,
    },
    geometry: {
      type: 'LineString' as const,
      coordinates: r.geo,
    },
  }));
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}

/** Trigger a browser download for a string blob with the given filename. */
export function downloadString(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Open the OS file picker; resolve with the chosen file's text content (or null if cancelled). */
export function pickJsonFile(accept = '.geojson,.json,application/geo+json,application/json'): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      file.text().then((text) => resolve({ name: file.name, text })).catch(() => resolve(null));
    };
    document.body.appendChild(input);
    input.click();
    setTimeout(() => document.body.removeChild(input), 1000);
  });
}
