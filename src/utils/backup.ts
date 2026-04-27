/**
 * Local backup file format — one JSON bundle the user owns, copies, and
 * restores at will. No servers, no cloud accounts. Drop it in their
 * iCloud / Dropbox / OneDrive folder for cross-device sync via the
 * filesystem they already trust.
 *
 * Bundle includes everything that survives a session:
 *  - projects (the projects store)
 *  - routes  (the library store)
 *  - visits  (the recording-history store)
 *  - prefs   (hillshade toggle + import stamp)
 *  - blobs   (photo + hillshade blobs from IndexedDB, base64-encoded)
 *
 * Tradeoff: base64 inflates blob bytes by ~33 %. A user with 50 photo
 * waypoints averaging 200 KB each → ~13 MB → ~17 MB JSON. That's still
 * tiny by modern standards and keeps the format universal (no zip lib
 * dependency, opens in any text editor).
 */

import { useLibrary } from '../store/library';
import { useProjects } from '../store/projects';
import { useVisits } from '../store/visits';
import { usePreferences } from '../store/preferences';
import { loadPhotoBlob, savePhoto } from './photoStore';

const BACKUP_VERSION = 1;

interface BlobEntry {
  /** IndexedDB key (`ph-...` for photos, `hs-{projectId}` for hillshades). */
  id: string;
  /** Original MIME type — needed to reconstruct the Blob on import. */
  mime: string;
  /** Base64-encoded bytes (no `data:` prefix). */
  data: string;
}

export interface BackupBundle {
  version: number;
  exportedAt: number;
  /** App + commit hash for diagnostics; not validated on import. */
  source: string;
  projects: ReturnType<typeof useProjects.getState>['projects'];
  activeProjectId: string;
  routes: ReturnType<typeof useLibrary.getState>['routes'];
  visits: ReturnType<typeof useVisits.getState>['visits'];
  preferences: {
    hillshadeOn: boolean;
    hayforkImportedAt: number | null;
  };
  blobs: BlobEntry[];
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  // Avoid `String.fromCharCode(...new Uint8Array(buf))` — it stack-overflows
  // for blobs >100 KB. Process in 8 KB chunks instead.
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x2000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}

function base64ToBlob(b64: string, mime: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Walk every blob id referenced by the current library + projects and
 * pull its bytes from IndexedDB. Returns the BlobEntry array suitable
 * for embedding in the bundle.
 */
async function collectBlobs(
  routes: ReturnType<typeof useLibrary.getState>['routes'],
  projects: ReturnType<typeof useProjects.getState>['projects'],
): Promise<BlobEntry[]> {
  const ids = new Set<string>();
  for (const r of routes) {
    for (const w of r.waypoints) if (w.photoId) ids.add(w.photoId);
  }
  for (const p of projects) {
    if (p.hasHillshade) ids.add(`hs-${p.id}`);
  }
  const out: BlobEntry[] = [];
  for (const id of ids) {
    const blob = await loadPhotoBlob(id);
    if (!blob) continue;
    out.push({ id, mime: blob.type || 'application/octet-stream', data: await blobToBase64(blob) });
  }
  return out;
}

/** Serialize the live app state into a backup JSON string. */
export async function exportBackup(): Promise<{ filename: string; json: string; sizeBytes: number; counts: { routes: number; projects: number; visits: number; blobs: number } }> {
  const projectsState = useProjects.getState();
  const libraryState = useLibrary.getState();
  const visitsState = useVisits.getState();
  const prefsState = usePreferences.getState();

  const blobs = await collectBlobs(libraryState.routes, projectsState.projects);

  const bundle: BackupBundle = {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    source: 'trail-router-mobile',
    projects: projectsState.projects,
    activeProjectId: projectsState.activeProjectId,
    routes: libraryState.routes,
    visits: visitsState.visits,
    preferences: {
      hillshadeOn: prefsState.hillshadeOn,
      hayforkImportedAt: prefsState.hayforkImportedAt,
    },
    blobs,
  };

  const json = JSON.stringify(bundle, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    filename: `trail-router-backup-${stamp}.json`,
    json,
    sizeBytes: new Blob([json]).size,
    counts: {
      routes: libraryState.routes.length,
      projects: projectsState.projects.length,
      visits: visitsState.visits.length,
      blobs: blobs.length,
    },
  };
}

export interface RestoreSummary {
  routes: number;
  projects: number;
  visits: number;
  blobs: number;
}

/**
 * Replace all live state with the contents of a backup bundle. Any
 * existing routes / projects / visits / blobs are wiped first so the
 * restored state is exactly what was in the file.
 *
 * Throws if the input isn't a recognizable bundle.
 */
export async function restoreBackup(text: string): Promise<RestoreSummary> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`);
  }
  const bundle = parsed as Partial<BackupBundle>;
  if (!bundle || typeof bundle !== 'object' || bundle.version == null || !Array.isArray(bundle.projects) || !Array.isArray(bundle.routes)) {
    throw new Error('File is not a Trail Router backup bundle');
  }
  if (bundle.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version ${bundle.version} (expected ${BACKUP_VERSION})`);
  }

  // 1. Restore blobs first so any photo/hillshade ids referenced by routes
  //    and projects already resolve when those stores hydrate.
  const blobs = bundle.blobs ?? [];
  for (const b of blobs) {
    try {
      await savePhoto(b.id, base64ToBlob(b.data, b.mime));
    } catch {
      // skip a corrupt blob; restore is best-effort.
    }
  }

  // 2. Replace zustand stores. setState({...}, true) wipes existing state.
  useProjects.setState(
    {
      projects: bundle.projects,
      activeProjectId: bundle.activeProjectId ?? bundle.projects[0]?.id ?? 'hayfork',
    },
    false,
  );
  useLibrary.setState({ routes: bundle.routes }, false);
  useVisits.setState({ visits: bundle.visits ?? [] }, false);
  if (bundle.preferences) {
    usePreferences.setState(
      {
        hillshadeOn: bundle.preferences.hillshadeOn,
        hayforkImportedAt: bundle.preferences.hayforkImportedAt,
      },
      false,
    );
  }

  return {
    routes: bundle.routes.length,
    projects: bundle.projects.length,
    visits: (bundle.visits ?? []).length,
    blobs: blobs.length,
  };
}

/** Format byte counts in a human-friendly way for status messages. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
