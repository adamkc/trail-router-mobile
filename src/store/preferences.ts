import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PreferencesState {
  /** Show the bundled Hayfork hillshade raster overlay on map screens. */
  hillshadeOn: boolean;
  /** Epoch ms when the Hayfork project data was last auto- or manually-imported.
   *  null = never imported; non-null suppresses the auto-import on launch. */
  hayforkImportedAt: number | null;
  setHillshade: (on: boolean) => void;
  markHayforkImported: () => void;
  clearHayforkStamp: () => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      hillshadeOn: true,
      hayforkImportedAt: null,
      setHillshade: (on) => set({ hillshadeOn: on }),
      markHayforkImported: () => set({ hayforkImportedAt: Date.now() }),
      clearHayforkStamp: () => set({ hayforkImportedAt: null }),
    }),
    { name: 'trail-router-preferences', version: 1 },
  ),
);
