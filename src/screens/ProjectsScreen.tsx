import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { BottomTabBar } from '../components/BottomTabBar';
import type { ChipTone } from '../components/Chip';
import { useLibrary } from '../store/library';

interface Project {
  name: string;
  subtitle: string;
  trails: number;
  km: string;
  gain: string;
  status: string;
  tag: ChipTone;
  built: number;
  draft: number;
  optimized: number;
  updated: string;
}

const PROJECTS: Project[] = [
  {
    name: 'Hayfork',
    subtitle: 'Trinity County · Public works',
    trails: 12, km: '42.8', gain: '+2,140',
    status: 'active', tag: 'blaze',
    built: 7, draft: 3, optimized: 2,
    updated: 'Today',
  },
  {
    name: 'Hidden Lakes Loop',
    subtitle: 'USFS Shasta-Trinity',
    trails: 8, km: '31.4', gain: '+1,620',
    status: 'planning', tag: 'topo',
    built: 2, draft: 5, optimized: 1,
    updated: '2d ago',
  },
  {
    name: 'Sierra Buttes',
    subtitle: 'Sierra County · SBT collab',
    trails: 18, km: '74.2', gain: '+4,380',
    status: 'built', tag: 'good',
    built: 16, draft: 0, optimized: 2,
    updated: 'Apr 18',
  },
  {
    name: 'Etna Ridge',
    subtitle: 'Salmon-Scott River RD',
    trails: 5, km: '14.9', gain: '+890',
    status: 'survey', tag: 'warn',
    built: 0, draft: 5, optimized: 0,
    updated: 'Apr 12',
  },
];

type Segment = 'ALL' | 'ACTIVE' | 'ARCHIVED';
const SEGMENTS: readonly Segment[] = ['ALL', 'ACTIVE', 'ARCHIVED'] as const;

const SEGMENT_PREDICATE: Record<Segment, (status: string) => boolean> = {
  ALL:      () => true,
  ACTIVE:   (s) => s === 'active' || s === 'planning' || s === 'survey',
  ARCHIVED: (s) => s === 'archived',
};

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
  const routes = useLibrary((s) => s.routes);

  // Hayfork derives its counts + total km/gain from the live library — every
  // route the user records or saves shows up here without a manual update.
  const hayforkCounts = useMemo(() => {
    const counts = { built: 0, draft: 0, optimized: 0, total: routes.length };
    let kmSum = 0, gainSum = 0;
    for (const r of routes) {
      if (r.status === 'built') counts.built += 1;
      else if (r.status === 'draft') counts.draft += 1;
      else if (r.status === 'optimized') counts.optimized += 1;
      kmSum += parseFloat(r.km) || 0;
      gainSum += parseInt(r.gain.replace(/[^\d-]/g, ''), 10) || 0;
    }
    return { ...counts, km: kmSum.toFixed(1), gain: `+${gainSum.toLocaleString()}` };
  }, [routes]);

  const projectsLive = PROJECTS.map((p) =>
    p.name === 'Hayfork'
      ? {
          ...p,
          trails: hayforkCounts.total,
          km: hayforkCounts.km,
          gain: hayforkCounts.gain,
          built: hayforkCounts.built,
          draft: hayforkCounts.draft,
          optimized: hayforkCounts.optimized,
        }
      : p,
  );

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
            <ProjectCard key={p.name} p={p} i={i} onOpen={() => navigate('/network-map')} />
          ))
        )}
      </div>

      <BottomTabBar active="projects" />
      <NavPill />
    </div>
  );
}

function ProjectCard({ p, i, onOpen }: { p: Project; i: number; onOpen: () => void }) {
  const accent = tagStroke[p.tag];
  const isActive = i === 0;
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
