import { useEffect, useRef } from 'react';
import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { DesignCanvas } from './components/DesignCanvas';
import { AndroidDevice } from './components/AndroidDevice';
import { SCREENS } from './screens/registry';
import { RouteDetailsScreen } from './screens/RouteDetailsScreen';
import { MapViewerScreen } from './screens/MapViewerScreen';
import { VertexEditorScreen } from './screens/VertexEditorScreen';
import { WaypointsScreen } from './screens/WaypointsScreen';
import { OptimizerScreen } from './screens/OptimizerScreen';
import { useIsMobile } from './hooks/useIsMobile';
import { useLibrary } from './store/library';
import { usePreferences } from './store/preferences';
import { backfillElevations, loadHayforkProject } from './utils/hayforkData';

/** IDs of the procedural seed routes baked into the library store. The
 *  auto-import only fires when the user's library is still exactly these. */
const SEED_IDS = new Set([
  'hayfork-loop',
  'north-ridge-traverse',
  'clear-creek-connector',
  'manzanita-switchbacks',
  'meadow-cutoff',
]);

/**
 * On first launch (no `hayforkImportedAt` stamp AND library is still in seed
 * state), pull the bundled Hayfork project's real trails and replace the
 * procedural seed routes. Runs once, silently — failures fall through.
 *
 * Guard rationale: a returning user who already recorded or imported routes
 * will have IDs outside SEED_IDS, so we skip and never clobber their work.
 *
 * Re-entry rationale: a `useRef` sentinel — not the persisted importedAt
 * value — gates the effect so we don't re-trigger when our own
 * `markHayforkImported()` flips the dep, which would cancel the in-flight
 * elevation backfill via the cleanup function.
 */
function useHayforkAutoImport() {
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    if (usePreferences.getState().hayforkImportedAt) return;
    const current = useLibrary.getState().routes;
    const isSeedState =
      current.length > 0 && current.every((r) => SEED_IDS.has(r.id));
    if (!isSeedState) {
      // User has touched the library — respect it, just stamp so we don't keep
      // checking on every launch.
      usePreferences.getState().markHayforkImported();
      return;
    }
    startedRef.current = true;
    (async () => {
      try {
        const routes = await loadHayforkProject();
        if (routes.length === 0) return;
        // Drop the routes in immediately so the user sees real trails ASAP,
        // then upgrade them in place with real Open-Meteo elevations once
        // the network round-trip completes (~2-4 s for ~10 routes).
        useLibrary.getState().replaceLibrary(routes);
        const enriched = await backfillElevations(routes);
        if (enriched > 0) useLibrary.getState().replaceLibrary(routes);
        // Stamp last so a hard refresh during the backfill window will
        // retry on the next launch (importedAt stays null).
        usePreferences.getState().markHayforkImported();
      } catch (e) {
        // Network unavailable on first launch (offline) — leave seeds in place
        // and try again next launch.
        console.warn('Hayfork auto-import failed:', e);
      }
    })();
  }, []);
}

function ScreenFrame({ entry }: { entry: (typeof SCREENS)[number] }) {
  const { label, width, height, Component } = entry;
  const isMobile = useIsMobile();

  // On a real phone, strip the bezel/label chrome and let the screen fill the viewport.
  if (isMobile) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          width: '100vw',
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Component />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--page-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 20px 80px',
        gap: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          width: '100%',
          maxWidth: width,
        }}
      >
        <Link
          to="/"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            color: 'var(--bone-dim)',
            textTransform: 'uppercase',
          }}
        >
          ← Canvas
        </Link>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            color: 'var(--moss)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </div>
      <AndroidDevice width={width} height={height}>
        <Component />
      </AndroidDevice>
    </div>
  );
}

function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--page-bg)',
        color: 'var(--bone)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
        fontFamily: 'var(--font-display)',
      }}
    >
      <div>Screen not found.</div>
      <Link
        to="/"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--blaze)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        ← Back to canvas
      </Link>
    </div>
  );
}

export default function App() {
  useHayforkAutoImport();
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<DesignCanvas />} />
        {SCREENS.map((entry) => (
          <Route key={entry.id} path={entry.path} element={<ScreenFrame entry={entry} />} />
        ))}
        {/* ID-routed flavors of the per-trail screens (details / map / editor).
            All reuse the same components from the registry but the URL param
            tells the screen which route to load from the library store. */}
        <Route
          path="/details/:id"
          element={
            <ScreenFrame
              entry={{
                id: 'details', label: '03 · Route details', section: 'core',
                path: '/details', width: 392, height: 820, Component: RouteDetailsScreen,
              }}
            />
          }
        />
        <Route
          path="/map/:id"
          element={
            <ScreenFrame
              entry={{
                id: 'map', label: '02 · Map viewer', section: 'core',
                path: '/map', width: 392, height: 820, Component: MapViewerScreen,
              }}
            />
          }
        />
        <Route
          path="/editor/:id"
          element={
            <ScreenFrame
              entry={{
                id: 'editor', label: '05 · Vertex editor', section: 'core',
                path: '/editor', width: 392, height: 820, Component: VertexEditorScreen,
              }}
            />
          }
        />
        <Route
          path="/waypoints/:id"
          element={
            <ScreenFrame
              entry={{
                id: 'waypoints', label: 'F3 · Waypoints', section: 'field',
                path: '/waypoints', width: 392, height: 820, Component: WaypointsScreen,
              }}
            />
          }
        />
        <Route
          path="/optimizer/:id"
          element={
            <ScreenFrame
              entry={{
                id: 'optimizer', label: 'F1 · Optimizer', section: 'field',
                path: '/optimizer', width: 392, height: 820, Component: OptimizerScreen,
              }}
            />
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </HashRouter>
  );
}
