import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { ElevChart } from '../components/ElevChart';
import { SlopeRibbon } from '../components/SlopeRibbon';
import { DataRow } from '../components/DataRow';

const ELEV = [
  420, 424, 430, 448, 470, 498, 522, 548, 574, 598, 614, 628, 638, 640,
  628, 612, 588, 556, 520, 480, 452, 438, 428, 422, 420,
];

const SLOPE = [2, 3, 4, 6, 7, 9, 8, 7, 6, 5, 4, 3, 1, -2, -4, -6, -8, -10, -11, -9, -6, -4, -2, -1];

interface StatEntry {
  l: string;
  v: string;
  u: string;
  c?: string;
}

const STATS: StatEntry[] = [
  { l: 'LENGTH',    v: '14.2',  u: 'km' },
  { l: 'GAIN',      v: '+640',  u: 'm',  c: 'var(--good)' },
  { l: 'LOSS',      v: '−640',  u: 'm',  c: 'var(--topo)' },
  { l: 'AVG GRADE', v: '6.1',   u: '%'  },
  { l: 'MAX GRADE', v: '12.4',  u: '%',  c: 'var(--warn)' },
  { l: 'MOV TIME',  v: '3:40',  u: 'h'  },
];

export function RouteDetailsScreen() {
  const navigate = useNavigate();
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
          <div className="eyebrow">ROUTE · 001</div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
          >
            Hayfork Loop
          </div>
        </div>
        <div className="iconbtn">
          <Icon name="more" size={18} />
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {STATS.map((s) => (
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
              420 → 640 m
            </div>
          </div>
          <div style={{ height: 90, position: 'relative' }}>
            <ElevChart data={ELEV} height={90} mark={13} />
            <div style={{ position: 'absolute', left: 0, top: 2, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)' }}>640</div>
            <div style={{ position: 'absolute', left: 0, bottom: 2, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)' }}>420</div>
            <div style={{ position: 'absolute', right: 0, bottom: -14, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)' }}>14.2 km</div>
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
            <SlopeRibbon data={SLOPE} height={50} />
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
          <DataRow label="SURFACE" value="SINGLETRACK" />
          <DataRow label="EXPOSURE" value="PARTIAL SHADE" />
          <DataRow label="WATER CROSSINGS" value="2" />
          <DataRow label="VERTICES" value="142" />
          <DataRow label="LAST EDITED" value="APR 22" unit="2026" />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
            <span className="stat-label">OPTIMIZER TARGET</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: 'var(--blaze)',
              }}
            >
              7.0<span style={{ color: 'var(--moss)' }}>%</span> · cap 12%
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
