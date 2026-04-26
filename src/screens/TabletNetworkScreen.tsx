import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { ElevChart } from '../components/ElevChart';
import { useLibrary, type LibraryRoute } from '../store/library';
import { useActiveProject } from '../store/projects';
import { routeChartData } from '../utils/elevation';

interface TabletTrail {
  name: string;
  color: string;
  pts: Array<[number, number]>;
  solid: boolean;
  active?: boolean;
}

const NETWORK: TabletTrail[] = [
  {
    name: 'Hayfork Loop', color: 'var(--blaze)',
    pts: [
      [80, 760], [150, 720], [230, 680], [310, 640], [385, 600], [460, 560],
      [535, 520], [610, 480], [685, 440], [740, 400], [770, 350], [755, 300], [720, 260],
    ],
    solid: true, active: true,
  },
  { name: 'North Ridge',  color: 'var(--good)', pts: [[720, 260], [780, 200], [820, 150], [810, 90]], solid: true },
  { name: 'Creek Cutoff', color: 'var(--good)', pts: [[310, 640], [250, 590], [190, 560], [130, 530]], solid: true },
  { name: 'Manzanita SW', color: 'var(--bone)', pts: [[535, 520], [570, 450], [545, 390], [580, 340], [555, 280], [605, 250]], solid: false },
  { name: 'Meadow Link',  color: 'var(--topo)', pts: [[460, 560], [400, 470], [355, 410], [325, 350]], solid: false },
];

const RAIL: Array<{ icon: IconName; label: string; to: string }> = [
  { icon: 'compass',  label: 'Home',      to: '/home'      },
  { icon: 'layers',   label: 'Projects',  to: '/tablet'    },
  { icon: 'waypoint', label: 'Waypoints', to: '/waypoints' },
  { icon: 'record',   label: 'Record',    to: '/record'    },
  { icon: 'download', label: 'Offline',   to: '/offline'   },
  { icon: 'settings', label: 'Settings',  to: '/settings'  },
];

const LAYER_TOGGLES = [
  { label: 'OPTIMIZED', color: 'var(--blaze)', on: true },
  { label: 'BUILT',     color: 'var(--good)',  on: true },
  { label: 'DRAFT',     color: 'var(--bone)',  on: true },
  { label: 'PROPOSED',  color: 'var(--topo)',  on: true },
];

const INSPECTOR_WAYPOINTS = [
  { icon: 'W', color: 'var(--topo)',   label: 'Big Creek spring', dist: '0.8 km' },
  { icon: 'H', color: 'var(--danger)', label: 'Loose scree',       dist: '1.4 km' },
  { icon: 'V', color: 'var(--warn)',   label: 'Ridge overlook',    dist: '2.1 km' },
];

const TOOL_ICONS: IconName[] = ['mountain', 'compass', 'target', 'search'];

function statsForRoute(r: LibraryRoute): Array<[string, string, string | null]> {
  const slope = r.spark.length > 1 ? r.spark.slice(1).map((v, i) => Math.abs(v - r.spark[i])) : [0];
  const maxGrade = (Math.max(...slope) / 8).toFixed(1);
  return [
    ['DISTANCE',  `${r.km} km`,           null],
    ['GAIN',      `${r.gain} m`,          'var(--blaze)'],
    ['AVG GRADE', `${r.grade}%`,          'var(--good)'],
    ['MAX GRADE', `${maxGrade}%`,         'var(--warn)'],
  ];
}

export function TabletNetworkScreen() {
  const navigate = useNavigate();
  const allRoutes = useLibrary((s) => s.routes);
  const activeProject = useActiveProject();
  const routes = useMemo(
    () => allRoutes.filter((r) => r.projectId === activeProject.id),
    [allRoutes, activeProject.id],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => (selectedId ? routes.find((r) => r.id === selectedId) : null) ?? routes[0],
    [selectedId, routes],
  );

  const stats = selected ? statsForRoute(selected) : [];

  // "N TRAILS · X.X KM · …BUILT/DRAFT/OPT" header — derived from the live library.
  const projectSummary = useMemo(() => {
    let kmSum = 0, built = 0, draft = 0, opt = 0;
    for (const r of routes) {
      kmSum += parseFloat(r.km) || 0;
      if (r.status === 'built') built += 1;
      else if (r.status === 'draft') draft += 1;
      else if (r.status === 'optimized') opt += 1;
    }
    return `${routes.length} TRAILS · ${kmSum.toFixed(1)} KM · ${built} BUILT · ${draft} DRAFT · ${opt} OPT`;
  }, [routes]);
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        fontFamily: 'var(--font-body)',
        background: 'var(--bg)',
        color: 'var(--bone)',
        overflow: 'hidden',
      }}
    >
      {/* Left rail */}
      <div
        style={{
          width: 76,
          flexShrink: 0,
          background: 'var(--surface)',
          borderRight: '1px solid var(--line-soft)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px 0',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'var(--blaze)',
            display: 'grid',
            placeItems: 'center',
            marginBottom: 24,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 19 L8 12 L12 16 L16 8 L21 19 Z" fill="#1A1208" />
          </svg>
        </div>
        {RAIL.map((it) => {
          const active = it.to === '/tablet';
          return (
            <button
              key={it.label}
              type="button"
              onClick={() => navigate(it.to)}
              style={{
                width: 60,
                padding: '10px 0',
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                marginBottom: 6,
                background: active ? 'color-mix(in oklch, var(--blaze) 15%, transparent)' : 'transparent',
                border: 'none',
                color: active ? 'var(--blaze)' : 'var(--bone-dim)',
              }}
            >
              <Icon name={it.icon} size={22} color={active ? 'var(--blaze)' : 'var(--bone-dim)'} />
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  color: active ? 'var(--blaze)' : 'var(--moss)',
                }}
              >
                {it.label.toUpperCase()}
              </div>
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: 'var(--surface-2)',
            border: '1px solid var(--line-soft)',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--bone)',
          }}
        >
          MR
        </div>
      </div>

      {/* Main map column */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          minWidth: 0,
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            borderBottom: '1px solid var(--line-soft)',
          }}
        >
          <div>
            <div className="eyebrow" style={{ color: 'var(--blaze)' }}>◉ PROJECT</div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              {activeProject.name}
            </div>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--moss)',
              letterSpacing: '0.08em',
            }}
          >
            {projectSummary}
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', gap: 6 }}>
            {LAYER_TOGGLES.map((l) => (
              <div
                key={l.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 100,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line-soft)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  color: l.on ? 'var(--bone)' : 'var(--moss)',
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 4, background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>

          <div style={{ width: 1, height: 28, background: 'var(--line-soft)' }} />

          <div className="btn btn-primary" style={{ padding: '8px 14px' }}>
            <Icon name="plus" size={16} /> New route
          </div>
        </div>

        {/* Big map */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <svg
            viewBox="0 0 900 820"
            preserveAspectRatio="xMidYMid slice"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <defs>
              <radialGradient id="tabletHill" cx="55%" cy="45%" r="70%">
                <stop offset="0%"   stopColor="#1A1F14" />
                <stop offset="100%" stopColor="#0C1008" />
              </radialGradient>
            </defs>
            <rect width="900" height="820" fill="url(#tabletHill)" />

            {[...Array(14)].map((_, k) => (
              <ellipse
                key={k}
                cx={520}
                cy={400}
                rx={60 + k * 55}
                ry={40 + k * 38}
                fill="none"
                stroke="var(--moss-dim)"
                strokeWidth={k % 4 === 0 ? 1 : 0.4}
                opacity={k % 4 === 0 ? 0.55 : 0.3}
              />
            ))}
            {[...Array(8)].map((_, k) => (
              <ellipse
                key={`a${k}`}
                cx={220}
                cy={600}
                rx={40 + k * 32}
                ry={28 + k * 22}
                fill="none"
                stroke="var(--moss-dim)"
                strokeWidth={k % 3 === 0 ? 0.7 : 0.35}
                opacity={k % 3 === 0 ? 0.5 : 0.25}
              />
            ))}

            {/* Ridge tick marks */}
            <g stroke="var(--moss-dim)" strokeWidth="0.5" opacity="0.4">
              {[...Array(20)].map((_, i) => {
                const a = (i / 20) * Math.PI * 2;
                const r1 = 215;
                const r2 = 222;
                return (
                  <line
                    key={i}
                    x1={520 + Math.cos(a) * r1}
                    y1={400 + Math.sin(a) * (r1 * 0.72)}
                    x2={520 + Math.cos(a) * r2}
                    y2={400 + Math.sin(a) * (r2 * 0.72)}
                  />
                );
              })}
            </g>

            {/* Trails */}
            {NETWORK.map((t, i) => {
              const d = t.pts
                .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`)
                .join(' ');
              return (
                <g key={i}>
                  {t.active && (
                    <path
                      d={d}
                      fill="none"
                      stroke={t.color}
                      strokeWidth="14"
                      opacity="0.12"
                      strokeLinecap="round"
                    />
                  )}
                  <path
                    d={d}
                    fill="none"
                    stroke={t.color}
                    strokeWidth={t.active ? 4 : 3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={t.solid ? undefined : '5 5'}
                  />
                </g>
              );
            })}

            {/* Trailheads & peak */}
            <circle cx={80}  cy={760} r="8" fill="var(--good)"   stroke="#12160F" strokeWidth="2" />
            <text x={96} y={764} fontFamily="var(--font-mono)" fontSize="10" fill="var(--bone)" letterSpacing="0.6">
              TH
            </text>
            <circle cx={810} cy={90}  r="8" fill="var(--danger)" stroke="#12160F" strokeWidth="2" />
            <text x={770} y={84} fontFamily="var(--font-mono)" fontSize="10" fill="var(--bone)" letterSpacing="0.6">
              PEAK 1842m
            </text>

            {/* Junction nodes */}
            {[[720, 260], [310, 640], [535, 520], [460, 560]].map((p, i) => (
              <circle
                key={i}
                cx={p[0]}
                cy={p[1]}
                r="6"
                fill="var(--surface-2)"
                stroke="var(--bone)"
                strokeWidth="1.5"
              />
            ))}

            {/* Waypoints */}
            {([[230, 680, 'W', 'var(--topo)'], [460, 560, 'H', 'var(--danger)'], [685, 440, 'V', 'var(--warn)']] as Array<[number, number, string, string]>).map((w, i) => (
              <g key={`w${i}`} transform={`translate(${w[0]}, ${w[1]})`}>
                <circle r="16" fill={w[3]} opacity="0.2" />
                <circle r="11" fill="var(--surface)" stroke={w[3]} strokeWidth="2" />
                <text
                  y="4"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize="11"
                  fontWeight="700"
                  fill={w[3]}
                >
                  {w[2]}
                </text>
              </g>
            ))}

            {/* Trail labels */}
            <g fontFamily="var(--font-mono)" fontSize="10" fill="var(--bone-dim)" letterSpacing="0.7">
              <text x={380} y={605} fill="var(--blaze)">HAYFORK LOOP</text>
              <text x={820} y={180}>N. RIDGE</text>
              <text x={130} y={555}>CREEK CUTOFF</text>
              <text x={590} y={320}>MANZANITA SW</text>
              <text x={330} y={380} fill="var(--topo)">MEADOW LINK (PROP)</text>
            </g>

            {/* North arrow */}
            <g transform="translate(850, 770)">
              <circle
                r="14"
                fill="color-mix(in oklch, var(--surface) 90%, transparent)"
                stroke="var(--line-soft)"
              />
              <path d="M 0 -8 L 4 6 L 0 3 L -4 6 Z" fill="var(--blaze)" />
              <text
                y="-18"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize="9"
                fill="var(--bone-dim)"
                letterSpacing="0.5"
              >
                N
              </text>
            </g>
          </svg>

          {/* Scale bar */}
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              padding: '6px 10px',
              borderRadius: 8,
              background: 'color-mix(in oklch, var(--surface) 90%, transparent)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--line-soft)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--bone-dim)',
              letterSpacing: '0.08em',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 60, height: 3, background: 'var(--bone)' }} />
              <span>500 M</span>
            </div>
          </div>

          {/* Map tools */}
          <div
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {TOOL_ICONS.map((i) => (
              <div
                key={i}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'color-mix(in oklch, var(--surface) 90%, transparent)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid var(--line-soft)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name={i} size={18} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right inspector */}
      <div
        style={{
          width: 380,
          flexShrink: 0,
          background: 'var(--surface)',
          borderLeft: '1px solid var(--line-soft)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Selected trail header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div className="eyebrow" style={{ color: 'var(--blaze)' }}>SELECTED · OPTIMIZED</div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--moss)',
                letterSpacing: '0.08em',
                marginLeft: 'auto',
              }}
            >
              v3 · APR 24
            </div>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              marginTop: 4,
            }}
          >
            {selected?.name ?? '—'}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--moss)',
              letterSpacing: '0.06em',
              marginTop: 4,
            }}
          >
            {selected ? `${selected.status.toUpperCase()} · ${selected.km} km · ${selected.gain} m` : ''}
          </div>
          {/* Route picker — pick any library route */}
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {routes.slice(0, 6).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 100,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.06em',
                  background: r.id === selected?.id ? 'var(--blaze)' : 'var(--surface-2)',
                  color: r.id === selected?.id ? '#1A1208' : 'var(--bone-dim)',
                  border: '1px solid var(--line-soft)',
                }}
              >
                {r.name.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Stats grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            padding: '12px 14px',
            gap: 1,
            background: 'var(--line-soft)',
            borderBottom: '1px solid var(--line-soft)',
          }}
        >
          {stats.map(([l, v, c]) => (
            <div key={l} style={{ padding: '10px 6px', background: 'var(--surface)' }}>
              <div className="stat-label">{l}</div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 18,
                  color: c ?? 'var(--bone)',
                  marginTop: 3,
                  fontWeight: 500,
                }}
              >
                {v}
              </div>
            </div>
          ))}
        </div>

        {/* Elevation profile */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-soft)' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>ELEVATION · CROSS-SECTION</div>
          <div style={{ height: 70 }}>
            {(() => {
              const series = selected ? routeChartData(selected, 80) : [420];
              return (
                <ElevChart
                  data={series}
                  height={70}
                  mark={Math.floor(series.length / 2)}
                />
              );
            })()}
          </div>
        </div>

        {/* Waypoints list */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-soft)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <div className="eyebrow">WAYPOINTS · 3</div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--blaze)',
                letterSpacing: '0.08em',
              }}
            >
              + ADD
            </div>
          </div>
          {INSPECTOR_WAYPOINTS.map((w) => (
            <div
              key={w.label}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  background: 'var(--surface-2)',
                  border: `1.5px solid ${w.color}`,
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: w.color,
                }}
              >
                {w.icon}
              </div>
              <div style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 13 }}>{w.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--moss)' }}>
                {w.dist}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div
          style={{
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 'auto',
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => navigate('/optimizer')}
          >
            <Icon name="mountain" size={16} /> Optimize
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ flex: 1 }}
              onClick={() => selected && navigate(`/record?follow=${encodeURIComponent(selected.id)}`)}
            >
              <Icon name="record" size={16} /> Follow
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ flex: 1 }}
              onClick={async () => {
                if (!selected) return;
                const { downloadString, serializeRoutesToGeoJson } = await import('../utils/geojson');
                const fname = `${selected.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.geojson`;
                downloadString(fname, 'application/geo+json', serializeRoutesToGeoJson([selected]));
              }}
            >
              <Icon name="download" size={16} /> Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
