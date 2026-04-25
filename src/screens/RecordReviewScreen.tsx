import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { MapGeoLine } from '../components/MapGeoLine';
import { MapPin, MapWaypoint, FitBoundsToCoords } from '../components/MapMarkers';
import { ElevChart } from '../components/ElevChart';
import { useRecording, draftSaveStatusToRoute, type SaveStatus } from '../store/recording';
import { useLibrary } from '../store/library';
import { resolveCssVar } from '../utils/geo';

const HAYFORK: [number, number] = [-122.5208, 40.7289];

/** Synthetic geographic track around Hayfork — used when /review is opened without a recording. */
const FALLBACK_GEO_TRACK: Array<[number, number]> = (() => {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 12; i++) {
    pts.push([
      HAYFORK[0] + i * 0.0006 + Math.sin(i / 3) * 0.0003,
      HAYFORK[1] + i * 0.0004 + Math.cos(i / 3) * 0.0002,
    ]);
  }
  return pts;
})();

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
  const geoTrack           = useRecording((s) => s.geoTrack);
  const capturedWaypoints  = useRecording((s) => s.capturedWaypoints);
  const draftName          = useRecording((s) => s.draftName);
  const draftSaveStatus    = useRecording((s) => s.draftSaveStatus);
  const setDraftName       = useRecording((s) => s.setDraftName);
  const setDraftSaveStatus = useRecording((s) => s.setDraftSaveStatus);
  const discard            = useRecording((s) => s.discard);
  const addRoute           = useLibrary((s) => s.addRoute);

  // If the user landed here without a recording (e.g. via the canvas), use a synthetic track for fidelity.
  const hasTrack = geoTrack.length >= 3;
  const displayTrack = hasTrack ? geoTrack : FALLBACK_GEO_TRACK;
  const displayElapsed = elapsed > 0 ? elapsed : 32 * 60 + 18;
  const displayDistance = distance > 0 ? distance : 2.14;
  const displayGain = gain > 0 ? gain : 220;

  const elev = useMemo(() => elevationFromGain(displayGain), [displayGain]);
  const avgGrade = displayDistance > 0 ? ((displayGain / 10) / displayDistance).toFixed(1) : '0.0';

  // The trimmed-out ends are stubbed — design shows ~8% off the start and ~10% off the end as dashed.
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

      {/* Track map — fits to the recorded extent */}
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
        <MapCanvas center={displayTrack[0] ?? HAYFORK} zoom={15} interactive={false}>
          <FitBoundsToCoords coords={displayTrack} padding={28} />
          {headSlice.length >= 2 && <MapGeoLine id="rev-head" coords={headSlice} color="#8E9483" width={3} dashed />}
          {mainSlice.length >= 2 && <MapGeoLine id="rev-main" coords={mainSlice} color="#E88A3C" width={3.5} onTop />}
          {tailSlice.length >= 2 && <MapGeoLine id="rev-tail" coords={tailSlice} color="#8E9483" width={3} dashed />}
          <MapPin coord={displayTrack[0]} background="oklch(0.74 0.14 145)" />
          <MapPin coord={displayTrack[displayTrack.length - 1]} background="oklch(0.68 0.19 25)" />
          {capturedWaypoints.map((w) => (
            <MapWaypoint key={w.id} coord={w.coord} icon={w.icon} color={resolveCssVar(w.color)} />
          ))}
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
              WINDOW 5M · REDUCES {Math.max(displayTrack.length, 60)} VTX → {Math.max(Math.floor(displayTrack.length * 0.4), 20)}
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

