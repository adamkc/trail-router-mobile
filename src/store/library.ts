import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChipTone } from '../components/Chip';

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
}

interface LibraryState {
  routes: LibraryRoute[];
  addRoute: (input: Omit<LibraryRoute, 'id'>) => LibraryRoute;
}

const SEED: LibraryRoute[] = [
  { id: 'hayfork-loop',            name: 'Hayfork Loop',          km: '14.2', gain: '+640', grade: '6.1',  status: 'optimized', tag: 'blaze', spark: [420, 430, 480, 520, 580, 610, 640, 620, 560, 500, 440, 420] },
  { id: 'north-ridge-traverse',    name: 'North Ridge Traverse',  km: '8.7',  gain: '+390', grade: '7.4',  status: 'draft',     tag: null,    spark: [300, 320, 340, 380, 420, 440, 460, 450, 430, 400] },
  { id: 'clear-creek-connector',   name: 'Clear Creek Connector', km: '5.3',  gain: '+180', grade: '4.2',  status: 'built',     tag: 'good',  spark: [280, 290, 310, 330, 350, 360, 370, 370, 365, 355] },
  { id: 'manzanita-switchbacks',   name: 'Manzanita Switchbacks', km: '3.1',  gain: '+420', grade: '12.8', status: 'review',    tag: 'warn',  spark: [240, 260, 290, 320, 360, 400, 440, 480, 520, 560, 600, 650] },
  { id: 'meadow-cutoff',           name: 'Meadow Cutoff',         km: '2.4',  gain: '+95',  grade: '3.1',  status: 'built',     tag: 'good',  spark: [220, 222, 225, 230, 240, 245, 250, 255, 260, 265] },
];

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
    }),
    {
      name: 'trail-router-library',
      version: 1,
      partialize: (state) => ({ routes: state.routes }),
    },
  ),
);
