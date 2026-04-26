import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { MapGeoLine } from '../components/MapGeoLine';
import { MapWaypoint, FitBoundsToCoords } from '../components/MapMarkers';
import { WaypointPhoto } from '../components/WaypointPhoto';
import { resolveCssVar } from '../utils/geo';
import { useActiveProject } from '../store/projects';
import { useLibrary } from '../store/library';
import { haversineKm } from '../store/recording';

type WaypointFilter = 'ALL' | 'WATER' | 'HAZARD' | 'VISTA' | 'PHOTO' | 'CAMP';
const FILTER_KEYS: readonly WaypointFilter[] = ['ALL', 'WATER', 'HAZARD', 'VISTA', 'PHOTO', 'CAMP'] as const;

export function WaypointsScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const routes = useLibrary((s) => s.routes);
  const route = useMemo(
    () => (id ? routes.find((r) => r.id === id) : null) ?? routes[0],
    [id, routes],
  );

  const [filter, setFilter] = useState<WaypointFilter>('ALL');
  const activeProject = useActiveProject();

  if (!route) {
    return <div className="screen"><StatusBar /><NavPill /></div>;
  }

  // Per-waypoint distance from route start, computed once per route.
  const waypointsWithDist = useMemo(() => {
    if (route.geo.length < 2) return route.waypoints.map((w) => ({ ...w, distKm: 0 }));
    return route.waypoints.map((w) => {
      // Find nearest vertex on the route to the waypoint, then sum the
      // route's leading segments up to that vertex for the distance.
      let bestIdx = 0; let best = Infinity;
      for (let i = 0; i < route.geo.length; i++) {
        const d = haversineKm(route.geo[i], w.coord);
        if (d < best) { best = d; bestIdx = i; }
      }
      let dist = 0;
      for (let i = 1; i <= bestIdx; i++) dist += haversineKm(route.geo[i - 1], route.geo[i]);
      return { ...w, distKm: dist };
    });
  }, [route.geo, route.waypoints]);

  const visibleWaypoints = waypointsWithDist.filter(
    (w) => filter === 'ALL' || w.type === filter,
  );
  const visibleMapPins = visibleWaypoints;

  // Per-type counts for the chip labels.
  const typeCounts: Record<string, number> = waypointsWithDist.reduce<Record<string, number>>((acc, w) => {
    acc[w.type] = (acc[w.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="screen">
      <StatusBar />

      {/* Header */}
      <div style={{ padding: '6px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={() => navigate(`/details/${route.id}`)}
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
          aria-label="Back to details"
        >
          <Icon name="back" size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="eyebrow">{route.name.toUpperCase()}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>
            Waypoints{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--moss)' }}>· {waypointsWithDist.length}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/record?follow=${encodeURIComponent(route.id)}`)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--blaze)',
            display: 'grid',
            placeItems: 'center',
            border: 'none',
          }}
          aria-label="Record + capture waypoints"
        >
          <Icon name="plus" size={18} color="#1A1208" />
        </button>
      </div>

      {/* Mini map */}
      <div
        style={{
          height: 180,
          margin: '0 12px',
          borderRadius: 16,
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid var(--line-soft)',
        }}
      >
        <MapCanvas
          center={route.geo[0] ?? activeProject.center}
          zoom={14}
          interactive={false}
          hillshade={route.projectId === 'hayfork'}
        >
          <FitBoundsToCoords coords={route.geo} padding={36} />
          <MapGeoLine id={`wp-${route.id}-trail`} coords={route.geo} color={resolveCssVar('var(--blaze)')} width={2.5} onTop />
          {visibleMapPins.map((w) => (
            <MapWaypoint key={w.id} coord={w.coord} icon={w.icon} color={resolveCssVar(w.color)} size={20} />
          ))}
        </MapCanvas>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 16px 8px', overflowX: 'auto' }}>
        {FILTER_KEYS.map((k) => {
          const active = filter === k;
          const count = k === 'ALL' ? waypointsWithDist.length : (typeCounts[k] ?? 0);
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              style={{
                flexShrink: 0,
                padding: '5px 10px',
                borderRadius: 100,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                background: active ? 'var(--bone)' : 'var(--surface-2)',
                color: active ? 'var(--bg)' : 'var(--bone-dim)',
                border: active ? 'none' : '1px solid var(--line-soft)',
              }}
            >
              {k} {count}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
        {visibleWaypoints.length === 0 ? (
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
            {waypointsWithDist.length === 0
              ? 'NO WAYPOINTS · CAPTURE SOME WHILE RECORDING'
              : `NO ${filter} WAYPOINTS`}
          </div>
        ) : visibleWaypoints.map((w) => (
          <div
            key={w.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              background: 'var(--surface)',
              border: '1px solid var(--line-soft)',
              borderRadius: 14,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: 'var(--surface-2)',
                border: `1.5px solid ${w.color}`,
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 700,
                color: w.color,
                flexShrink: 0,
              }}
            >
              {w.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500 }}>
                {w.label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--moss)',
                  letterSpacing: '0.06em',
                  marginTop: 2,
                }}
              >
                {w.type} · CAPTURED {w.t}
              </div>
            </div>
            {w.photoId && <WaypointPhoto photoId={w.photoId} size={44} />}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone-dim)' }}>
              {w.distKm.toFixed(1)} km
            </div>
          </div>
        ))}
      </div>
      <NavPill />
    </div>
  );
}
