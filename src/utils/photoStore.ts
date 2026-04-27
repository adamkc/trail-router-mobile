/**
 * IndexedDB-backed blob store for waypoint photos.
 *
 * Keeping photos out of localStorage (5–10 MB cap, string-only, blocks the
 * main thread) and out of the zustand library state (which gets serialized
 * to localStorage on every change). Each photo lives in its own IDB record
 * keyed by a stable id; the library only stores the id string.
 *
 * Lazy-opens the DB on first call. URLs returned by `loadPhotoUrl` are
 * `blob:` URIs created via URL.createObjectURL and must be revoked by the
 * caller when the consuming React element unmounts to avoid leaks.
 */

const DB_NAME = 'trail-router';
const STORE = 'photos';
const VERSION = 1;

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
  });
  return _dbPromise;
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDb().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

/** Generate a fresh photo id ahead of time (so it can be embedded in the
 *  RouteWaypoint before the actual blob save resolves). */
export function newPhotoId(): string {
  return `ph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function savePhoto(id: string, blob: Blob): Promise<void> {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(blob, id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('IDB put failed'));
  });
}

export async function loadPhotoBlob(id: string): Promise<Blob | null> {
  try {
    const store = await tx('readonly');
    return await new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('IDB get failed'));
    });
  } catch {
    return null;
  }
}

/** Convenience: load a photo and return a `blob:` URL. Caller must revoke. */
export async function loadPhotoUrl(id: string): Promise<string | null> {
  const blob = await loadPhotoBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function deletePhoto(id: string): Promise<void> {
  try {
    const store = await tx('readwrite');
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('IDB delete failed'));
    });
  } catch {
    // ignore — best-effort cleanup
  }
}

/** List every blob id in the store (photos + hillshades). Cheap — just a
 *  cursor scan over the keys, no blob bytes are read. */
export async function listAllBlobIds(): Promise<string[]> {
  try {
    const store = await tx('readonly');
    return await new Promise((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve((req.result ?? []) as string[]);
      req.onerror = () => reject(req.error ?? new Error('IDB getAllKeys failed'));
    });
  } catch {
    return [];
  }
}

/** Aggregate total bytes used by all stored blobs. Optional `prefix` filter
 *  ("ph-" for photos only, "hs-" for hillshades). */
export async function blobStorageBytes(prefix = ''): Promise<{ count: number; bytes: number }> {
  const ids = await listAllBlobIds();
  const matching = prefix ? ids.filter((id) => id.startsWith(prefix)) : ids;
  let bytes = 0;
  for (const id of matching) {
    const blob = await loadPhotoBlob(id);
    if (blob) bytes += blob.size;
  }
  return { count: matching.length, bytes };
}

/** Drop every blob whose key matches the prefix. */
export async function clearBlobsByPrefix(prefix: string): Promise<number> {
  const ids = await listAllBlobIds();
  const targets = ids.filter((id) => id.startsWith(prefix));
  for (const id of targets) await deletePhoto(id);
  return targets.length;
}

// ─── Per-project hillshade blobs ───────────────────────────────────────────
// Stored in the same `photos` IDB object store under namespaced keys so we
// don't have to bump the DB version. Each project gets at most one
// hillshade; saving overwrites.

const hillshadeKey = (projectId: string) => `hs-${projectId}`;

export async function saveHillshade(projectId: string, blob: Blob): Promise<void> {
  return savePhoto(hillshadeKey(projectId), blob);
}

export async function loadHillshadeUrl(projectId: string): Promise<string | null> {
  return loadPhotoUrl(hillshadeKey(projectId));
}

export async function deleteHillshade(projectId: string): Promise<void> {
  return deletePhoto(hillshadeKey(projectId));
}

/** Open the OS file picker for an image and resolve with the chosen Blob. */
export function pickImageFile(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0];
      resolve(file ?? null);
    };
    document.body.appendChild(input);
    input.click();
    setTimeout(() => {
      try { document.body.removeChild(input); } catch { /* already removed */ }
    }, 60_000);
  });
}

/**
 * Open the OS camera (or photo picker on desktop) and resolve with the
 * captured Blob, or null if cancelled. Uses `capture="environment"` so
 * mobile browsers default to the rear camera.
 */
export function pickCameraPhoto(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    let resolved = false;
    input.onchange = () => {
      resolved = true;
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
      } else {
        resolve(file);
      }
    };
    document.body.appendChild(input);
    input.click();
    // No reliable cancel event — clean up input element after a beat. The
    // promise resolves whenever a file is chosen (or stays pending if the
    // user dismisses the picker; that's OK because the React caller will
    // unmount or trigger another flow).
    setTimeout(() => {
      if (!resolved) document.body.removeChild(input);
      else setTimeout(() => document.body.removeChild(input), 100);
    }, 60_000);
  });
}
