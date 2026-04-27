import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PreferencesState {
  /** Show the bundled Hayfork hillshade raster overlay on map screens. */
  hillshadeOn: boolean;
  /** Epoch ms when the Hayfork project data was last auto- or manually-imported.
   *  null = never imported; non-null suppresses the auto-import on launch. */
  hayforkImportedAt: number | null;
  /** Whether to auto-write the backup JSON to the picked sync folder on
   *  every state change. Independent of the `hasSyncFolder()` check —
   *  a user can disable auto-sync without unpicking the folder. */
  autoSyncEnabled: boolean;
  /** Epoch ms of the most recent successful auto-sync write. */
  lastSyncedAt: number | null;
  setHillshade: (on: boolean) => void;
  markHayforkImported: () => void;
  clearHayforkStamp: () => void;
  setAutoSyncEnabled: (on: boolean) => void;
  setLastSyncedAt: (t: number | null) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      hillshadeOn: true,
      hayforkImportedAt: null,
      autoSyncEnabled: false,
      lastSyncedAt: null,
      setHillshade: (on) => set({ hillshadeOn: on }),
      markHayforkImported: () => set({ hayforkImportedAt: Date.now() }),
      clearHayforkStamp: () => set({ hayforkImportedAt: null }),
      setAutoSyncEnabled: (on) => set({ autoSyncEnabled: on }),
      setLastSyncedAt: (t) => set({ lastSyncedAt: t }),
    }),
    { name: 'trail-router-preferences', version: 1 },
  ),
);
