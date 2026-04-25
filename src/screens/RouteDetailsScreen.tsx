import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { ElevChart } from '../components/ElevChart';
import { SlopeRibbon } from '../components/SlopeRibbon';
import { DataRow } from '../components/DataRow';
import { useLibrary, type LibraryRoute } from '../store/library';
import type { ChipTone } from '../components/Chip';

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

  // Look up the route from the URL param, falling back to the top of the library
  // (e.g. when the canvas previews this screen without a specific route in mind).
  const route = useMemo(
    () => (id ? routes.find((r) => r.id === id) : null) ?? routes[0],
    [id, routes],
  );

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
  const slope = useMemo(() => slopeSeriesFromSpark(route.spark), [route.spark]);
  const elevMin = Math.min(...route.spark);
  const elevMax = Math.max(...route.spark);
  const accent = tagColor(route.tag);
  const peakIdx = route.spark.indexOf(elevMax);

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
        <div style={{ flex: 1 }}>
          <div className="eyebrow">ROUTE · {route.id.slice(0, 8).toUpperCase()}</div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              color: accent,
            }}
          >
            {route.name}
          </div>
        </div>
        <div className="iconbtn">
          <Icon name="more" size={18} />
        </div>
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
            <ElevChart data={route.spark} height={90} mark={peakIdx} color={accent} />
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
          <DataRow label="STATUS"  value={route.status.toUpperCase()} />
          <DataRow label="VERTICES" value={String(route.spark.length * 12)} />
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
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate('/map')}>
            Follow route
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/editor')} aria-label="Edit vertices">
            <Icon name="edit" size={16} />
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/optimizer')} aria-label="Optimize">
            <Icon name="download" size={16} />
          </button>
        </div>
      </div>
      <NavPill />
    </div>
  );
}
