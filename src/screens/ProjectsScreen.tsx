import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { BottomTabBar } from '../components/BottomTabBar';
import type { ChipTone } from '../components/Chip';
import { useLibrary } from '../store/library';
import { projectExtentsFromRoutes, useProjects } from '../store/projects';
import { parseGeoJsonRoutes, pickJsonFile } from '../utils/geojson';
import { parseGpxRoutes } from '../utils/gpx';
import { haversineKm } from '../store/recording';
import { buildNetwork } from '../utils/network';

interface ProjectCardData {
  id: string;
  name: string;
  subtitle: string;
  trails: number;
  km: string;
  gain: string;
  status: 'active' | 'archived';
  tag: ChipTone;
  built: number;
  draft: number;
  optimized: number;
  updated: string;
  isActive: boolean;
  /** Mean and max signed-grade across all trails (percent). 0/0 when no
   *  per-vertex elevations are available (e.g. user-imported plain GeoJSON). */
  avgGradePct: number;
  maxGradePct: number;
  /** Auto-detected junctions (cross-trail intersections within 25 m). */
  junctions: number;
}

type Segment = 'ALL' | 'ACTIVE' | 'ARCHIVED';
const SEGMENTS: readonly Segment[] = ['ALL', 'ACTIVE', 'ARCHIVED'] as const;

const SEGMENT_PREDICATE: Record<Segment, (status: string) => boolean> = {
  ALL:      () => true,
  ACTIVE:   (s) => s === 'active',
  ARCHIVED: (s) => s === 'archived',
};

function formatRelative(epoch: number): string {
  if (epoch === 0) return 'Bundled';
  const ageMs = Date.now() - epoch;
  const day = 1000 * 60 * 60 * 24;
  if (ageMs < day) return 'Today';
  const days = Math.floor(ageMs / day);
  if (days < 7) return `${days}d ago`;
  return new Date(epoch).toISOString().slice(0, 10);
}

function projectIdFromName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `project-${Date.now().toString(36)}`;
}

const tagStroke: Record<ChipTone, string> = {
  blaze:   'var(--blaze)',
  topo:    'var(--topo)',
  good:    'var(--good)',
  warn:    'var(--warn)',
  danger:  'var(--danger)',
  neutral: 'var(--bone)',
};

export function ProjectsScreen() {
  const navigate = useNavigate();
  const [segment, setSegment] = useState<Segment>('ALL');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const routes = useLibrary((s) => s.routes);
  const addRoute = useLibrary((s) => s.addRoute);
  const projects = useProjects((s) => s.projects);
  const activeProjectId = useProjects((s) => s.activeProjectId);
  const setActive = useProjects((s) => s.setActive);
  const addProject = useProjects((s) => s.addProject);

  const projectsLive: ProjectCardData[] = useMemo(() => {
    return projects.map((p) => {
      const inProject = routes.filter((r) => r.projectId === p.id);
      let built = 0, draft = 0, optimized = 0;
      let kmSum = 0, gainSum = 0;
      // Grade aggregation: roll a sliding ~50 m window across each route's
      // (geo, elevations) and compute rise/run on that window. Per-vertex
      // grades are noise — Open-Meteo gives one interpolated elevation per
      // sample point, and trails sometimes have sub-meter vertex spacing,
      // so dE/dRun on adjacent points blows up to nonsense (e.g. 326 %).
      // Window-based grade is what humans/optimizers actually care about.
      const WINDOW_M = 50;
      let totalRiseAbs = 0;
      let totalRunM = 0;
      let maxAbsGrade = 0;
      for (const r of inProject) {
        if (r.status === 'built') built += 1;
        else if (r.status === 'draft') draft += 1;
        else if (r.status === 'optimized') optimized += 1;
        kmSum += parseFloat(r.km) || 0;
        gainSum += parseInt(r.gain.replace(/[^\d-]/g, ''), 10) || 0;
        if (r.elevations.length === r.geo.length && r.elevations.length >= 2) {
          // Cumulative meters from start so we can index windows by run.
          const runCum: number[] = [0];
          for (let i = 1; i < r.geo.length; i++) {
            runCum.push(runCum[i - 1] + haversineKm(r.geo[i - 1], r.geo[i]) * 1000);
          }
          let j = 0;
          for (let i = 1; i < r.geo.length; i++) {
            // Advance the window's start until it's at least WINDOW_M behind i.
            while (j < i && runCum[i] - runCum[j] > WINDOW_M) j++;
            if (j > 0) j--;
            const runM = runCum[i] - runCum[j];
            if (runM < WINDOW_M * 0.5) continue;
            const rise = r.elevations[i] - r.elevations[j];
            totalRiseAbs += Math.abs(rise);
            totalRunM += runM;
            const segGrade = Math.abs(rise / runM) * 100;
            // Defensive: cap at a plausible trail max (80 %). Above that is
            // either bad elevation data or a cliff, neither is meaningful.
            if (segGrade < 80 && segGrade > maxAbsGrade) maxAbsGrade = segGrade;
          }
        }
      }
      const avgGradePct = totalRunM > 0 ? (totalRiseAbs / totalRunM) * 100 : 0;
      // Junctions: build the routing graph for *this project's* trails.
      // Cheap (~5 ms for the 10-trail Hayfork case) and only runs when the
      // projects/routes selectors change, which is rare.
      const routableInProject = inProject.filter((r) => r.geo.length >= 2);
      const junctions = routableInProject.length >= 2
        ? buildNetwork(routableInProject).junctions.size
        : 0;
      const isActive = p.id === activeProjectId;
      return {
        id: p.id,
        name: p.name,
        subtitle: p.subtitle,
        trails: inProject.length,
        km: kmSum.toFixed(1),
        gain: `+${gainSum.toLocaleString()}`,
        status: 'active' as const,
        tag: isActive ? 'blaze' : built >= optimized + draft ? 'good' : 'topo',
        built, draft, optimized,
        updated: formatRelative(p.createdAt),
        isActive,
        avgGradePct,
        maxGradePct: maxAbsGrade,
        junctions,
      };
    });
  }, [projects, routes, activeProjectId]);

  const handleImportNewProject = async () => {
    setImportStatus(null);
    try {
      const file = await pickJsonFile('.geojson,.json,.gpx,application/geo+json,application/json,application/gpx+xml');
      if (!file) return;
      const isGpx = /\.gpx$/i.test(file.name) || /^<\?xml/.test(file.text);
      const parsed = isGpx ? parseGpxRoutes(file.text) : parseGeoJsonRoutes(file.text);
      if (parsed.length === 0) {
        setImportStatus(`No usable routes found in ${file.name}`);
        return;
      }
      // Derive a project id + extents from the file's content.
      const baseName = file.name.replace(/\.(geojson|json|gpx)$/i, '');
      const id = projectIdFromName(baseName);
      const extents = projectExtentsFromRoutes(parsed.map((r) => r.geo));
      if (!extents) {
        setImportStatus(`Couldn't compute project extents from ${file.name}`);
        return;
      }
      addProject({
        id,
        name: baseName,
        subtitle: `Imported · ${parsed.length} route${parsed.length === 1 ? '' : 's'}`,
        center: extents.center,
        bounds: extents.bounds,
        hasHillshade: false,
        createdAt: Date.now(),
      });
      // addProject sets active to the new project; addRoute now defaults
      // projectId to the active id, so each parsed route attaches correctly.
      for (const r of parsed) addRoute(r);
      setImportStatus(`Imported ${parsed.length} route${parsed.length === 1 ? '' : 's'} into "${baseName}"`);
    } catch (e) {
      setImportStatus(`Project import failed: ${(e as Error).message}`);
    }
  };

  const handleSelectProject = (id: string) => {
    setActive(id);
    navigate('/network-map');
  };

  const q = search.trim().toLowerCase();
  const visibleProjects = projectsLive
    .filter((p) => SEGMENT_PREDICATE[segment](p.status))
    .filter((p) => !q || p.name.toLowerCase().includes(q));

  // Project-layer summary strip: total networks, trails, km. Recompute live.
  const summary = useMemo(() => {
    const totalTrails = projectsLive.reduce((acc, p) => acc + p.trails, 0);
    const totalKm = projectsLive
      .reduce((acc, p) => acc + (parseFloat(p.km) || 0), 0)
      .toFixed(1);
    return { networks: projectsLive.length, trails: totalTrails, km: totalKm };
  }, [projectsLive]);

  return (
    <div className="screen">
      <StatusBar />

      {/* Header */}
      <div style={{ padding: '12px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="stat-label">TRAIL ROUTER</div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: '-0.02em',
                marginTop: 2,
              }}
            >
              Projects
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearch(''); }}
              aria-label={searchOpen ? 'Close search' : 'Search projects'}
              style={{
                width: 40, height: 40, borderRadius: 12,
                background: searchOpen ? 'var(--blaze)' : 'var(--surface-2)',
                color: searchOpen ? '#1A1208' : 'var(--bone)',
                display: 'grid', placeItems: 'center',
                border: '1px solid var(--line-soft)',
              }}
            >
              <Icon name={searchOpen ? 'close' : 'search'} size={18} />
            </button>
            <button
              type="button"
              aria-label="New project"
              onClick={handleImportNewProject}
              style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'var(--surface-2)',
                color: 'var(--bone)',
                display: 'grid', placeItems: 'center',
                border: '1px solid var(--line-soft)',
              }}
            >
              <Icon name="plus" size={18} />
            </button>
          </div>
        </div>

        {searchOpen && (
          <input
            type="search"
            autoFocus
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--line-soft)',
              color: 'var(--bone)',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              outline: 'none',
              caretColor: 'var(--blaze)',
            }}
          />
        )}

        {/* Summary strip */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {[
            { k: 'NETWORKS', v: String(summary.networks) },
            { k: 'TRAILS', v: String(summary.trails) },
            { k: 'TOTAL KM', v: summary.km },
          ].map((s) => (
            <div
              key={s.k}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 12,
                background: 'var(--surface-2)',
                border: '1px solid var(--line-soft)',
              }}
            >
              <div className="stat-label">{s.k}</div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 18,
                  color: 'var(--bone)',
                  marginTop: 2,
                }}
              >
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Segment tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '0 20px 14px' }}>
        {SEGMENTS.map((t) => {
          const active = segment === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setSegment(t)}
              style={{
                padding: '6px 12px',
                borderRadius: 100,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.1em',
                background: active ? 'var(--bone)' : 'transparent',
                color: active ? 'var(--bg)' : 'var(--moss)',
                border: active ? 'none' : '1px solid var(--line-soft)',
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Projects list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
        {visibleProjects.length === 0 ? (
          <div
            style={{
              padding: '32px 12px',
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--moss)',
              letterSpacing: '0.06em',
            }}
          >
            NO PROJECTS MATCH "{segment}"
          </div>
        ) : (
          visibleProjects.map((p, i) => (
            <ProjectCard
              key={p.id}
              p={p}
              i={i}
              onOpen={() => handleSelectProject(p.id)}
            />
          ))
        )}
        {importStatus && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'color-mix(in oklch, var(--blaze) 12%, var(--surface-2))',
              border: '1px solid color-mix(in oklch, var(--blaze) 35%, transparent)',
              color: 'var(--bone)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.04em',
            }}
          >
            {importStatus}
          </div>
        )}
      </div>

      <BottomTabBar active="projects" />
      <NavPill />
    </div>
  );
}

function ProjectCard({ p, i, onOpen }: { p: ProjectCardData; i: number; onOpen: () => void }) {
  const accent = tagStroke[p.tag];
  const isActive = p.isActive;
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        background: 'var(--surface)',
        border: isActive
          ? '1px solid color-mix(in oklch, var(--blaze) 40%, var(--line-soft))'
          : '1px solid var(--line-soft)',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        position: 'relative',
        textAlign: 'left',
        color: 'var(--bone)',
        width: '100%',
        display: 'block',
      }}
    >
      {/* Network topo preview */}
      <div
        style={{
          height: 90,
          borderRadius: 10,
          marginBottom: 12,
          background: 'var(--surface-2)',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid var(--line-soft)',
        }}
      >
        <svg
          viewBox="0 0 320 90"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          {/* contours — primary cluster */}
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <ellipse
              key={k}
              cx={100 + i * 30}
              cy={45 + (i % 2) * 5}
              rx={20 + k * 16}
              ry={14 + k * 10}
              fill="none"
              stroke="var(--moss-dim)"
              strokeWidth={k === 0 || k === 3 ? 0.6 : 0.35}
              opacity={k === 0 || k === 3 ? 0.55 : 0.3}
            />
          ))}
          {[0, 1, 2].map((k) => (
            <ellipse
              key={`b${k}`}
              cx={240 - i * 10}
              cy={30 + i * 3}
              rx={15 + k * 12}
              ry={10 + k * 8}
              fill="none"
              stroke="var(--moss-dim)"
              strokeWidth="0.4"
              opacity="0.4"
            />
          ))}
          {/* trail network paths */}
          {[
            `M 10 ${60 + i * 2} Q 60 ${30 + i}, 120 ${40 + i * 2} T 230 ${50 + i} L 310 ${40 + i * 3}`,
            `M 70 ${80 - i * 2} Q 140 ${60 - i * 3}, 200 ${30 + i} T 300 ${20 + i}`,
            `M 40 ${20 + i * 2} Q 90 ${40 + i * 2}, 150 ${60 - i * 2} T 280 ${70 - i * 2}`,
          ]
            .slice(0, p.trails > 10 ? 3 : 2)
            .map((d, k) => (
              <path
                key={k}
                d={d}
                fill="none"
                stroke={k === 0 ? accent : 'var(--bone)'}
                strokeWidth={k === 0 ? 1.8 : 1.2}
                strokeLinecap="round"
                opacity={k === 0 ? 1 : 0.55}
                strokeDasharray={k === 2 ? '3 3' : undefined}
              />
            ))}
          {/* trailhead dots */}
          <circle cx={10} cy={60 + i * 2} r="2.5" fill="var(--good)" />
          <circle cx={310} cy={40 + i * 3} r="2.5" fill="var(--danger)" />
        </svg>

        {/* corner status chip */}
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <div className={`chip ${p.tag}`} style={{ padding: '2px 8px', fontSize: 9 }}>
            {p.status}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--moss)',
            letterSpacing: '0.08em',
          }}
        >
          {p.trails} TRAILS · {p.km} KM
        </div>
      </div>

      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
          >
            {p.name}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--moss)',
              letterSpacing: '0.05em',
              marginTop: 2,
            }}
          >
            {p.subtitle.toUpperCase()}
          </div>
        </div>
        <Icon name="chevron-right" size={18} color="var(--moss)" />
      </div>

      {/* Quick stats grid — derived from the live library + network graph. */}
      {(p.avgGradePct > 0 || p.junctions > 0 || p.gain !== '+0') && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            marginTop: 10,
          }}
        >
          {[
            { label: 'GAIN',     value: `${p.gain} m` },
            { label: 'AVG GRD',  value: p.avgGradePct > 0  ? `${p.avgGradePct.toFixed(1)}%`  : '—' },
            { label: 'MAX GRD',  value: p.maxGradePct > 0  ? `${p.maxGradePct.toFixed(0)}%`  : '—' },
            { label: 'JCT',      value: p.junctions > 0    ? String(p.junctions)             : '—' },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: '6px 8px',
                borderRadius: 8,
                background: 'var(--surface-2)',
                border: '1px solid var(--line-soft)',
              }}
            >
              <div className="stat-label" style={{ fontSize: 8 }}>{s.label}</div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--bone)',
                  marginTop: 1,
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status breakdown */}
      <div
        style={{
          display: 'flex',
          gap: 14,
          marginTop: 10,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--bone-dim)',
          letterSpacing: '0.05em',
        }}
      >
        <span>
          <span style={{ color: 'var(--good)' }}>●</span> {p.built} BUILT
        </span>
        <span>
          <span style={{ color: 'var(--bone)' }}>●</span> {p.draft} DRAFT
        </span>
        <span>
          <span style={{ color: 'var(--blaze)' }}>●</span> {p.optimized} OPT
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--moss)' }}>{p.updated}</span>
      </div>
    </button>
  );
}
