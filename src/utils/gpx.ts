/**
 * GPX 1.1 reader/writer for trail routes.
 *
 * GPX is the lingua franca for GPS apps (Garmin, Strava manual upload,
 * Komoot, Gaia GPS, etc). We write each route as a single <trk> with one
 * <trkseg>, plus per-route <wpt> entries for captured waypoints. The
 * reader pulls every <trk> as one route and concatenates multiple
 * <trkseg>s within a track. <ele> on each <trkpt> populates the route's
 * `elevations` array when present (most GPS exports include it).
 */

import { haversineKm } from '../store/recording';
import type { LibraryRoute, RouteStatus, RouteWaypoint, WaypointKind } from '../store/library';

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function waypointXml(w: RouteWaypoint): string {
  return [
    `  <wpt lat="${w.coord[1]}" lon="${w.coord[0]}">`,
    `    <name>${escape(w.label)}</name>`,
    `    <type>${w.type}</type>`,
    `    <sym>${w.icon}</sym>`,
    `  </wpt>`,
  ].join('\n');
}

function trackXml(r: LibraryRoute): string {
  const hasElev = r.elevations.length === r.geo.length && r.elevations.length > 0;
  const trkpts = r.geo
    .map((c, i) =>
      hasElev
        ? `      <trkpt lat="${c[1]}" lon="${c[0]}"><ele>${r.elevations[i]}</ele></trkpt>`
        : `      <trkpt lat="${c[1]}" lon="${c[0]}" />`,
    )
    .join('\n');
  return [
    `  <trk>`,
    `    <name>${escape(r.name)}</name>`,
    `    <type>${r.status}</type>`,
    `    <trkseg>`,
    trkpts,
    `    </trkseg>`,
    `  </trk>`,
  ].join('\n');
}

/** Map a GPX <type> string to one of our `RouteStatus` values. */
function statusFromType(raw: string | null): RouteStatus {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'optimized' || v === 'built' || v === 'draft' || v === 'review') return v;
  // Common GPX-in-the-wild types: "hiking", "running", "walking" → draft
  return 'draft';
}

/** Map a GPX <sym> or <type> hint to one of our WaypointKind enum values. */
function waypointKindFromHint(typeStr: string | null, symStr: string | null): WaypointKind {
  const v = `${typeStr ?? ''} ${symStr ?? ''}`.toLowerCase();
  if (v.includes('water') || v.includes('spring')) return 'WATER';
  if (v.includes('hazard') || v.includes('danger') || v.includes('warning')) return 'HAZARD';
  if (v.includes('vista') || v.includes('overlook') || v.includes('view'))   return 'VISTA';
  if (v.includes('camp')  || v.includes('bivy')  || v.includes('tent'))      return 'CAMP';
  return 'PHOTO';
}

const KIND_TO_GLYPH: Record<WaypointKind, RouteWaypoint['icon']> = {
  PHOTO: 'P', WATER: 'W', HAZARD: 'H', VISTA: 'V', CAMP: 'C',
};
const KIND_TO_COLOR: Record<WaypointKind, string> = {
  PHOTO:  'var(--good)',
  WATER:  'var(--topo)',
  HAZARD: 'var(--danger)',
  VISTA:  'var(--warn)',
  CAMP:   'var(--bone)',
};

/**
 * Parse a GPX 1.0/1.1 string into route candidates. Each <trk> becomes one
 * route (multiple <trkseg>s inside a <trk> are concatenated). Top-level
 * <wpt> entries are bucketed onto whichever track contains the nearest
 * vertex (within 100 m); orphan waypoints are dropped.
 */
export function parseGpxRoutes(text: string): Array<Omit<LibraryRoute, 'id'>> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid GPX: XML parse error');
  }

  const tracks = Array.from(doc.getElementsByTagName('trk'));
  const allWaypointEls = Array.from(doc.getElementsByTagName('wpt'));

  const routes: Array<Omit<LibraryRoute, 'id'>> = [];

  for (let ti = 0; ti < tracks.length; ti++) {
    const trk = tracks[ti];
    const name = trk.getElementsByTagName('name')[0]?.textContent?.trim() || `Imported track ${ti + 1}`;
    const status = statusFromType(trk.getElementsByTagName('type')[0]?.textContent ?? null);

    const segs = Array.from(trk.getElementsByTagName('trkseg'));
    const coords: Array<[number, number]> = [];
    const elevations: number[] = [];
    for (const seg of segs) {
      const pts = Array.from(seg.getElementsByTagName('trkpt'));
      for (const p of pts) {
        const lat = Number(p.getAttribute('lat'));
        const lon = Number(p.getAttribute('lon'));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        coords.push([lon, lat]);
        const ele = p.getElementsByTagName('ele')[0]?.textContent;
        const eleNum = ele !== undefined && ele !== null ? Number(ele) : NaN;
        if (Number.isFinite(eleNum)) elevations.push(Math.round(eleNum));
      }
    }
    if (coords.length < 2) continue;

    let km = 0;
    for (let i = 1; i < coords.length; i++) km += haversineKm(coords[i - 1], coords[i]);

    const fullElevations = elevations.length === coords.length ? elevations : [];
    let gain = 0;
    if (fullElevations.length >= 2) {
      for (let i = 1; i < fullElevations.length; i++) {
        const d = fullElevations[i] - fullElevations[i - 1];
        if (d > 0) gain += d;
      }
    }
    const grade = km > 0 && gain > 0 ? ((gain / 10) / km).toFixed(1) : '0.0';

    // Spark: downsample to 14 points for the small chart.
    const spark = (() => {
      const src = fullElevations.length >= 2 ? fullElevations : [];
      if (src.length === 0) return Array.from({ length: 14 }, (_, i) => 420 + Math.round(i * 5));
      if (src.length <= 14) return src.slice();
      const step = (src.length - 1) / 13;
      return Array.from({ length: 14 }, (_, i) => src[Math.round(i * step)]);
    })();

    // Bucket top-level <wpt>s onto this track if their nearest vertex is < 100 m.
    const waypoints: RouteWaypoint[] = [];
    for (let wi = 0; wi < allWaypointEls.length; wi++) {
      const w = allWaypointEls[wi];
      const lat = Number(w.getAttribute('lat'));
      const lon = Number(w.getAttribute('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      let best = Infinity;
      for (const c of coords) {
        const d = haversineKm([lon, lat], c) * 1000;
        if (d < best) best = d;
      }
      if (best > 100) continue;
      const wName = w.getElementsByTagName('name')[0]?.textContent?.trim() || 'Waypoint';
      const wType = w.getElementsByTagName('type')[0]?.textContent ?? null;
      const wSym  = w.getElementsByTagName('sym')[0]?.textContent ?? null;
      const kind = waypointKindFromHint(wType, wSym);
      waypoints.push({
        id: `gpx-wp-${ti}-${wi}`,
        type: kind,
        icon: KIND_TO_GLYPH[kind],
        color: KIND_TO_COLOR[kind],
        label: wName,
        t: '0:00',
        coord: [lon, lat],
      });
    }

    routes.push({
      name,
      km: km.toFixed(1),
      gain: `+${gain}`,
      grade,
      status,
      tag: status === 'optimized' ? 'blaze' : status === 'built' ? 'good' : null,
      spark,
      geo: coords,
      elevations: fullElevations,
      waypoints,
    });
  }

  return routes;
}

export function serializeRoutesToGpx(routes: LibraryRoute[]): string {
  const stamp = new Date().toISOString();
  const wpts = routes.flatMap((r) => r.waypoints).map(waypointXml).join('\n');
  const trks = routes.map(trackXml).join('\n');
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="Trail Router (adamkc/trail-router-mobile)"`,
    `     xmlns="http://www.topografix.com/GPX/1/1"`,
    `     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
    `     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`,
    `  <metadata>`,
    `    <name>Trail Router export</name>`,
    `    <time>${stamp}</time>`,
    `  </metadata>`,
    wpts,
    trks,
    `</gpx>`,
  ].filter(Boolean).join('\n');
}
