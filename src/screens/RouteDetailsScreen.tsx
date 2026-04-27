import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { ElevChart } from '../components/ElevChart';
import { SlopeRibbon } from '../components/SlopeRibbon';
import { DataRow } from '../components/DataRow';
import { useLibrary, type LibraryRoute } from '../store/library';
import type { ChipTone } from '../components/Chip';
import { downloadString, serializeRoutesToGeoJson } from '../utils/geojson';
import { routeChartData } from '../utils/elevation';
import { WaypointPhoto } from '../components/WaypointPhoto';
import { useActiveProject } from '../store/projects';
import { buildNetwork } from '../utils/network';

interface StatEntry {
  l: string;
  v: string;
  u: string;
  c?: string;
}

const tagToTargetText: Record<RouteStatusKey, string> = {
  optimized: '7.0% · cap 12%',
  built:     '— · field-built',
  draft:     'unset',
  review:    '12.0% · cap 15%',
};

type RouteStatusKey = LibraryRoute['status'];

/** Minimum-fidelity slope series derived from the spark + average grade. */
function slopeSeriesFromSpark(spark: number[]): number[] {
  if (spark.length < 2) return [0];
  const out: number[] = [];
  for (let i = 1; i < spark.length; i++) {
    // Convert elevation deltas to a synthetic %-grade. Each segment is one
    // SlopeRibbon bar — clamp to ±15 so the ribbon stays readable.
    const d = spark[i] - spark[i - 1];
    const grade = Math.max(-18, Math.min(18, d / 8));
    out.push(grade);
  }
  return out;
}

function statsForRoute(r: LibraryRoute): StatEntry[] {
  const minElev = Math.min(...r.spark);
  const maxElev = Math.max(...r.spark);
  const lossNum = parseInt(r.gain.replace(/[^\d-]/g, ''), 10) || 0;
  const slope = slopeSeriesFromSpark(r.spark);
  const maxGrade = slope.length ? Math.max(...slope.map(Math.abs)) : 0;
  return [
    { l: 'LENGTH',    v: r.km,                  u: 'km' },
    { l: 'GAIN',      v: r.gain,                u: 'm', c: 'var(--good)' },
    { l: 'LOSS',      v: `−${Math.abs(lossNum)}`, u: 'm', c: 'var(--topo)' },
    { l: 'AVG GRADE', v: r.grade,               u: '%' },
    { l: 'MAX GRADE', v: maxGrade.toFixed(1),   u: '%', c: maxGrade > 10 ? 'var(--warn)' : undefined },
    { l: 'ELEV',      v: `${minElev}-${maxElev}`, u: 'm' },
  ];
}

const tagColor = (tag: ChipTone | null): string =>
  tag === 'blaze' ? 'var(--blaze)'
  : tag === 'warn' ? 'var(--warn)'
  : tag === 'good' ? 'var(--good)'
  : 'var(--bone)';

export function RouteDetailsScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const routes = useLibrary((s) => s.routes);
  const renameRoute = useLibrary((s) => s.renameRoute);
  const removeRoute = useLibrary((s) => s.removeRoute);

  // Look up the route from the URL param, falling back to the top of the library
  // (e.g. when the canvas previews this screen without a specific route in mind).
  const route = useMemo(
    () => (id ? routes.find((r) => r.id === id) : null) ?? routes[0],
    [id, routes],
  );

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  if (!route) {
    return (
      <div className="screen">
        <StatusBar />
        <div style={{ padding: 24, color: 'var(--bone-dim)' }}>
          No route selected.{' '}
          <button type="button" onClick={() => navigate('/library')} style={{ color: 'var(--blaze)' }}>
            Back to library
          </button>
        </div>
        <NavPill />
      </div>
    );
  }

  const stats = useMemo(() => statsForRoute(route), [route]);
  // Prefer the real per-vertex elevations when present (Hayfork-imported or
  // recorded routes), downsampled lightly so 200+ vertex profiles still
  // render fast in the 90px chart. Falls back to the lower-res `spark`.
  const chart = useMemo(() => routeChartData(route, 80), [route]);
  const slope = useMemo(() => slopeSeriesFromSpark(chart), [chart]);
  const elevMin = Math.min(...chart);
  const elevMax = Math.max(...chart);
  const accent = tagColor(route.tag);
  const peakIdx = chart.indexOf(elevMax);

  // Connecting trails — derived from the live junction graph for the active
  // project. Lists every other route this one shares a junction with so the
  // user can hop. Cheap because buildNetwork memoizes well via useMemo.
  const activeProject = useActiveProject();
  const projectRoutes = useMemo(
    () => routes.filter((r) => r.projectId === activeProject.id && r.geo.length >= 2),
    [routes, activeProject.id],
  );
  const connectingRoutes = useMemo(() => {
    if (!route || route.geo.length < 2) return [] as LibraryRoute[];
    const net = buildNetwork(projectRoutes);
    const myIdx = projectRoutes.findIndex((r) => r.id === route.id);
    if (myIdx === -1) return [];
    // Walk the junction set: any cross-route adjacency where one side is on
    // me identifies a connecting route.
    const connectedIdxs = new Set<number>();
    for (const id of net.junctions) {
      const node = net.nodes.get(id);
      if (!node || node.routeIdx !== myIdx) continue;
      for (const edge of net.adj.get(id) ?? []) {
        const other = net.nodes.get(edge.to);
        if (other && other.routeIdx !== myIdx) connectedIdxs.add(other.routeIdx);
      }
    }
    return Array.from(connectedIdxs).map((i) => projectRoutes[i]).filter(Boolean);
  }, [projectRoutes, route]);

  const photoWaypoints = route.waypoints.filter((w) => w.photoId);

  return (
    <div className="screen">
      <StatusBar />

      <div className="appbar">
        <button
          type="button"
          className="iconbtn"
          onClick={() => navigate('/library')}
          aria-label="Back to library"
          style={{ cursor: 'pointer' }}
        >
          <Icon name="back" size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">ROUTE · {route.id.slice(0, 8).toUpperCase()}</div>
          {editingName ? (
            <input
              type="text"
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  renameRoute(route.id, draftName);
                  setEditingName(false);
                } else if (e.key === 'Escape') {
                  setEditingName(false);
                }
              }}
              onBlur={() => {
                if (draftName.trim() && draftName.trim() !== route.name) {
                  renameRoute(route.id, draftName);
                }
                setEditingName(false);
              }}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--blaze)',
                outline: 'none',
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 500,
                color: 'var(--bone)',
                letterSpacing: '-0.01em',
                padding: '2px 0',
                caretColor: 'var(--blaze)',
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => { setDraftName(route.name); setEditingName(true); }}
              style={{
                all: 'unset',
                display: 'block',
                width: '100%',
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: accent,
                cursor: 'text',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title="Tap to rename"
            >
              {route.name}
            </button>
          )}
        </div>
        <button
          type="button"
          className="iconbtn"
          onClick={() => {
            if (!confirm(`Delete "${route.name}"?`)) return;
            removeRoute(route.id);
            navigate('/library');
          }}
          aria-label="Delete route"
          style={{ color: 'var(--danger)' }}
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {stats.map((s) => (
            <div
              key={s.l}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: 'var(--surface)',
                border: '1px solid var(--line-soft)',
              }}
            >
              <div className="stat-label">{s.l}</div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 22,
                  color: s.c ?? 'var(--bone)',
                  letterSpacing: '-0.02em',
                  marginTop: 2,
                }}
              >
                {s.v}
                <span className="stat-unit"> {s.u}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Photo strip — appears when at least one waypoint has a captured
            photo. Tap a thumbnail to jump to the full waypoint list. */}
        {photoWaypoints.length > 0 && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              background: 'var(--surface)',
              borderRadius: 16,
              border: '1px solid var(--line-soft)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <div className="eyebrow">PHOTOS</div>
              <button
                type="button"
                onClick={() => navigate(`/waypoints/${route.id}`)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moss)', letterSpacing: '0.08em' }}
              >
                ALL {route.waypoints.length} WAYPOINTS →
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {photoWaypoints.map((w) => (
                <WaypointPhoto
                  key={w.id}
                  photoId={w.photoId!}
                  size={64}
                  alt={w.label}
                  onClick={() => navigate(`/waypoints/${route.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Connecting trails — derived from the junction graph. Tap to jump
            into another connected route's details. Hidden when the route is
            isolated (no junctions to other trails in the project). */}
        {connectingRoutes.length > 0 && (
          <div
            style={{
              marginTop: 10,
              padding: 14,
              background: 'var(--surface)',
              borderRadius: 16,
              border: '1px solid var(--line-soft)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <div className="eyebrow">CONNECTS TO</div>
              <button
                type="button"
                onClick={() => navigate('/network-map')}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moss)', letterSpacing: '0.08em' }}
              >
                NETWORK MAP →
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {connectingRoutes.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/details/${r.id}`)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line-soft)',
                    color: 'var(--bone)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: tagColor(r.tag) }} />
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Elevation Profile */}
        <div
          style={{
            marginTop: 16,
            padding: 14,
            background: 'var(--surface)',
            borderRadius: 16,
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
            <div className="eyebrow">ELEVATION PROFILE</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moss)' }}>
              {elevMin} → {elevMax} m
            </div>
          </div>
          <div style={{ height: 90, position: 'relative' }}>
            <ElevChart data={chart} height={90} mark={peakIdx} color={accent} />
            <div style={{ position: 'absolute', left: 0, top: 2, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)' }}>{elevMax}</div>
            <div style={{ position: 'absolute', left: 0, bottom: 2, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)' }}>{elevMin}</div>
            <div style={{ position: 'absolute', right: 0, bottom: -14, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)' }}>{route.km} km</div>
            <div style={{ position: 'absolute', left: 24, bottom: -14, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)' }}>0</div>
          </div>
        </div>

        {/* Slope ribbon */}
        <div
          style={{
            marginTop: 10,
            padding: 14,
            background: 'var(--surface)',
            borderRadius: 16,
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
            <div className="eyebrow">GRADE BY SEGMENT</div>
            <div
              style={{
                display: 'flex',
                gap: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--moss)',
              }}
            >
              <span style={{ color: 'var(--good)' }}>■ CLIMB</span>
              <span style={{ color: 'var(--topo)' }}>■ DESCENT</span>
              <span style={{ color: 'var(--warn)' }}>■ STEEP</span>
            </div>
          </div>
          <div style={{ height: 50 }}>
            <SlopeRibbon data={slope} height={50} />
          </div>
        </div>

        {/* Terrain breakdown */}
        <div
          style={{
            marginTop: 10,
            padding: '6px 14px',
            background: 'var(--surface)',
            borderRadius: 16,
            border: '1px solid var(--line-soft)',
          }}
        >
          <DataRow label="STATUS"   value={route.status.toUpperCase()} />
          <DataRow label="VERTICES" value={String(route.geo.length)} />
          <button
            type="button"
            onClick={() => navigate(`/waypoints/${route.id}`)}
            style={{
              all: 'unset',
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '1px solid var(--line-soft)',
              cursor: 'pointer',
            }}
          >
            <span className="stat-label">WAYPOINTS</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)', fontWeight: 500 }}>
              {route.waypoints.length}
              <Icon name="chevron-right" size={14} color="var(--moss)" />
            </span>
          </button>
          <DataRow label="SURFACE" value="SINGLETRACK" />
          <DataRow label="LAST EDITED" value="APR 25" unit="2026" />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
            <span className="stat-label">OPTIMIZER TARGET</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: accent }}>
              {tagToTargetText[route.status]}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => navigate(`/record?follow=${encodeURIComponent(route.id)}`)}
          >
            <Icon name="route" size={16} /> Follow & record
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(`/map/${route.id}`)} aria-label="Open on map">
            <Icon name="pin" size={16} />
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(`/editor/${route.id}`)} aria-label="Edit vertices">
            <Icon name="edit" size={16} />
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const fname = `${route.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.geojson`;
              downloadString(fname, 'application/geo+json', serializeRoutesToGeoJson([route]));
            }}
            aria-label="Export GeoJSON"
          >
            <Icon name="download" size={16} />
          </button>
        </div>
      </div>
      <NavPill />
    </div>
  );
}
