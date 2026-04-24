import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon, type IconName } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { TrailLine } from '../components/TrailLine';

interface TrailSegment {
  name: string;
  status: 'optimized' | 'built' | 'draft' | 'proposed';
  color: string;
  pts: Array<[number, number]>;
  solid: boolean;
}

const NETWORK: TrailSegment[] = [
  {
    name: 'Hayfork Loop',
    status: 'optimized',
    color: 'var(--blaze)',
    pts: [
      [40, 500], [70, 470], [110, 440], [150, 410], [185, 380], [220, 350],
      [255, 320], [290, 290], [325, 260], [355, 230], [370, 200], [360, 170], [340, 150],
    ],
    solid: true,
  },
  {
    name: 'North Ridge',
    status: 'built',
    color: 'var(--good)',
    pts: [[340, 150], [370, 120], [385, 90], [380, 60]],
    solid: true,
  },
  {
    name: 'Creek Cutoff',
    status: 'built',
    color: 'var(--good)',
    pts: [[150, 410], [120, 380], [90, 360], [65, 340]],
    solid: true,
  },
  {
    name: 'Manzanita SW',
    status: 'draft',
    color: 'var(--bone)',
    pts: [[255, 320], [270, 280], [255, 240], [275, 210], [260, 180], [290, 160]],
    solid: false,
  },
  {
    name: 'Meadow Link',
    status: 'proposed',
    color: 'var(--topo)',
    pts: [[220, 350], [190, 300], [170, 270], [155, 230]],
    solid: false,
  },
];

const LEGEND_LAYERS: Array<{ label: string; color: string; n: number; solid: boolean; on: boolean }> = [
  { label: 'Optimized', color: 'var(--blaze)', n: 2, solid: true,  on: true },
  { label: 'Built',     color: 'var(--good)',  n: 7, solid: true,  on: true },
  { label: 'Draft',     color: 'var(--bone)',  n: 3, solid: false, on: true },
  { label: 'Proposed',  color: 'var(--topo)',  n: 2, solid: false, on: true },
];

const MAP_TOOLS: Array<{ icon: IconName; active?: boolean }> = [
  { icon: 'layers', active: true },
  { icon: 'mountain' },
  { icon: 'compass' },
  { icon: 'target' },
];

const SNAP_TOGGLES = [
  { label: 'JCT', on: true },
  { label: 'CNT', on: true },
  { label: 'GRD', on: false },
];

export function NetworkMapScreen() {
  const navigate = useNavigate();
  return (
    <div className="screen">
      <StatusBar />

      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <MapCanvas>
          {NETWORK.map((t, i) => (
            <TrailLine key={i} points={t.pts} color={t.color} width={t.solid ? 3 : 2.5} dashed={!t.solid} />
          ))}
          {/* Trailheads / junctions + labels */}
          <svg
            viewBox="0 0 412 600"
            preserveAspectRatio="xMidYMid slice"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <circle cx={40}  cy={500} r="6" fill="var(--good)"       stroke="#12160F" strokeWidth="1.5" />
            <circle cx={380} cy={60}  r="6" fill="var(--danger)"     stroke="#12160F" strokeWidth="1.5" />
            <circle cx={340} cy={150} r="5" fill="var(--surface-2)"  stroke="var(--bone)" strokeWidth="1.5" />
            <circle cx={150} cy={410} r="5" fill="var(--surface-2)"  stroke="var(--bone)" strokeWidth="1.5" />
            <circle cx={220} cy={350} r="5" fill="var(--surface-2)"  stroke="var(--bone)" strokeWidth="1.5" />
            <circle cx={255} cy={320} r="5" fill="var(--surface-2)"  stroke="var(--bone)" strokeWidth="1.5" />
            <g fontFamily="var(--font-mono)" fontSize="8" fill="var(--bone-dim)" letterSpacing="0.5">
              <text x={55}  y={460}>HAYFORK LOOP</text>
              <text x={370} y={100}>N. RIDGE</text>
              <text x={40}  y={340}>CUTOFF</text>
              <text x={285} y={240}>MANZ. SW</text>
              <text x={130} y={255} fill="var(--topo)">MEADOW (PROP)</text>
            </g>
          </svg>
        </MapCanvas>

        {/* Top project switcher */}
        <div style={{ position: 'absolute', top: 12, left: 16, right: 16 }}>
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 14,
              background: 'color-mix(in oklch, var(--surface) 88%, transparent)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--line-soft)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => navigate('/projects')}
              style={{ display: 'grid', placeItems: 'center', color: 'var(--bone)' }}
              aria-label="Back to projects"
            >
              <Icon name="back" size={18} />
            </button>
            <div style={{ flex: 1 }}>
              <div className="eyebrow" style={{ color: 'var(--blaze)' }}>◉ PROJECT</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500 }}>Hayfork</div>
                <Icon name="chevron-right" size={14} color="var(--moss)" />
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--bone-dim)',
                    letterSpacing: '0.08em',
                  }}
                >
                  12 TRAILS · 42.8 KM
                </div>
              </div>
            </div>
            <Icon name="search" size={18} color="var(--moss)" />
          </div>
        </div>

        {/* Right map tools */}
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: 76,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {MAP_TOOLS.map((b, i) => (
            <div
              key={i}
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'color-mix(in oklch, var(--surface) 90%, transparent)',
                backdropFilter: 'blur(8px)',
                border: '1px solid var(--line-soft)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name={b.icon} size={18} color={b.active ? 'var(--blaze)' : 'var(--bone)'} />
            </div>
          ))}
        </div>

        {/* Left legend / layers panel */}
        <div
          style={{
            position: 'absolute',
            left: 12,
            top: 76,
            width: 132,
            padding: 10,
            borderRadius: 14,
            background: 'color-mix(in oklch, var(--surface) 90%, transparent)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--line-soft)',
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 6 }}>LAYERS</div>
          {LEGEND_LAYERS.map((l) => (
            <div
              key={l.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 0',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--bone-dim)',
                letterSpacing: '0.05em',
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 3,
                  background: l.color,
                  opacity: l.on ? 1 : 0.3,
                  borderRadius: 2,
                  backgroundImage: l.solid
                    ? 'none'
                    : `repeating-linear-gradient(90deg, ${l.color} 0 4px, transparent 4px 7px)`,
                }}
              />
              <span style={{ flex: 1, opacity: l.on ? 1 : 0.4 }}>{l.label.toUpperCase()}</span>
              <span style={{ color: 'var(--moss)' }}>{l.n}</span>
            </div>
          ))}
          <div style={{ height: 1, background: 'var(--line-soft)', margin: '8px 0' }} />
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--moss)',
              letterSpacing: '0.08em',
            }}
          >
            CONTOURS 10M · HILLSHADE
          </div>
        </div>
      </div>

      {/* Plot-route dock */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          background: 'var(--surface)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: '1px solid var(--line-soft)',
          marginTop: -12,
          padding: '12px 16px 14px',
          boxShadow: 'var(--sheet-shadow)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="eyebrow">PLOT NEW ROUTE</div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                fontWeight: 500,
                marginTop: 2,
              }}
            >
              Snap to junctions, ridges, contours
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {SNAP_TOGGLES.map((s) => (
              <div
                key={s.label}
                style={{
                  padding: '5px 8px',
                  borderRadius: 8,
                  background: s.on
                    ? 'color-mix(in oklch, var(--blaze) 18%, var(--surface-2))'
                    : 'var(--surface-2)',
                  border: `1px solid ${s.on ? 'color-mix(in oklch, var(--blaze) 40%, transparent)' : 'var(--line-soft)'}`,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  color: s.on ? 'var(--blaze)' : 'var(--moss)',
                }}
              >
                {s.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div className="btn btn-primary" style={{ flex: 2 }}>
            <Icon name="plus" size={16} /> Draw route
          </div>
          <div className="btn btn-ghost" style={{ flex: 1 }}>
            <Icon name="record" size={16} color="var(--danger)" /> Record
          </div>
          <div className="btn btn-ghost">
            <Icon name="waypoint" size={16} />
          </div>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--moss)',
            letterSpacing: '0.08em',
            marginTop: 10,
            textAlign: 'center',
          }}
        >
          TAP MAP TO PLACE VERTEX · LONG-PRESS TO SNAP TO EXISTING TRAIL
        </div>
      </div>
      <NavPill />
    </div>
  );
}
