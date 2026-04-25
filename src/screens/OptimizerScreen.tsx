import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { MapGeoLine } from '../components/MapGeoLine';
import { MapPin, FitBoundsToCoords } from '../components/MapMarkers';
import { ElevChart } from '../components/ElevChart';
import { svgArrayToGeo, resolveCssVar, HAYFORK } from '../utils/geo';

const BEFORE_SVG: Array<[number, number]> = [
  [60, 500], [90, 460], [130, 420], [170, 370], [210, 310], [250, 260], [300, 210], [340, 170],
];

const AFTER_SVG: Array<[number, number]> = [
  [60, 500], [95, 475], [135, 455], [115, 420], [155, 395], [200, 380], [180, 345],
  [220, 320], [260, 300], [245, 265], [285, 245], [320, 220], [340, 170],
];

export function OptimizerScreen() {
  const navigate = useNavigate();
  const beforeGeo = useMemo(() => svgArrayToGeo(BEFORE_SVG), []);
  const afterGeo  = useMemo(() => svgArrayToGeo(AFTER_SVG), []);

  const [targetGrade, setTargetGrade] = useState(7);
  const [maxGrade, setMaxGrade] = useState(12);
  const [paused, setPaused] = useState(false);

  return (
    <div className="screen" style={{ background: 'var(--bg)' }}>
      <StatusBar />

      {/* Header */}
      <div style={{ padding: '6px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={() => navigate('/details')}
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
          aria-label="Close optimizer"
        >
          <Icon name="close" size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ color: 'var(--blaze)' }}>OPTIMIZE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>
            Hayfork Loop · Leg 2
          </div>
        </div>
        <div
          style={{
            padding: '6px 10px',
            borderRadius: 100,
            background: 'var(--surface-2)',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.1em',
            color: 'var(--moss)',
            border: '1px solid var(--line-soft)',
          }}
        >
          ITER 84/500
        </div>
      </div>

      {/* Live before/after map */}
      <div
        style={{
          height: 280,
          position: 'relative',
          overflow: 'hidden',
          margin: '0 12px',
          borderRadius: 16,
          border: '1px solid var(--line-soft)',
        }}
      >
        <MapCanvas center={HAYFORK} zoom={15} interactive={false}>
          <FitBoundsToCoords coords={[...beforeGeo, ...afterGeo]} padding={36} />
          <MapGeoLine id="opt-before" coords={beforeGeo} color={resolveCssVar('var(--moss)')} width={2.5} dashed glow={false} />
          <MapGeoLine id="opt-after"  coords={afterGeo}  color={resolveCssVar('var(--blaze)')} width={3.5} onTop />
          <MapPin coord={beforeGeo[0]}                       background={resolveCssVar('var(--good)')}   size={14} />
          <MapPin coord={afterGeo[afterGeo.length - 1]}      background={resolveCssVar('var(--danger)')} size={14} />
          {/* Inline vertices on the optimized path — small blaze dots */}
          {afterGeo.slice(1, -1).map((coord, i) => (
            <MapPin key={i} coord={coord} background={resolveCssVar('var(--blaze)')} size={6} ringOpacity={0} />
          ))}
        </MapCanvas>

        {/* Legend */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            padding: '6px 10px',
            borderRadius: 10,
            background: 'color-mix(in oklch, var(--surface) 90%, transparent)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--line-soft)',
            display: 'flex',
            gap: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.08em',
          }}
        >
          <span><span style={{ color: 'var(--moss)' }}>╌╌</span> ORIG</span>
          <span><span style={{ color: 'var(--blaze)' }}>━━</span> OPT</span>
        </div>

        {/* Energy readout */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            padding: '6px 10px',
            borderRadius: 10,
            background: 'color-mix(in oklch, var(--surface) 90%, transparent)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--line-soft)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
          }}
        >
          <div style={{ color: 'var(--moss)', fontSize: 9, letterSpacing: '0.1em' }}>ENERGY</div>
          <div style={{ color: 'var(--good)' }}>↓ 82%</div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 0' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>PARAMETERS</div>

        {/* Target grade */}
        <ParamSlider
          label="Target grade"
          value={targetGrade}
          min={3}
          max={20}
          step={0.5}
          color="var(--blaze)"
          onChange={setTargetGrade}
        />

        {/* Max grade hard cap */}
        <ParamSlider
          label="Max segment grade"
          subLabel="(hard cap)"
          value={maxGrade}
          min={5}
          max={25}
          step={0.5}
          color="var(--warn)"
          onChange={setMaxGrade}
        />

        {/* Advanced collapsible */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line-soft)',
            borderRadius: 12,
            padding: '10px 12px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500 }}>
              Advanced
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--moss)',
                letterSpacing: '0.08em',
                marginTop: 2,
              }}
            >
              DRIFT · STEP · SMOOTH · REPULSION
            </div>
          </div>
          <Icon name="chevron-right" size={18} color="var(--moss)" />
        </div>

        {/* Before / after delta */}
        <div className="eyebrow" style={{ marginBottom: 8 }}>RESULT PREVIEW</div>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line-soft)',
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center' }}>
            <div>
              <div className="stat-label">ORIGINAL</div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  color: 'var(--bone-dim)',
                  marginTop: 4,
                  lineHeight: 1.5,
                }}
              >
                <div>2.8 km</div>
                <div>Avg 11.4% · Max 18.2%</div>
              </div>
            </div>
            <Icon name="chevron-right" size={18} color="var(--moss)" />
            <div>
              <div className="stat-label" style={{ color: 'var(--blaze)' }}>OPTIMIZED</div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  color: 'var(--bone)',
                  marginTop: 4,
                  lineHeight: 1.5,
                }}
              >
                <div>
                  3.6 km <span style={{ color: 'var(--good)' }}>+0.8</span>
                </div>
                <div>Avg {targetGrade.toFixed(1)}% · Max {Math.min(maxGrade, 18.2).toFixed(1)}%</div>
              </div>
            </div>
          </div>
          <div style={{ height: 36, marginTop: 10 }}>
            <ElevChart
              data={[420, 430, 460, 480, 510, 540, 570, 590, 610, 625, 635, 640]}
              height={36}
              mark={6}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 16px 14px',
          background: 'var(--surface)',
          borderTop: '1px solid var(--line-soft)',
        }}
      >
        <button
          type="button"
          className="btn btn-ghost"
          style={{ flex: 1 }}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ flex: 2 }}
          onClick={() => navigate('/details')}
        >
          <Icon name="download" size={16} /> Save as new trail
        </button>
      </div>
      <NavPill />
    </div>
  );
}

// ─── Slider helper ─────────────────────────────────────────────────────────

function ParamSlider({
  label,
  subLabel,
  value,
  min,
  max,
  step = 1,
  color,
  onChange,
}: {
  label: string;
  subLabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  color: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line-soft)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500 }}>
          {label}
          {subLabel && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moss)' }}>
              {' '}{subLabel}
            </span>
          )}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color, fontWeight: 600 }}>
          {value.toFixed(value % 1 ? 1 : 0)}<span style={{ color: 'var(--moss)', fontSize: 11 }}>%</span>
        </div>
      </div>
      <div style={{ position: 'relative', height: 24, marginTop: 10 }}>
        {/* Visual track + fill + thumb */}
        <div
          style={{
            position: 'absolute', left: 0, right: 0, top: 9,
            height: 6, background: 'var(--surface-2)', borderRadius: 3,
          }}
        />
        <div
          style={{
            position: 'absolute', left: 0, top: 9,
            height: 6, width: `${pct}%`, background: color, borderRadius: 3, pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute', left: `${pct}%`, top: 5,
            width: 14, height: 14, borderRadius: 7,
            background: color, transform: 'translateX(-50%)',
            border: '2px solid #12160F', pointerEvents: 'none',
          }}
        />
        {/* Real range input — invisible but captures interaction (touch + mouse) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer', margin: 0,
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--moss)',
          marginTop: 4,
          letterSpacing: '0.08em',
        }}
      >
        <span>{min}%</span>
        <span>{max}%</span>
      </div>
    </div>
  );
}
