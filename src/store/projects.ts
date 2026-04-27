import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HAYFORK, HAYFORK_BOUNDS } from '../utils/geo';

export interface Project {
  id: string;
  name: string;
  subtitle: string;
  /** Map center [lng, lat] used as the default camera anchor. */
  center: [number, number];
  /** West/east/south/north — used to fit-bounds and validate hillshade. */
  bounds: { west: number; east: number; south: number; north: number };
  /** When true, the bundled Hayfork hillshade overlay is available; the
   *  MapHillshade component renders only when this is on AND the user's
   *  hillshade preference toggle is on. Other projects show no overlay. */
  hasHillshade: boolean;
  /** Epoch ms when the project was created (or auto-imported). */
  createdAt: number;
}

const HAYFORK_PROJECT: Project = {
  id: 'hayfork',
  name: 'Hayfork',
  subtitle: 'Trinity County · Public works',
  center: HAYFORK,
  bounds: HAYFORK_BOUNDS,
  hasHillshade: true,
  createdAt: 0, // sentinel: bundled
};

interface ProjectsState {
  projects: Project[];
  activeProjectId: string;
  setActive: (id: string) => void;
  /** Add a new project; if the id already exists the existing record is
   *  preserved (but `name`/`subtitle`/`bounds`/`center` get refreshed so a
   *  re-import can update metadata without orphaning routes). */
  addProject: (p: Project) => void;
  removeProject: (id: string) => void;
  /** Rename a project in place. No-op if id missing or name blank. */
  renameProject: (id: string, name: string, subtitle?: string) => void;
}

export const useProjects = create<ProjectsState>()(
  persist(
    (set) => ({
      projects: [HAYFORK_PROJECT],
      activeProjectId: HAYFORK_PROJECT.id,
      setActive: (id) =>
        set((s) => (s.projects.some((p) => p.id === id) ? { activeProjectId: id } : s)),
      addProject: (p) =>
        set((s) => {
          const existing = s.projects.findIndex((q) => q.id === p.id);
          if (existing === -1) {
            return { projects: [...s.projects, p], activeProjectId: p.id };
          }
          const next = s.projects.slice();
          next[existing] = { ...next[existing], ...p };
          return { projects: next, activeProjectId: p.id };
        }),
      removeProject: (id) =>
        set((s) => {
          if (id === HAYFORK_PROJECT.id) return s; // bundled project is permanent
          const projects = s.projects.filter((p) => p.id !== id);
          const activeProjectId =
            s.activeProjectId === id ? HAYFORK_PROJECT.id : s.activeProjectId;
          return { projects, activeProjectId };
        }),
      renameProject: (id, name, subtitle) =>
        set((s) => {
          const trimmed = name.trim();
          if (!trimmed) return s;
          const idx = s.projects.findIndex((p) => p.id === id);
          if (idx === -1) return s;
          const next = s.projects.slice();
          next[idx] = {
            ...next[idx],
            name: trimmed,
            ...(subtitle !== undefined ? { subtitle: subtitle.trim() || next[idx].subtitle } : {}),
          };
          return { projects: next };
        }),
    }),
    {
      name: 'trail-router-projects',
      version: 1,
      // v0 storage didn't exist — projects launched at v1. No migration yet.
    },
  ),
);

/** Convenience selector — returns the active Project record, or the bundled
 *  Hayfork as a safe fallback if the persisted activeProjectId went stale. */
export function useActiveProject(): Project {
  return useProjects(
    (s) =>
      s.projects.find((p) => p.id === s.activeProjectId) ??
      s.projects[0] ??
      HAYFORK_PROJECT,
  );
}

/**
 * Compute a project's centroid + bounds from a list of route coordinates.
 * Used when the user imports a GeoJSON as a new project — gives us a
 * sensible camera anchor and bounding box without per-feature metadata.
 */
export function projectExtentsFromRoutes(
  routesCoords: Array<Array<[number, number]>>,
): { center: [number, number]; bounds: Project['bounds'] } | null {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const coords of routesCoords) {
    for (const c of coords) {
      if (c[0] < minLng) minLng = c[0];
      if (c[0] > maxLng) maxLng = c[0];
      if (c[1] < minLat) minLat = c[1];
      if (c[1] > maxLat) maxLat = c[1];
    }
  }
  if (!Number.isFinite(minLng)) return null;
  return {
    center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
    bounds: { west: minLng, east: maxLng, south: minLat, north: maxLat },
  };
}
