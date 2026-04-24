import type { ComponentType } from 'react';
import { ProjectsScreen } from './ProjectsScreen';
import { NetworkMapScreen } from './NetworkMapScreen';
import { HomeScreen } from './HomeScreen';
import { LibraryScreen } from './LibraryScreen';
import { MapViewerScreen } from './MapViewerScreen';
import { RouteDetailsScreen } from './RouteDetailsScreen';
import { RecordScreen } from './RecordScreen';
import { VertexEditorScreen } from './VertexEditorScreen';
import { OptimizerScreen } from './OptimizerScreen';
import { RecordReviewScreen } from './RecordReviewScreen';
import { WaypointsScreen } from './WaypointsScreen';
import { OfflineScreen } from './OfflineScreen';
import { TabletNetworkScreen } from './TabletNetworkScreen';

export type ScreenSection = 'project' | 'core' | 'field' | 'tablet';

export interface ScreenEntry {
  id: string;
  label: string;
  path: string;
  section: ScreenSection;
  /** Artboard dimensions — phones default to 392×820, tablet is 1600×1000. */
  width: number;
  height: number;
  Component: ComponentType;
}

export const SCREENS: ScreenEntry[] = [
  { id: 'projects',      label: 'P1 · Projects',              section: 'project', path: '/projects',     width: 392,  height: 820,  Component: ProjectsScreen     },
  { id: 'netmap',        label: 'P2 · Network map',           section: 'project', path: '/network-map',  width: 392,  height: 820,  Component: NetworkMapScreen   },
  { id: 'home',          label: '00 · Home',                  section: 'core',    path: '/home',         width: 392,  height: 820,  Component: HomeScreen         },
  { id: 'library',       label: '01 · Library',               section: 'core',    path: '/library',      width: 392,  height: 820,  Component: LibraryScreen      },
  { id: 'map',           label: '02 · Map viewer',            section: 'core',    path: '/map',          width: 392,  height: 820,  Component: MapViewerScreen    },
  { id: 'details',       label: '03 · Route details',         section: 'core',    path: '/details',      width: 392,  height: 820,  Component: RouteDetailsScreen },
  { id: 'record',        label: '04 · Record + coach',        section: 'core',    path: '/record',       width: 392,  height: 820,  Component: RecordScreen       },
  { id: 'editor',        label: '05 · Vertex editor',         section: 'core',    path: '/editor',       width: 392,  height: 820,  Component: VertexEditorScreen },
  { id: 'optimizer',     label: 'F1 · Optimizer',             section: 'field',   path: '/optimizer',    width: 392,  height: 820,  Component: OptimizerScreen    },
  { id: 'record-review', label: 'F2 · Record review',         section: 'field',   path: '/review',       width: 392,  height: 820,  Component: RecordReviewScreen },
  { id: 'waypoints',     label: 'F3 · Waypoints',             section: 'field',   path: '/waypoints',    width: 392,  height: 820,  Component: WaypointsScreen    },
  { id: 'offline',       label: 'F4 · Offline data',          section: 'field',   path: '/offline',      width: 392,  height: 820,  Component: OfflineScreen      },
  { id: 'tablet-network',label: 'T1 · Network planning',      section: 'tablet',  path: '/tablet',       width: 1600, height: 1000, Component: TabletNetworkScreen},
];

export const SECTIONS: Record<ScreenSection, { title: string; subtitle: string }> = {
  project: { title: 'Project layer',   subtitle: 'Networks of trails · multi-trail planning surface' },
  core:    { title: 'Core screens',    subtitle: 'Home · Library · Map · Details · Record · Editor'  },
  field:   { title: 'Field workflow',  subtitle: 'Optimize · Record review · Waypoints · Offline'    },
  tablet:  { title: 'Tablet layout',   subtitle: 'Landscape · rail nav + persistent inspector'       },
};
