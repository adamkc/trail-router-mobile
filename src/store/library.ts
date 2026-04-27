import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChipTone } from '../components/Chip';
import { HAYFORK } from '../utils/geo';
import { useProjects } from './projects';

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
  /** IndexedDB id of an attached photo (PHOTO waypoints captured via the
   *  device camera). Lives in the `photos` IDB store, not in localStorage. */
  photoId?: string;
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
  /** Per-vertex elevation in meters; same length as `geo` when populated.
   *  Empty `[]` when unknown (legacy seed/migrated routes). When present,
   *  used as the source of truth for the elevation chart, gain calc, and
   *  grade analysis instead of the lower-resolution `spark` summary. */
  elevations: number[];
  /** Waypoints captured during recording or added later. */
  waypoints: RouteWaypoint[];
  /** Project this route belongs to (foreign key into useProjects). Defaults
   *  to 'hayfork' for the bundled data and any pre-multi-project entries
   *  via the v4→v5 migration. New routes recorded/imported under a
   *  different active project get that project's id. */
  projectId: string;
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

/** Input shape for addRoute — `id` is generated, `projectId` defaults to the
 *  active project from the projects store when not supplied. */
export type LibraryRouteInput = Omit<LibraryRoute, 'id' | 'projectId'> & { projectId?: string };

interface LibraryState {
  routes: LibraryRoute[];
  addRoute: (input: LibraryRouteInput) => LibraryRoute;
  /** Replace a route's geographic path (called by the editor on Save). */
  updateRouteGeo: (id: string, geo: Array<[number, number]>) => void;
  /** Rename a route in place (called from /details). */
  renameRoute: (id: string, name: string) => void;
  /** Remove a route. */
  removeRoute: (id: string) => void;
  /** Replace the entire route list (used when importing the Hayfork project). */
  replaceLibrary: (routes: LibraryRoute[]) => void;
  /** Update a waypoint's label in place (no-op if id missing or label blank). */
  renameWaypoint: (routeId: string, waypointId: string, label: string) => void;
  /** Drop a waypoint from a route; deletes any attached photo from IDB. */
  removeWaypoint: (routeId: string, waypointId: string) => void;
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

/** SEED_BASE entries declare the static fields; geo/elevations/waypoints/
 *  projectId are filled in by the SEED.map below so the data here stays
 *  readable. */
const SEED_BASE: Array<Omit<LibraryRoute, 'geo' | 'waypoints' | 'elevations' | 'projectId'>> = [
  { id: 'hayfork-loop',            name: 'Hayfork Loop',          km: '14.2', gain: '+640', grade: '6.1',  status: 'optimized', tag: 'blaze', spark: [420, 430, 480, 520, 580, 610, 640, 620, 560, 500, 440, 420] },
  { id: 'north-ridge-traverse',    name: 'North Ridge Traverse',  km: '8.7',  gain: '+390', grade: '7.4',  status: 'draft',     tag: null,    spark: [300, 320, 340, 380, 420, 440, 460, 450, 430, 400] },
  { id: 'clear-creek-connector',   name: 'Clear Creek Connector', km: '5.3',  gain: '+180', grade: '4.2',  status: 'built',     tag: 'good',  spark: [280, 290, 310, 330, 350, 360, 370, 370, 365, 355] },
  { id: 'manzanita-switchbacks',   name: 'Manzanita Switchbacks', km: '3.1',  gain: '+420', grade: '12.8', status: 'review',    tag: 'warn',  spark: [240, 260, 290, 320, 360, 400, 440, 480, 520, 560, 600, 650] },
  { id: 'meadow-cutoff',           name: 'Meadow Cutoff',         km: '2.4',  gain: '+95',  grade: '3.1',  status: 'built',     tag: 'good',  spark: [220, 222, 225, 230, 240, 245, 250, 255, 260, 265] },
];

const SEED: LibraryRoute[] = SEED_BASE.map((r) => {
  const geo = syntheticGeoFor(r.id, Math.max(8, r.spark.length));
  // Seed routes have no real elevations — the synthesized `spark` is used
  // for chart display until the user records a real route or imports the
  // Hayfork project (which fetches Open-Meteo elevations on import).
  return { ...r, geo, elevations: [], waypoints: syntheticWaypoints({ id: r.id, geo }), projectId: 'hayfork' };
});

export const useLibrary = create<LibraryState>()(
  persist(
    (set) => ({
      routes: SEED,
      addRoute: (input) => {
        const id = `${input.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`;
        // If the caller didn't specify a projectId, pin the route to the
        // currently-active project so recordings and imports stay scoped.
        const projectId = input.projectId || useProjects.getState().activeProjectId;
        const route: LibraryRoute = { ...input, id, projectId };
        set((s) => ({ routes: [route, ...s.routes] }));
        return route;
      },
      updateRouteGeo: (id, geo) => {
        set((s) => ({
          routes: s.routes.map((r) => (r.id === id ? { ...r, geo } : r)),
        }));
      },
      renameRoute: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          routes: s.routes.map((r) => (r.id === id ? { ...r, name: trimmed } : r)),
        }));
      },
      removeRoute: (id) => {
        // Best-effort cleanup of any IDB photo blobs attached to the
        // route's waypoints — fire-and-forget; failures don't block the
        // route deletion.
        const route = (useLibrary.getState().routes ?? []).find((r) => r.id === id);
        if (route) {
          for (const w of route.waypoints) {
            if (w.photoId) {
              import('../utils/photoStore').then(({ deletePhoto }) => deletePhoto(w.photoId!)).catch(() => {});
            }
          }
        }
        set((s) => ({ routes: s.routes.filter((r) => r.id !== id) }));
      },
      replaceLibrary: (routes) => {
        set({ routes });
      },
      renameWaypoint: (routeId, waypointId, label) => {
        const trimmed = label.trim();
        if (!trimmed) return;
        set((s) => ({
          routes: s.routes.map((r) => {
            if (r.id !== routeId) return r;
            return {
              ...r,
              waypoints: r.waypoints.map((w) =>
                w.id === waypointId ? { ...w, label: trimmed } : w,
              ),
            };
          }),
        }));
      },
      removeWaypoint: (routeId, waypointId) => {
        // Surface the photoId before mutating state so we can clean its blob.
        const route = useLibrary.getState().routes.find((r) => r.id === routeId);
        const wp = route?.waypoints.find((w) => w.id === waypointId);
        if (wp?.photoId) {
          import('../utils/photoStore').then(({ deletePhoto }) => deletePhoto(wp.photoId!)).catch(() => {});
        }
        set((s) => ({
          routes: s.routes.map((r) =>
            r.id === routeId
              ? { ...r, waypoints: r.waypoints.filter((w) => w.id !== waypointId) }
              : r,
          ),
        }));
      },
    }),
    {
      name: 'trail-router-library',
      // v1 → v2: added `geo`. v2 → v3: added `waypoints`. v3 → v4: added
      // `elevations`. v4 → v5: added `projectId` (multi-project support;
      // legacy entries belong to the bundled 'hayfork' project).
      version: 5,
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
        if (fromVersion < 4) {
          state.routes = state.routes.map((r) =>
            Array.isArray(r.elevations) ? r : { ...r, elevations: [] },
          );
        }
        if (fromVersion < 5) {
          state.routes = state.routes.map((r) =>
            r.projectId ? r : { ...r, projectId: 'hayfork' },
          );
        }
        return state;
      },
    },
  ),
);
