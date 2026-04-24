import { create } from 'zustand';
import type { RouteStatus } from './library';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'reviewing';
export type SaveStatus = 'draft' | 'built' | 'survey';

export interface CapturedWaypoint {
  id: string;
  type: 'PHOTO' | 'WATER' | 'HAZARD' | 'VISTA' | 'CAMP';
  icon: 'P' | 'W' | 'H' | 'V' | 'C';
  color: string;
  label: string;
  t: string;
}

interface RecordingState {
  status: RecordingStatus;
  elapsed: number;
  distance: number;
  gain: number;
  currentGrade: number;
  targetGrade: number;
  track: Array<[number, number]>;
  capturedWaypoints: CapturedWaypoint[];
  draftName: string;
  draftSaveStatus: SaveStatus;

  start: () => void;
  pause: () => void;
  resume: () => void;
  tick: () => void;
  addWaypoint: () => void;
  stop: () => void;
  discard: () => void;
  setDraftName: (n: string) => void;
  setDraftSaveStatus: (s: SaveStatus) => void;
}

const INITIAL_TRACK: Array<[number, number]> = [
  [40, 480], [70, 460], [100, 440], [130, 430], [160, 415], [195, 405], [220, 395],
];

const WAYPOINT_TEMPLATES: Omit<CapturedWaypoint, 'id' | 't'>[] = [
  { type: 'PHOTO',  icon: 'P', color: 'var(--topo)',   label: 'Creek crossing'      },
  { type: 'WATER',  icon: 'W', color: 'var(--topo)',   label: 'Spring — perennial?' },
  { type: 'HAZARD', icon: 'H', color: 'var(--danger)', label: 'Loose scree'         },
  { type: 'VISTA',  icon: 'V', color: 'var(--warn)',   label: 'Ridge overlook'      },
];

const formatT = (elapsed: number): string => {
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const initialState = () => ({
  status: 'idle' as RecordingStatus,
  elapsed: 0,
  distance: 0,
  gain: 0,
  currentGrade: 0,
  targetGrade: 7,
  track: [] as Array<[number, number]>,
  capturedWaypoints: [] as CapturedWaypoint[],
  draftName: 'Hayfork Loop — Leg 2',
  draftSaveStatus: 'draft' as SaveStatus,
});

export const useRecording = create<RecordingState>((set) => ({
  ...initialState(),

  start: () =>
    set(() => ({
      ...initialState(),
      status: 'recording',
      track: [INITIAL_TRACK[0]],
    })),

  pause: () => set({ status: 'paused' }),
  resume: () => set({ status: 'recording' }),

  tick: () =>
    set((s) => {
      if (s.status !== 'recording') return s;
      const nextElapsed = s.elapsed + 1;
      const pointIdx = Math.min(Math.floor(nextElapsed / 3), INITIAL_TRACK.length - 1);
      const track = INITIAL_TRACK.slice(0, pointIdx + 1);
      const distance = Number((nextElapsed * 0.0017).toFixed(2));
      const gain = Math.floor(nextElapsed * 0.1);
      const currentGrade = Math.min(12, 4 + Math.sin(nextElapsed / 7) * 6);
      return {
        elapsed: nextElapsed,
        track,
        distance,
        gain,
        currentGrade: Number(currentGrade.toFixed(1)),
      };
    }),

  addWaypoint: () =>
    set((s) => {
      const template = WAYPOINT_TEMPLATES[s.capturedWaypoints.length % WAYPOINT_TEMPLATES.length];
      const next: CapturedWaypoint = {
        ...template,
        id: `wp-${s.capturedWaypoints.length + 1}`,
        t: formatT(s.elapsed),
      };
      return { capturedWaypoints: [...s.capturedWaypoints, next] };
    }),

  stop: () => set({ status: 'reviewing' }),
  discard: () => set(initialState()),

  setDraftName: (draftName) => set({ draftName }),
  setDraftSaveStatus: (draftSaveStatus) => set({ draftSaveStatus }),
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
