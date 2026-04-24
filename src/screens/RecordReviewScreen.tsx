import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { TrailLine } from '../components/TrailLine';
import { ElevChart } from '../components/ElevChart';
import { useRecording, draftSaveStatusToRoute, type SaveStatus } from '../store/recording';
import { useLibrary } from '../store/library';

const FALLBACK_TRACK: Array<[number, number]> = [
  [60, 500], [90, 475], [125, 455], [160, 440], [195, 420], [225, 400],
  [260, 380], [290, 355], [320, 325], [350, 290], [370, 250], [380, 210],
];

const SAVE_PILLS: Array<{ key: SaveStatus; label: string }> = [
  { key: 'draft',  label: 'DRAFT'  },
  { key: 'built',  label: 'BUILT'  },
  { key: 'survey', label: 'SURVEY' },
];

function elevationFromGain(gain: number): number[] {
  const base = 420;
  const span = Math.max(gain, 60);
  const n = 14;
  return Array.from({ length: n }, (_, i) => Math.round(base + (span * i) / (n - 1)));
}

const formatElapsed = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export function RecordReviewScreen() {
  const navigate = useNavigate();
  const elapsed            = useRecording((s) => s.elapsed);
  const distance           = useRecording((s) => s.distance);
  const gain               = useRecording((s) => s.gain);
  const track              = useRecording((s) => s.track);
  const capturedWaypoints  = useRecording((s) => s.capturedWaypoints);
  const draftName          = useRecording((s) => s.draftName);
  const draftSaveStatus    = useRecording((s) => s.draftSaveStatus);
  const setDraftName       = useRecording((s) => s.setDraftName);
  const setDraftSaveStatus = useRecording((s) => s.setDraftSaveStatus);
  const discard            = useRecording((s) => s.discard);
  const addRoute           = useLibrary((s) => s.addRoute);

  // Fall back to a fake track if the user lands here with no recording — keeps the screen visually coherent.
  const displayTrack = track.length >= 3 ? track : FALLBACK_TRACK;
  const hasTrack = track.length >= 3;
  const displayElapsed = elapsed > 0 ? elapsed : 32 * 60 + 18;
  const displayDistance = distance > 0 ? distance : 2.14;
  const displayGain = gain > 0 ? gain : 220;

  const elev = useMemo(() => elevationFromGain(displayGain), [displayGain]);
  const avgGrade = displayDistance > 0 ? ((displayGain / 10) / displayDistance).toFixed(1) : '0.0';

  // The trimmed-out ends are stubbed — the design shows them dashed.
  const trimmedStart = Math.max(1, Math.floor(displayTrack.length * 0.08));
  const trimmedEnd = Math.max(1, Math.floor(displayTrack.length * 0.1));
  const mainSlice = displayTrack.slice(trimmedStart - 1, displayTrack.length - trimmedEnd + 1);
  const headSlice = displayTrack.slice(0, trimmedStart);
  const tailSlice = displayTrack.slice(displayTrack.length - trimmedEnd);

  const handleDiscard = () => {
    discard();
    navigate('/home');
  };
  const handleSave = () => {
    const { status, tag } = draftSaveStatusToRoute(draftSaveStatus);
    addRoute({
      name: draftName.trim() || 'Untitled recording',
      km: displayDistance.toFixed(1),
      gain: `+${displayGain}`,
      grade: avgGrade,
      status,
      tag,
      spark: elev,
    });
    discard();
    navigate('/library');
  };
  const handleBack = () => navigate('/record');

  return (
    <div className="screen">
      <StatusBar />

      {/* Header */}
      <div style={{ padding: '6px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={handleBack}
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
          aria-label="Back to recording"
        >
          <Icon name="back" size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ color: 'var(--good)' }}>● RECORDING COMPLETE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500 }}>
            Review · {displayDistance.toFixed(2)} km · {formatElapsed(displayElapsed)}
          </div>
        </div>
      </div>

      {/* Track map */}
      <div
        style={{
          height: 220,
          margin: '0 12px',
          borderRadius: 16,
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid var(--line-soft)',
        }}
      >
        <MapCanvas>
          {hasTrack ? (
            <>
              {headSlice.length >= 2 && <TrailLine points={headSlice} color="var(--moss)" width={3} dashed />}
              {mainSlice.length >= 2 && <TrailLine points={mainSlice} color="var(--blaze)" width={3.5} />}
              {tailSlice.length >= 2 && <TrailLine points={tailSlice} color="var(--moss)" width={3} dashed />}
            </>
          ) : (
            <>
              <TrailLine points={FALLBACK_TRACK.slice(0, 2)} color="var(--moss)" width={3} dashed />
              <TrailLine points={FALLBACK_TRACK.slice(1, 11)} color="var(--blaze)" width={3.5} />
              <TrailLine points={FALLBACK_TRACK.slice(10)} color="var(--moss)" width={3} dashed />
            </>
          )}
          <svg
            viewBox="0 0 412 600"
            preserveAspectRatio="xMidYMid slice"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <circle cx={displayTrack[0][0]} cy={displayTrack[0][1]} r="6" fill="var(--good)"   stroke="#12160F" strokeWidth="1.5" />
            <circle
              cx={displayTrack[displayTrack.length - 1][0]}
              cy={displayTrack[displayTrack.length - 1][1]}
              r="6"
              fill="var(--danger)"
              stroke="#12160F"
              strokeWidth="1.5"
            />
            {capturedWaypoints.map((w, i) => {
              // Place captured waypoints along the track at evenly spaced fractions for the demo.
              const frac = (i + 1) / (capturedWaypoints.length + 1);
              const idx = Math.min(displayTrack.length - 1, Math.floor(displayTrack.length * frac));
              const p = displayTrack[idx];
              return (
                <g key={w.id} transform={`translate(${p[0]}, ${p[1]})`}>
                  <circle r="10" fill={w.color} opacity="0.25" />
                  <circle r="6" fill={w.color} stroke="#12160F" strokeWidth="1.5" />
                  <text
                    y="2"
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                    fontSize="7"
                    fontWeight="600"
                    fill="#12160F"
                  >
                    {w.icon}
                  </text>
                </g>
              );
            })}
          </svg>
        </MapCanvas>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '10px 16px 0' }}>
        {/* Trim panel */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line-soft)',
            borderRadius: 14,
            padding: 12,
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="eyebrow">TRIM ENDS</div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--moss)',
                letterSpacing: '0.08em',
              }}
            >
              REMOVING 8% · 180 M
            </div>
          </div>
          <div style={{ position: 'relative', height: 54, marginTop: 8 }}>
            <ElevChart data={elev} height={54} />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '8%',
                height: '100%',
                background: 'color-mix(in oklch, var(--bg) 70%, transparent)',
                borderRight: '2px solid var(--blaze)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '10%',
                height: '100%',
                background: 'color-mix(in oklch, var(--bg) 70%, transparent)',
                borderLeft: '2px solid var(--blaze)',
              }}
            />
          </div>
        </div>

        {/* Smoothing toggle */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line-soft)',
            borderRadius: 14,
            padding: 12,
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500 }}>
              Smooth GPS noise
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
              WINDOW 5M · REDUCES 142 VTX → 58
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 26,
              borderRadius: 14,
              background: 'var(--blaze)',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 22,
                height: 22,
                borderRadius: 11,
                background: '#1A1208',
              }}
            />
          </div>
        </div>

        {/* Captured waypoints (from store; zero-state if none) */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line-soft)',
            borderRadius: 14,
            padding: 12,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 8,
            }}
          >
            <div className="eyebrow">CAPTURED DURING RECORD</div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moss)' }}>
              {capturedWaypoints.length}
            </span>
          </div>
          {capturedWaypoints.length === 0 ? (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--moss)',
                letterSpacing: '0.05em',
                padding: '8px 0',
              }}
            >
              No waypoints captured during this recording.
            </div>
          ) : (
            capturedWaypoints.map((w, i) => (
              <div
                key={w.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 0',
                  borderTop: i > 0 ? '1px solid var(--line-soft)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    background: 'var(--surface-2)',
                    border: `1px solid ${w.color}`,
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: w.color,
                    fontWeight: 600,
                  }}
                >
                  {w.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--bone)' }}>
                    {w.label}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'var(--moss)',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {w.type} · {w.t}
                  </div>
                </div>
                <Icon name="chevron-right" size={16} color="var(--moss)" />
              </div>
            ))
          )}
        </div>

        {/* Name + status pills (live-editable) */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line-soft)',
            borderRadius: 14,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 6 }}>SAVE AS</div>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--blaze)',
              outline: 'none',
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              color: 'var(--bone)',
              fontWeight: 500,
              padding: '6px 0',
              caretColor: 'var(--blaze)',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {SAVE_PILLS.map((p) => {
              const active = draftSaveStatus === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setDraftSaveStatus(p.key)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 100,
                    background: active
                      ? 'color-mix(in oklch, var(--blaze) 18%, var(--surface-2))'
                      : 'var(--surface-2)',
                    border: `1px solid ${active
                      ? 'color-mix(in oklch, var(--blaze) 40%, transparent)'
                      : 'var(--line-soft)'}`,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.1em',
                    color: active ? 'var(--blaze)' : 'var(--moss)',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '10px 16px 14px',
          background: 'var(--surface)',
          borderTop: '1px solid var(--line-soft)',
        }}
      >
        <button type="button" className="btn btn-danger" style={{ flex: 1 }} onClick={handleDiscard}>
          Discard
        </button>
        <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave}>
          <Icon name="download" size={16} /> Save to project
        </button>
      </div>
      <NavPill />
    </div>
  );
}
