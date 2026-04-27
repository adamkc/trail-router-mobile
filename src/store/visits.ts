import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Visit {
  id: string;
  /** Route the user followed (when ?follow=<id> was set on /record). */
  routeId: string;
  /** Project the followed route belongs to — denormalized for cheap filtering. */
  projectId: string;
  /** Epoch ms the recording session ended (saved). */
  recordedAt: number;
  /** Cached stats so the detail page can render without re-walking the route. */
  distanceKm: number;
  durationSec: number;
  gainM: number;
  /** IndexedDB ids of photos captured during this visit (subset of the
   *  saved-route's waypoints). Lets the detail page show "X visits · Y
   *  photos" without scanning waypoint arrays. */
  photoIds: string[];
}

interface VisitsState {
  visits: Visit[];
  /** Append a visit to the log. */
  logVisit: (v: Omit<Visit, 'id'>) => Visit;
  /** Drop visits for a route (called when the route is removed). */
  removeVisitsForRoute: (routeId: string) => void;
  /** Drop visits for a project (called when the project is removed). */
  removeVisitsForProject: (projectId: string) => void;
}

export const useVisits = create<VisitsState>()(
  persist(
    (set) => ({
      visits: [],
      logVisit: (input) => {
        const id = `vis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const visit: Visit = { ...input, id };
        set((s) => ({ visits: [visit, ...s.visits] }));
        return visit;
      },
      removeVisitsForRoute: (routeId) =>
        set((s) => ({ visits: s.visits.filter((v) => v.routeId !== routeId) })),
      removeVisitsForProject: (projectId) =>
        set((s) => ({ visits: s.visits.filter((v) => v.projectId !== projectId) })),
    }),
    { name: 'trail-router-visits', version: 1 },
  ),
);

// Selector helpers intentionally avoid returning derived arrays from inside a
// zustand selector — that produces a fresh reference each call and trips
// React 18's "result of getSnapshot should be cached" infinite loop. Callers
// should select the raw `visits` array via useVisits and filter in a
// useMemo. The compact selector below is fine because it just reads a stable
// slice.
export const selectAllVisits = (s: VisitsState) => s.visits;
