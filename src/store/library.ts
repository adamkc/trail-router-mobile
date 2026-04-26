import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChipTone } from '../components/Chip';
import { HAYFORK } from '../utils/geo';

export type RouteStatus = 'optimized' | 'draft' | 'built' | 'review';

export type WaypointKind = 'PHOTO' | 'WATER' | 'HAZARD' | 'VISTA' | 'CAMP';

export interface RouteWaypoint {
  id: string;
  type: WaypointKind;
  /** Single-letter glyph rendered on map markers + lists. */
  icon: 'P' | 'W' | 'H' | 'V' | 'C';
  /** CSS color string (token reference is fine — resolved at render). */
  color: string;
  label: string;
  /** Stamp from when the waypoint was captured: "0:14" relative or "APR 25". */
  t: string;
  coord: [number, number];
}

export interface LibraryRoute {
  id: string;
  name: string;
  km: string;
  gain: string;
  grade: string;
  status: RouteStatus;
  tag: ChipTone | null;
  spark: number[];
  /** Geographic [lng, lat] line. Recordings store their captured GPS path here;
   *  seed routes get a procedurally synthesized path around Hayfork. */
  geo: Array<[number, number]>;
  /** Waypoints captured during recording or added later. */
  waypoints: RouteWaypoint[];
}

/** Synthetic waypoints sprinkled along a seed route — gives the demo something
 *  to show on the map + waypoint screens before the user records anything. */
function syntheticWaypoints(route: { id: string; geo: Array<[number, number]> }): RouteWaypoint[] {
  if (route.geo.length < 4) return [];
  // Hash the id so each route gets a stable but distinct starting offset, then
  // step by 7 across the templates list to vary types within a single route.
  let h = 0;
  for (let i = 0; i < route.id.length; i++) h = (Math.imul(31, h) + route.id.charCodeAt(i)) | 0;
  const templates: Array<{ kind: WaypointKind; icon: RouteWaypoint['icon']; color: string; label: string }> = [
    { kind: 'WATER',  icon: 'W', color: 'var(--topo)',   label: 'Spring crossing'  },
    { kind: 'HAZARD', icon: 'H', color: 'var(--danger)', label: 'Loose scree'      },
    { kind: 'VISTA',  icon: 'V', color: 'var(--warn)',   label: 'Ridge overlook'   },
    { kind: 'PHOTO',  icon: 'P', color: 'var(--good)',   label: 'Fallen oak'       },
    { kind: 'CAMP',   icon: 'C', color: 'var(--bone)',   label: 'Bivy spot'        },
  ];
  const count = Math.min(3, Math.max(1, Math.floor(route.geo.length / 4)));
  const out: RouteWaypoint[] = [];
  for (let i = 0; i < count; i++) {
    const t = templates[Math.abs(h + i * 7) % templates.length];
    const idx = Math.min(route.geo.length - 1, Math.floor(((i + 1) / (count + 1)) * route.geo.length));
    out.push({
      id: `${route.id}-wp-${i + 1}`,
      type: t.kind,
      icon: t.icon,
      color: t.color,
      label: t.label,
      t: `${i + 1}:00`,
      coord: route.geo[idx],
    });
  }
  return out;
}

interface LibraryState {
  routes: LibraryRoute[];
  addRoute: (input: Omit<LibraryRoute, 'id'>) => LibraryRoute;
  /** Replace a route's geographic path (called by the editor on Save). */
  updateRouteGeo: (id: string, geo: Array<[number, number]>) => void;
}

/** Stable hash → seeded PRNG so each named route always gets the same shape. */
function syntheticGeoFor(name: string, segments = 12): Array<[number, number]> {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  const rand = () => {
    h = (h + 0x6D2B79F5) | 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Each route starts at a distinct offset around Hayfork, then walks ~30m per
  // segment in a meandering arc — enough to look like a real trail at z14.
  const startLng = HAYFORK[0] + (rand() - 0.5) * 0.012;
  const startLat = HAYFORK[1] + (rand() - 0.5) * 0.008;
  const baseHeading = rand() * Math.PI * 2;
  const pts: Array<[number, number]> = [[startLng, startLat]];
  for (let i = 1; i < segments; i++) {
    const last = pts[i - 1];
    const heading = baseHeading + (rand() - 0.5) * 1.4 * (i / segments);
    const stepLng = Math.cos(heading) * 0.0006;
    const stepLat = Math.sin(heading) * 0.0005;
    pts.push([last[0] + stepLng, last[1] + stepLat]);
  }
  return pts;
}

const SEED_BASE: Array<Omit<LibraryRoute, 'geo' | 'waypoints'>> = [
  { id: 'hayfork-loop',            name: 'Hayfork Loop',          km: '14.2', gain: '+640', grade: '6.1',  status: 'optimized', tag: 'blaze', spark: [420, 430, 480, 520, 580, 610, 640, 620, 560, 500, 440, 420] },
  { id: 'north-ridge-traverse',    name: 'North Ridge Traverse',  km: '8.7',  gain: '+390', grade: '7.4',  status: 'draft',     tag: null,    spark: [300, 320, 340, 380, 420, 440, 460, 450, 430, 400] },
  { id: 'clear-creek-connector',   name: 'Clear Creek Connector', km: '5.3',  gain: '+180', grade: '4.2',  status: 'built',     tag: 'good',  spark: [280, 290, 310, 330, 350, 360, 370, 370, 365, 355] },
  { id: 'manzanita-switchbacks',   name: 'Manzanita Switchbacks', km: '3.1',  gain: '+420', grade: '12.8', status: 'review',    tag: 'warn',  spark: [240, 260, 290, 320, 360, 400, 440, 480, 520, 560, 600, 650] },
  { id: 'meadow-cutoff',           name: 'Meadow Cutoff',         km: '2.4',  gain: '+95',  grade: '3.1',  status: 'built',     tag: 'good',  spark: [220, 222, 225, 230, 240, 245, 250, 255, 260, 265] },
];

const SEED: LibraryRoute[] = SEED_BASE.map((r) => {
  const geo = syntheticGeoFor(r.id, Math.max(8, r.spark.length));
  return { ...r, geo, waypoints: syntheticWaypoints({ id: r.id, geo }) };
});

export const useLibrary = create<LibraryState>()(
  persist(
    (set) => ({
      routes: SEED,
      addRoute: (input) => {
        const id = `${input.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`;
        const route: LibraryRoute = { ...input, id };
        set((s) => ({ routes: [route, ...s.routes] }));
        return route;
      },
      updateRouteGeo: (id, geo) => {
        set((s) => ({
          routes: s.routes.map((r) => (r.id === id ? { ...r, geo } : r)),
        }));
      },
    }),
    {
      name: 'trail-router-library',
      // v1 → v2: added `geo` field. v2 → v3: added `waypoints` field.
      // Migrate backfills both for any older persisted entries.
      version: 3,
      partialize: (state) => ({ routes: state.routes }),
      migrate: (persisted, fromVersion) => {
        const state = persisted as { routes?: LibraryRoute[] } | undefined;
        if (!state?.routes) return { routes: SEED };
        if (fromVersion < 2) {
          state.routes = state.routes.map((r) =>
            r.geo && r.geo.length >= 2 ? r : { ...r, geo: syntheticGeoFor(r.id, Math.max(8, r.spark?.length ?? 10)) },
          );
        }
        if (fromVersion < 3) {
          state.routes = state.routes.map((r) =>
            Array.isArray(r.waypoints) ? r : { ...r, waypoints: syntheticWaypoints({ id: r.id, geo: r.geo }) },
          );
        }
        return state;
      },
    },
  ),
);
