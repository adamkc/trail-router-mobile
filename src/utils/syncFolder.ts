/**
 * Auto-sync the user's data to a folder on their device using the File
 * System Access API. They pick a folder once; the app then writes the
 * backup JSON there on every state change. Drop the folder into iCloud
 * Drive / Dropbox / OneDrive / Google Drive for cross-device sync via
 * the user's existing cloud — still no server on our side.
 *
 * Browser support: Chrome / Edge / Opera / Android Chrome (90%+ of mobile).
 * Firefox + Safari don't ship `showDirectoryPicker` yet — `isSyncSupported`
 * returns false there and the caller falls back to manual export/import.
 *
 * Persistence: a FileSystemDirectoryHandle is structured-clonable, so we
 * stash it in IndexedDB across sessions. Permissions reset every session,
 * so on launch we call queryPermission and re-request if needed; the user
 * sees a one-tap permission dialog the first time, but subsequent visits
 * within a session are silent.
 */

import { exportBackup, restoreBackup, type RestoreSummary } from './backup';

const DB_NAME = 'trail-router-sync';
const STORE = 'handles';
const HANDLE_KEY = 'sync-folder';
const BACKUP_FILENAME = 'trail-router-backup.json';

interface DirectoryHandleAccessor {
  queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandle>;
  removeEntry?: (name: string) => Promise<void>;
  values: () => AsyncIterable<unknown>;
  name: string;
  kind: 'directory';
}

let _dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open sync IDB'));
  });
  return _dbPromise;
}

async function putHandle(handle: FileSystemDirectoryHandle | null): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = handle === null ? store.delete(HANDLE_KEY) : store.put(handle, HANDLE_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('Failed to persist handle'));
  });
}

async function getHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.get(HANDLE_KEY);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('Failed to read handle'));
  });
}

/** Whether the current browser exposes `showDirectoryPicker`. */
export function isSyncSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** Whether a sync folder has been chosen at any point — does NOT imply
 *  permission is currently granted. Use `verifySyncPermission()` for that. */
export async function hasSyncFolder(): Promise<boolean> {
  if (!isSyncSupported()) return false;
  return (await getHandle()) !== null;
}

/** Folder name the user picked, for display. Null when none. */
export async function getSyncFolderName(): Promise<string | null> {
  const h = await getHandle();
  return h?.name ?? null;
}

/**
 * Verify (and re-request if needed) readwrite permission on the saved
 * folder. Returns null if no folder was saved or permission was denied.
 */
async function ensurePermission(): Promise<DirectoryHandleAccessor | null> {
  const h = (await getHandle()) as DirectoryHandleAccessor | null;
  if (!h) return null;
  if (!h.queryPermission || !h.requestPermission) return h; // permission API absent — assume open
  try {
    const status = await h.queryPermission({ mode: 'readwrite' });
    if (status === 'granted') return h;
    const requested = await h.requestPermission({ mode: 'readwrite' });
    return requested === 'granted' ? h : null;
  } catch {
    return null;
  }
}

interface ShowDirectoryPickerOptions {
  mode?: 'read' | 'readwrite';
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}

interface WindowWithDirectoryPicker {
  showDirectoryPicker: (opts?: ShowDirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
}

/**
 * Prompt the user to pick a folder, save the handle, do an initial write.
 * Returns the chosen folder's name on success, null if cancelled.
 */
export async function pickSyncFolder(): Promise<string | null> {
  if (!isSyncSupported()) throw new Error('File System Access API not supported in this browser');
  const win = window as unknown as WindowWithDirectoryPicker;
  let handle: FileSystemDirectoryHandle;
  try {
    handle = await win.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
  } catch {
    return null; // user cancelled
  }
  await putHandle(handle);
  // Initial write so the file exists immediately.
  await writeSyncBackup();
  return handle.name;
}

/** Forget the saved folder handle. */
export async function disableSync(): Promise<void> {
  await putHandle(null);
}

/**
 * Write the current app state to `trail-router-backup.json` in the sync
 * folder. Returns the byte size on success, null if no permission or
 * folder. Safe to call repeatedly — overwrites in place.
 */
export async function writeSyncBackup(): Promise<{ sizeBytes: number; folder: string } | null> {
  const h = await ensurePermission();
  if (!h) return null;
  const { json } = await exportBackup();
  const fileHandle = await h.getFileHandle(BACKUP_FILENAME, { create: true });
  // FileSystemFileHandle exposes `createWritable` only when the typings
  // are loaded; cast for the call.
  const writable = await (fileHandle as FileSystemFileHandle & {
    createWritable: () => Promise<FileSystemWritableFileStream>;
  }).createWritable();
  await writable.write(json);
  await writable.close();
  return { sizeBytes: new Blob([json]).size, folder: h.name };
}

/**
 * Read the backup JSON from the sync folder and restore it. Returns the
 * restore summary, or null if no folder/permission/file.
 */
export async function readSyncBackup(): Promise<RestoreSummary | null> {
  const h = await ensurePermission();
  if (!h) return null;
  let fileHandle: FileSystemFileHandle;
  try {
    fileHandle = await h.getFileHandle(BACKUP_FILENAME, { create: false });
  } catch {
    return null;
  }
  const file = await fileHandle.getFile();
  const text = await file.text();
  return restoreBackup(text);
}
