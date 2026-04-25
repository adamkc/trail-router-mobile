import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChipTone } from '../components/Chip';
import { HAYFORK } from '../utils/geo';

export type RouteStatus = 'optimized' | 'draft' | 'built' | 'review';

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

const SEED_BASE: Array<Omit<LibraryRoute, 'geo'>> = [
  { id: 'hayfork-loop',            name: 'Hayfork Loop',          km: '14.2', gain: '+640', grade: '6.1',  status: 'optimized', tag: 'blaze', spark: [420, 430, 480, 520, 580, 610, 640, 620, 560, 500, 440, 420] },
  { id: 'north-ridge-traverse',    name: 'North Ridge Traverse',  km: '8.7',  gain: '+390', grade: '7.4',  status: 'draft',     tag: null,    spark: [300, 320, 340, 380, 420, 440, 460, 450, 430, 400] },
  { id: 'clear-creek-connector',   name: 'Clear Creek Connector', km: '5.3',  gain: '+180', grade: '4.2',  status: 'built',     tag: 'good',  spark: [280, 290, 310, 330, 350, 360, 370, 370, 365, 355] },
  { id: 'manzanita-switchbacks',   name: 'Manzanita Switchbacks', km: '3.1',  gain: '+420', grade: '12.8', status: 'review',    tag: 'warn',  spark: [240, 260, 290, 320, 360, 400, 440, 480, 520, 560, 600, 650] },
  { id: 'meadow-cutoff',           name: 'Meadow Cutoff',         km: '2.4',  gain: '+95',  grade: '3.1',  status: 'built',     tag: 'good',  spark: [220, 222, 225, 230, 240, 245, 250, 255, 260, 265] },
];

const SEED: LibraryRoute[] = SEED_BASE.map((r) => ({
  ...r,
  geo: syntheticGeoFor(r.id, Math.max(8, r.spark.length)),
}));

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
      // Bumped from 1 → 2 because the schema added a `geo` field. Old persisted
      // entries don't have it; the migrate step backfills synthetic geometry.
      version: 2,
      partialize: (state) => ({ routes: state.routes }),
      migrate: (persisted, fromVersion) => {
        const state = persisted as { routes?: LibraryRoute[] } | undefined;
        if (!state?.routes) return { routes: SEED };
        if (fromVersion < 2) {
          state.routes = state.routes.map((r) =>
            r.geo && r.geo.length >= 2 ? r : { ...r, geo: syntheticGeoFor(r.id, Math.max(8, r.spark?.length ?? 10)) },
          );
        }
        return state;
      },
    },
  ),
);
