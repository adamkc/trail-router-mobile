import { create } from 'zustand';
import type { RouteStatus } from './library';
import { useProjects } from './projects';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'reviewing';
export type SaveStatus = 'draft' | 'built' | 'survey';
export type GpsState = 'unknown' | 'requesting' | 'tracking' | 'denied' | 'unavailable' | 'simulated';

export type WaypointKind = 'PHOTO' | 'WATER' | 'HAZARD' | 'VISTA' | 'CAMP';

export interface CapturedWaypoint {
  id: string;
  type: WaypointKind;
  icon: 'P' | 'W' | 'H' | 'V' | 'C';
  color: string;
  label: string;
  t: string;
  /** [lng, lat] of the point where the waypoint was captured. */
  coord: [number, number];
  /** IndexedDB id of an attached photo, when the user captured one. */
  photoId?: string;
}

export const WAYPOINT_TYPES: Array<{ kind: WaypointKind; icon: CapturedWaypoint['icon']; color: string; label: string }> = [
  { kind: 'WATER',  icon: 'W', color: 'var(--topo)',   label: 'Water'  },
  { kind: 'HAZARD', icon: 'H', color: 'var(--danger)', label: 'Hazard' },
  { kind: 'VISTA',  icon: 'V', color: 'var(--warn)',   label: 'Vista'  },
  { kind: 'PHOTO',  icon: 'P', color: 'var(--good)',   label: 'Photo'  },
  { kind: 'CAMP',   icon: 'C', color: 'var(--bone)',   label: 'Camp'   },
];

interface RecordingState {
  status: RecordingStatus;
  elapsed: number;
  /** km, accumulated via Haversine over the geo track. */
  distance: number;
  /** meters, summed positive elevation deltas. */
  gain: number;
  currentGrade: number;
  targetGrade: number;
  /** Real geographic track [lng, lat][] — what gets drawn on the map and saved to the library. */
  geoTrack: Array<[number, number]>;
  /** Last known fix elevation (meters) — used to compute gain across ticks. */
  lastElev: number | null;
  capturedWaypoints: CapturedWaypoint[];
  draftName: string;
  draftSaveStatus: SaveStatus;
  gps: GpsState;
  /** Route the user is following (set by RecordScreen when `?follow=<id>` is
   *  on the URL). RecordReview reads this to log a visit against the route. */
  followingRouteId: string | null;
  setFollowingRouteId: (id: string | null) => void;

  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Append a fix from navigator.geolocation (or a simulator). */
  pushFix: (lng: number, lat: number, elev: number | null, accuracy?: number) => void;
  /** Bump the elapsed counter by one second. Called by the screen's 1Hz interval. */
  bumpElapsed: () => void;
  /** Capture a waypoint of a given type at the current GPS position.
   *  `photoId` (optional) attaches a previously-saved photo from photoStore. */
  addWaypointOfType: (kind: WaypointKind, label?: string, photoId?: string) => void;
  /** Drop a waypoint at an explicit [lng, lat] (used by long-press on the
   *  map). Bypasses the GPS-fix fallback in addWaypointOfType. */
  addWaypointAt: (kind: WaypointKind, coord: [number, number], label?: string, photoId?: string) => void;
  addWaypoint: () => void;
  stop: () => void;
  discard: () => void;
  setGpsState: (g: GpsState) => void;
  setDraftName: (n: string) => void;
  setDraftSaveStatus: (s: SaveStatus) => void;
  /** Load a manually-plotted route (from Network Map plot mode) into the
   *  store as if it had been recorded, then move into the reviewing state
   *  so /review can name + save it through the existing flow. */
  loadPlotted: (coords: Array<[number, number]>, suggestedName?: string) => void;
}

/** Fallback coord for a waypoint captured before the GPS has produced any
 *  fix — uses the currently-active project's center rather than a stale
 *  hardcoded value. Looked up at call time so a project switch updates it. */
function fallbackCoord(): [number, number] {
  return useProjects.getState().projects.find(
    (p) => p.id === useProjects.getState().activeProjectId,
  )?.center ?? [-123.0809, 40.7137];
}


const formatT = (elapsed: number): string => {
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** Haversine distance in km between two [lng, lat] points. */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const initialState = () => ({
  status: 'idle' as RecordingStatus,
  elapsed: 0,
  distance: 0,
  gain: 0,
  currentGrade: 0,
  targetGrade: 7,
  geoTrack: [] as Array<[number, number]>,
  lastElev: null as number | null,
  capturedWaypoints: [] as CapturedWaypoint[],
  // Stamp the new draft with a date so the user immediately knows which
  // recording it is in the library if they save without renaming.
  draftName: `Recording — ${new Date().toISOString().slice(0, 10)}`,
  draftSaveStatus: 'draft' as SaveStatus,
  gps: 'unknown' as GpsState,
  followingRouteId: null as string | null,
});

export const useRecording = create<RecordingState>((set) => ({
  ...initialState(),

  start: () =>
    set(() => ({
      ...initialState(),
      status: 'recording',
    })),

  pause: () => set({ status: 'paused' }),
  resume: () => set({ status: 'recording' }),

  pushFix: (lng, lat, elev) =>
    set((s) => {
      if (s.status !== 'recording') return s;
      const next: [number, number] = [lng, lat];
      const prev = s.geoTrack[s.geoTrack.length - 1];

      // Distance: cumulative Haversine.
      const distance = prev
        ? Number((s.distance + haversineKm(prev, next)).toFixed(3))
        : 0;

      // Gain: only accumulate positive elevation deltas (climbs).
      let gain = s.gain;
      let currentGrade = s.currentGrade;
      if (elev != null && s.lastElev != null) {
        const dElev = elev - s.lastElev;
        if (dElev > 0) gain = Math.round(gain + dElev);
        // Grade % = rise/run × 100. Need a horizontal delta to compute.
        if (prev) {
          const segKm = haversineKm(prev, next);
          if (segKm > 0.001) {
            currentGrade = Number(((dElev / (segKm * 1000)) * 100).toFixed(1));
          }
        }
      }

      return {
        geoTrack: [...s.geoTrack, next],
        distance,
        gain,
        currentGrade,
        lastElev: elev ?? s.lastElev,
      };
    }),

  bumpElapsed: () =>
    set((s) => (s.status === 'recording' ? { elapsed: s.elapsed + 1 } : s)),

  addWaypointOfType: (kind, label, photoId) =>
    set((s) => {
      const template = WAYPOINT_TYPES.find((t) => t.kind === kind) ?? WAYPOINT_TYPES[0];
      const at: [number, number] = s.geoTrack[s.geoTrack.length - 1] ?? fallbackCoord();
      const next: CapturedWaypoint = {
        id: `wp-${s.capturedWaypoints.length + 1}`,
        type: template.kind,
        icon: template.icon,
        color: template.color,
        label: label?.trim() || template.label,
        t: formatT(s.elapsed),
        coord: at,
        photoId,
      };
      return { capturedWaypoints: [...s.capturedWaypoints, next] };
    }),

  addWaypointAt: (kind, coord, label, photoId) =>
    set((s) => {
      const template = WAYPOINT_TYPES.find((t) => t.kind === kind) ?? WAYPOINT_TYPES[0];
      const next: CapturedWaypoint = {
        id: `wp-${s.capturedWaypoints.length + 1}`,
        type: template.kind,
        icon: template.icon,
        color: template.color,
        label: label?.trim() || template.label,
        t: formatT(s.elapsed),
        coord,
        photoId,
      };
      return { capturedWaypoints: [...s.capturedWaypoints, next] };
    }),

  addWaypoint: () => {
    // Legacy: cycle through types so callers without a picker still produce
    // varied output. New code should use addWaypointOfType().
    const len = (useRecording.getState().capturedWaypoints?.length ?? 0);
    useRecording.getState().addWaypointOfType(WAYPOINT_TYPES[len % WAYPOINT_TYPES.length].kind);
  },

  stop: () => set({ status: 'reviewing' }),
  discard: () => set(initialState()),

  setGpsState: (gps) => set({ gps }),
  setFollowingRouteId: (followingRouteId) => set({ followingRouteId }),
  setDraftName: (draftName) => set({ draftName }),
  setDraftSaveStatus: (draftSaveStatus) => set({ draftSaveStatus }),

  loadPlotted: (coords, suggestedName) => {
    if (coords.length < 2) return;
    // Distance: cumulative Haversine.
    let distance = 0;
    for (let i = 1; i < coords.length; i++) distance += haversineKm(coords[i - 1], coords[i]);
    set({
      ...initialState(),
      status: 'reviewing',
      geoTrack: coords,
      distance: Number(distance.toFixed(3)),
      // No real GPS / elevation data for a plotted trail — stays at 0 unless a
      // future enhancement reads DEM tiles to backfill elevation.
      gain: 0,
      currentGrade: 0,
      gps: 'simulated',
      draftName: suggestedName ?? `Plotted route — ${new Date().toISOString().slice(5, 16).replace('T', ' ')}`,
    });
  },
}));

/** Map the draft save status onto the library route status + tag for list rendering. */
export function draftSaveStatusToRoute(s: SaveStatus): { status: RouteStatus; tag: 'blaze' | 'good' | 'warn' | null } {
  switch (s) {
    case 'built':  return { status: 'built',  tag: 'good' };
    case 'survey': return { status: 'review', tag: 'warn' };
    case 'draft':
    default:       return { status: 'draft',  tag: null   };
  }
}
