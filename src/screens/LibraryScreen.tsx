import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { ElevChart } from '../components/ElevChart';
import { BottomTabBar } from '../components/BottomTabBar';
import type { ChipTone } from '../components/Chip';
import { useLibrary, type RouteStatus } from '../store/library';

type Segment = 'ALL' | 'BUILT' | 'DRAFT' | 'OPTIMIZED';
const SEGMENTS: readonly Segment[] = ['ALL', 'BUILT', 'DRAFT', 'OPTIMIZED'] as const;

const SEGMENT_PREDICATE: Record<Segment, (status: RouteStatus) => boolean> = {
  ALL:       () => true,
  BUILT:     (s) => s === 'built',
  DRAFT:     (s) => s === 'draft',
  OPTIMIZED: (s) => s === 'optimized',
};

const rowColor = (tag: ChipTone | null): string =>
  tag === 'blaze' ? 'var(--blaze)'
  : tag === 'warn'  ? 'var(--warn)'
  : tag === 'good'  ? 'var(--good)'
  : 'var(--bone)';

const sparkColor = (tag: ChipTone | null): string =>
  tag === 'warn' ? 'var(--warn)'
  : tag === 'good' ? 'var(--good)'
  : 'var(--blaze)';

/** Sum of distances across all routes (km). Route strings like "14.2". */
const sumKm = (routes: Array<{ km: string }>): string =>
  routes.reduce((acc, r) => acc + (parseFloat(r.km) || 0), 0).toFixed(1);

/** Sum of gains ("+640" → 640). */
const sumGain = (routes: Array<{ gain: string }>): string => {
  const n = routes.reduce((acc, r) => acc + (parseInt(r.gain.replace(/[^\d-]/g, ''), 10) || 0), 0);
  return n.toLocaleString();
};

export function LibraryScreen() {
  const navigate = useNavigate();
  const allRoutes = useLibrary((s) => s.routes);
  const [segment, setSegment] = useState<Segment>('ALL');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const q = search.trim().toLowerCase();
  const ROUTES = allRoutes
    .filter((r) => SEGMENT_PREDICATE[segment](r.status))
    .filter((r) => !q || r.name.toLowerCase().includes(q));
  return (
    <div className="screen">
      <StatusBar />

      {/* Header */}
      <div style={{ padding: '12px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="stat-label">PROJECT · HAYFORK</div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: '-0.02em',
                marginTop: 2,
              }}
            >
              Routes
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearch(''); }}
              aria-label={searchOpen ? 'Close search' : 'Search routes'}
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
              aria-label="Filter"
              style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'var(--surface-2)',
                color: 'var(--bone)',
                display: 'grid', placeItems: 'center',
                border: '1px solid var(--line-soft)',
              }}
            >
              <Icon name="filter" size={18} />
            </button>
          </div>
        </div>

        {searchOpen && (
          <input
            type="search"
            autoFocus
            placeholder="Search routes…"
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
            { k: 'TOTAL',  v: sumKm(ROUTES),        u: 'km' },
            { k: 'GAIN',   v: `+${sumGain(ROUTES)}`, u: 'm' },
            { k: 'ROUTES', v: String(ROUTES.length), u: ''  },
          ].map((s) => (
            <div
              key={s.k}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 12,
                background: 'var(--surface-2)',
                border: '1px solid var(--line-soft)',
              }}
            >
              <div className="stat-label">{s.k}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--bone)', marginTop: 2 }}>
                {s.v}
                {s.u && <span style={{ fontSize: 11, color: 'var(--moss)' }}> {s.u}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Segmented tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '0 20px 14px' }}>
        {SEGMENTS.map((t) => {
          const active = segment === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setSegment(t)}
              style={{
                padding: '6px 12px', borderRadius: 100,
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
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

      {/* Routes list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
        {ROUTES.length === 0 && (
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
            {q ? `NO ROUTES MATCH "${search}"` : `NO ${segment} ROUTES`}
          </div>
        )}
        {ROUTES.map((r, i) => (
          <button
            key={r.id}
            type="button"
            onClick={() => navigate(`/details/${r.id}`)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line-soft)',
              borderRadius: 16,
              padding: 14,
              marginBottom: 10,
              display: 'flex',
              gap: 12,
              textAlign: 'left',
              color: 'var(--bone)',
              width: '100%',
            }}
          >
            {/* mini topo square */}
            <div
              style={{
                width: 72, height: 72, borderRadius: 10, flexShrink: 0,
                background: 'var(--surface-2)',
                position: 'relative', overflow: 'hidden',
                border: '1px solid var(--line-soft)',
              }}
            >
              <svg viewBox="0 0 72 72" style={{ position: 'absolute', inset: 0 }}>
                {[0, 1, 2, 3, 4].map((k) => (
                  <ellipse
                    key={k}
                    cx={36 + Math.sin(i + k) * 6}
                    cy={36 + Math.cos(i) * 4}
                    rx={10 + k * 7}
                    ry={8 + k * 5}
                    fill="none"
                    stroke="var(--moss-dim)"
                    strokeWidth={k === 0 || k === 4 ? 0.5 : 0.3}
                    opacity="0.5"
                  />
                ))}
                <path
                  d={`M 8 ${50 - i * 3} Q 30 ${20 + i * 2}, 50 ${30 + i * 3} T 68 ${40 + i * 2}`}
                  fill="none"
                  stroke={rowColor(r.tag)}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 16,
                    fontWeight: 500,
                    color: 'var(--bone)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {r.name}
                </div>
                <Icon name="more" size={16} color="var(--moss)" />
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  marginTop: 6,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--bone-dim)',
                }}
              >
                <span>{r.km}<span style={{ color: 'var(--moss)' }}>km</span></span>
                <span>{r.gain}<span style={{ color: 'var(--moss)' }}>m</span></span>
                <span>{r.grade}<span style={{ color: 'var(--moss)' }}>% avg</span></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <div className={`chip ${r.tag ?? ''}`} style={{ padding: '2px 8px', fontSize: 9 }}>
                  {r.status}
                </div>
                <div style={{ flex: 1, height: 18, marginLeft: 4 }}>
                  <ElevChart data={r.spark} height={18} color={sparkColor(r.tag)} fill={false} />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* FAB → new recording */}
      <button
        type="button"
        onClick={() => navigate('/record')}
        style={{
          position: 'absolute',
          right: 20,
          bottom: 80,
          width: 56,
          height: 56,
          borderRadius: 18,
          background: 'var(--blaze)',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          border: 'none',
        }}
        aria-label="Start new recording"
      >
        <Icon name="plus" size={24} color="#1A1208" />
      </button>

      <BottomTabBar
        active="projects"
        tabs={[
          { key: 'projects', label: 'Routes',   icon: 'library'  },
          { key: 'home',     label: 'Map',      icon: 'pin'      },
          { key: 'record',   label: 'Record',   icon: 'record'   },
          { key: 'settings', label: 'Settings', icon: 'settings' },
        ]}
        onSelect={(key) => {
          if (key === 'projects') navigate('/library');
          else if (key === 'home') navigate('/map');
          else if (key === 'record') navigate('/record');
        }}
      />
      <NavPill />
    </div>
  );
}
