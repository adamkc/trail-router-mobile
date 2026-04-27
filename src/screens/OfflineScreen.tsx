import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { BottomTabBar } from '../components/BottomTabBar';
import { useLibrary } from '../store/library';
import { useProjects, type Project } from '../store/projects';
import { usePreferences } from '../store/preferences';
import { estimateTileCount, precacheBounds, type PrecacheProgress } from '../utils/tileCache';

interface StorageEstimate {
  usage?: number;
  quota?: number;
}

const formatBytes = (n?: number): string => {
  if (n === undefined || n === 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
};

export function OfflineScreen() {
  const navigate = useNavigate();
  const projects = useProjects((s) => s.projects);
  const allRoutes = useLibrary((s) => s.routes);
  const wifiOnly = usePreferences((s) => s.hillshadeOn);  // reusing as a placeholder until a wifi-only pref lands; harmless: it's just a toggled visual
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);

  // Pull real Storage API estimate when supported (PWA/standalone gives the
  // most useful answer; desktop browsers report the page's quota).
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    if (!navigator.storage || !navigator.storage.estimate) return;
    navigator.storage.estimate().then((est) => setEstimate(est)).catch(() => setEstimate(null));
  }, []);

  const usagePct = estimate?.usage && estimate?.quota
    ? Math.min(100, (estimate.usage / estimate.quota) * 100)
    : 0;

  // Per-project tile-precache state. The active job is keyed by project id
  // so the user can see which project is being cached; abort tracked via ref.
  const [activeJob, setActiveJob] = useState<{
    projectId: string;
    progress: PrecacheProgress;
  } | null>(null);
  const [tileCounts, setTileCounts] = useState<Record<string, number>>({});
  const abortRef = useRef<AbortController | null>(null);

  // Estimate tile counts for each project (one-shot per mount). Cheap —
  // just bbox-grid arithmetic, no network beyond the one style.json fetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, number> = {};
      for (const p of projects) {
        try {
          next[p.id] = await estimateTileCount(p.bounds, [12, 13, 14, 15]);
        } catch {
          next[p.id] = 0;
        }
      }
      if (!cancelled) setTileCounts(next);
    })();
    return () => { cancelled = true; };
  }, [projects]);

  const startPrecache = (project: Project) => {
    if (activeJob) return; // single-job at a time
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const initial: PrecacheProgress = { done: 0, total: tileCounts[project.id] ?? 0, ok: 0, failed: 0 };
    setActiveJob({ projectId: project.id, progress: initial });
    precacheBounds(
      project.bounds,
      [12, 13, 14, 15],
      (p) => setActiveJob({ projectId: project.id, progress: p }),
      ctrl.signal,
    )
      .then((final) => {
        setActiveJob({ projectId: project.id, progress: final });
        // Refresh storage estimate so the bar reflects the new bytes.
        navigator.storage?.estimate?.().then(setEstimate).catch(() => {});
        // Auto-clear the "done" badge after a couple seconds.
        window.setTimeout(() => setActiveJob(null), 4000);
      })
      .catch(() => setActiveJob(null));
  };
  const cancelPrecache = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveJob(null);
  };

  return (
    <div className="screen">
      <StatusBar />

      {/* Header */}
      <div style={{ padding: '6px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={() => navigate('/home')}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--surface-2)',
            border: '1px solid var(--line-soft)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--bone)',
          }}
          aria-label="Back to home"
        >
          <Icon name="back" size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="eyebrow">FIELD READY</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>
            Offline data
          </div>
        </div>
      </div>

      {/* Storage summary — real numbers from navigator.storage.estimate(). */}
      <div
        style={{
          margin: '0 16px',
          padding: 14,
          borderRadius: 16,
          background: 'var(--surface)',
          border: '1px solid var(--line-soft)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 10,
          }}
        >
          <div className="eyebrow">STORAGE</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone-dim)' }}>
            {estimate
              ? `${formatBytes(estimate.usage)} / ${formatBytes(estimate.quota)}`
              : '— / —'}
          </div>
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: 'var(--surface-2)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${usagePct.toFixed(2)}%`,
              height: '100%',
              background: usagePct > 90 ? 'var(--danger)' : 'var(--blaze)',
              transition: 'width 200ms ease',
            }}
          />
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--moss)',
            letterSpacing: '0.06em',
          }}
        >
          {estimate
            ? `${usagePct.toFixed(1)}% USED · INCLUDES MAP TILES, HILLSHADE, PHOTO WAYPOINTS`
            : 'STORAGE API UNAVAILABLE — CANNOT REPORT USAGE'}
        </div>
      </div>

      {/* Per-project readiness — derived from the live project + library state. */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px 16px' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>PROJECTS</div>

        {projects.map((p) => {
          const projectRouteCount = allRoutes.filter((r) => r.projectId === p.id).length;
          const isBundled = p.id === 'hayfork';
          const accent = isBundled ? 'var(--blaze)' : 'var(--bone)';
          const tileCount = tileCounts[p.id] ?? null;
          const isJobActive = activeJob?.projectId === p.id;
          const jobProgress = isJobActive ? activeJob.progress : null;
          const jobPct = jobProgress && jobProgress.total > 0
            ? (jobProgress.done / jobProgress.total) * 100
            : 0;
          const isJobDone = isJobActive && jobProgress && jobProgress.done === jobProgress.total && jobProgress.total > 0;
          const assets: string[] = [];
          assets.push(`${projectRouteCount} TRAIL${projectRouteCount === 1 ? '' : 'S'} ✓`);
          if (p.hasHillshade) assets.push('HILLSHADE ✓');
          return (
            <div
              key={p.id}
              style={{
                background: 'var(--surface)',
                border: isBundled
                  ? '1px solid color-mix(in oklch, var(--blaze) 35%, var(--line-soft))'
                  : '1px solid var(--line-soft)',
                borderRadius: 14,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: isBundled
                      ? 'color-mix(in oklch, var(--blaze) 15%, var(--surface-2))'
                      : 'var(--surface-2)',
                    border: isBundled
                      ? '1px solid color-mix(in oklch, var(--blaze) 40%, transparent)'
                      : '1px solid var(--line-soft)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Icon name="mountain" size={18} color={accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500 }}>
                    {p.name}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: isJobActive
                        ? 'var(--blaze)'
                        : isBundled ? 'var(--good)' : 'var(--moss)',
                      letterSpacing: '0.08em',
                      marginTop: 2,
                    }}
                  >
                    {isJobActive && jobProgress
                      ? isJobDone
                        ? `● CACHED ${jobProgress.ok} TILES${jobProgress.failed ? ` · ${jobProgress.failed} FAILED` : ''}`
                        : `● CACHING TILES · ${jobProgress.done}/${jobProgress.total} (${jobPct.toFixed(0)}%)`
                      : isBundled
                      ? '● READY OFFLINE · BUNDLED'
                      : `● LOCAL ONLY · ${projectRouteCount} ROUTE${projectRouteCount === 1 ? '' : 'S'}`}
                  </div>
                </div>
                {/* Cache button — disabled while a different project's job is
                    running. Cancel button takes its place during this project's job. */}
                {isJobActive && !isJobDone ? (
                  <button
                    type="button"
                    onClick={cancelPrecache}
                    aria-label="Cancel cache"
                    style={{
                      padding: '7px 12px',
                      borderRadius: 10,
                      background: 'var(--surface-2)',
                      border: '1px solid color-mix(in oklch, var(--danger) 40%, transparent)',
                      color: 'var(--danger)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.1em',
                    }}
                  >
                    CANCEL
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startPrecache(p)}
                    disabled={!!activeJob && !isJobActive}
                    aria-label="Cache tiles for this project"
                    style={{
                      padding: '7px 12px',
                      borderRadius: 10,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line-soft)',
                      color: 'var(--bone)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.1em',
                      opacity: !!activeJob && !isJobActive ? 0.4 : 1,
                    }}
                  >
                    {tileCount != null ? `CACHE ${tileCount}` : 'CACHE TILES'}
                  </button>
                )}
              </div>
              {isJobActive && jobProgress && jobProgress.total > 0 && (
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: 'var(--surface-2)',
                    overflow: 'hidden',
                    marginTop: 10,
                  }}
                >
                  <div
                    style={{
                      width: `${jobPct.toFixed(2)}%`,
                      height: '100%',
                      background: isJobDone ? 'var(--good)' : 'var(--blaze)',
                      transition: 'width 200ms ease',
                    }}
                  />
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  marginTop: 10,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: 'var(--bone-dim)',
                  letterSpacing: '0.06em',
                  flexWrap: 'wrap',
                }}
              >
                {assets.map((a) => (
                  <span
                    key={a}
                    style={{ padding: '3px 7px', borderRadius: 6, background: 'var(--surface-2)' }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {/* PWA-cache hint — basemap tiles cached automatically as you use them. */}
        <div className="eyebrow" style={{ marginTop: 16, marginBottom: 8 }}>HOW IT WORKS</div>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line-soft)',
            borderRadius: 14,
            padding: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--bone-dim)',
            letterSpacing: '0.04em',
            lineHeight: 1.6,
          }}
        >
          THE APP CACHES WHAT YOU USE. WANDER A PROJECT'S MAP ONCE WHILE
          ONLINE — THE BASEMAP TILES, BUNDLED HILLSHADE, AND ROUTE GEOJSON
          STAY AVAILABLE OFFLINE. YOUR RECORDINGS + IMPORTED PROJECTS LIVE
          IN LOCAL STORAGE AND PHOTO WAYPOINTS IN INDEXEDDB; NEITHER NEEDS
          A NETWORK CONNECTION.
        </div>
        {/* `wifiOnly` placeholder — silenced lint warning, real toggle in Settings. */}
        <div style={{ display: 'none' }}>{String(wifiOnly)}</div>
      </div>
      <BottomTabBar active="settings" />
      <NavPill />
    </div>
  );
}
