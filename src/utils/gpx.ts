/**
 * GPX 1.1 serializer for trail routes.
 *
 * GPX is the lingua franca for GPS apps (Garmin, Strava manual upload,
 * Komoot, Gaia GPS, etc). We write each route as a single <trk> with one
 * <trkseg>, plus per-route <wpt> entries for captured waypoints.
 */

import type { LibraryRoute, RouteWaypoint } from '../store/library';

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
  const trkpts = r.geo
    .map((c) => `      <trkpt lat="${c[1]}" lon="${c[0]}" />`)
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
