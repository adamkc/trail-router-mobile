import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { TrailLine } from '../components/TrailLine';
import { ElevChart } from '../components/ElevChart';
import { useRecording } from '../store/recording';

const FALLBACK_CURSOR: [number, number] = [40, 480];

export function RecordScreen() {
  const navigate = useNavigate();
  const status       = useRecording((s) => s.status);
  const elapsed      = useRecording((s) => s.elapsed);
  const distance     = useRecording((s) => s.distance);
  const gain         = useRecording((s) => s.gain);
  const currentGrade = useRecording((s) => s.currentGrade);
  const targetGrade  = useRecording((s) => s.targetGrade);
  const track        = useRecording((s) => s.track);
  const start        = useRecording((s) => s.start);
  const pause        = useRecording((s) => s.pause);
  const resume       = useRecording((s) => s.resume);
  const stop         = useRecording((s) => s.stop);
  const tick         = useRecording((s) => s.tick);
  const addWaypoint  = useRecording((s) => s.addWaypoint);

  // Auto-start a recording if the user lands here with no active session.
  useEffect(() => {
    if (status === 'idle' || status === 'reviewing') start();
    // Intentionally only runs on mount — subsequent status changes shouldn't re-start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1Hz timer, active while recording.
  useEffect(() => {
    if (status !== 'recording') return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status, tick]);

  const hrs = Math.floor(elapsed / 3600);
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const overTarget = currentGrade > targetGrade + 1;
  const cursor = track.length > 0 ? track[track.length - 1] : FALLBACK_CURSOR;
  const isPaused = status === 'paused';

  const handleTogglePause = () => {
    if (status === 'recording') pause();
    else if (status === 'paused') resume();
  };
  const handleStop = () => {
    stop();
    navigate('/review');
  };
  const handleBack = () => {
    if (status === 'recording') pause();
    navigate('/home');
  };

  return (
    <div className="screen">
      <StatusBar />

      {/* Map layer */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapCanvas>
          <TrailLine points={track} color="var(--blaze)" width={4} />
          <svg
            viewBox="0 0 412 600"
            preserveAspectRatio="xMidYMid slice"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            {track.length > 0 && (
              <circle cx={track[0][0]} cy={track[0][1]} r="6" fill="var(--good)" stroke="#12160F" strokeWidth="1.5" />
            )}
            {status === 'recording' && (
              <circle cx={cursor[0]} cy={cursor[1]} r="10" fill="var(--blaze)" opacity="0.25">
                <animate attributeName="r" values="10;22;10" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0;0.4" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={cursor[0]} cy={cursor[1]} r="6" fill="var(--bone)" stroke="var(--blaze)" strokeWidth="2" />
          </svg>
        </MapCanvas>
      </div>

      {/* Top HUD — timer + back */}
      <div style={{ position: 'relative', zIndex: 2, padding: '4px 16px 0', display: 'flex', gap: 8 }}>
        <div
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 14,
            background: 'color-mix(in oklch, var(--surface) 88%, transparent)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--line-soft)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: isPaused ? 'var(--moss)' : 'var(--danger)',
                animation: isPaused ? undefined : 'breathe 1.6s infinite',
              }}
            />
            <div className="stat-label" style={{ color: isPaused ? 'var(--moss)' : 'var(--danger)' }}>
              {isPaused ? 'PAUSED' : 'RECORDING'}
            </div>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              marginTop: 2,
            }}
          >
            {hrs}:{mm}:{ss}
          </div>
        </div>
        <button
          type="button"
          onClick={handleBack}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            marginTop: 8,
            background: 'color-mix(in oklch, var(--surface) 88%, transparent)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--line-soft)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--bone)',
          }}
          aria-label="Pause & back to home"
        >
          <Icon name="back" size={18} />
        </button>
      </div>

      {/* Grade coaching banner */}
      <div style={{ position: 'relative', zIndex: 2, margin: '10px 16px 0' }}>
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 14,
            background: overTarget
              ? 'color-mix(in oklch, var(--warn) 18%, var(--surface))'
              : 'color-mix(in oklch, var(--good) 15%, var(--surface))',
            border: `1px solid ${overTarget
              ? 'color-mix(in oklch, var(--warn) 50%, transparent)'
              : 'color-mix(in oklch, var(--good) 45%, transparent)'}`,
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ position: 'relative', width: 54, height: 54, flexShrink: 0 }}>
            <svg viewBox="0 0 54 54" style={{ width: '100%', height: '100%' }}>
              <circle cx="27" cy="27" r="22" fill="none" stroke="var(--line)" strokeWidth="3" />
              <circle
                cx="27"
                cy="27"
                r="22"
                fill="none"
                stroke={overTarget ? 'var(--warn)' : 'var(--good)'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${currentGrade * 5.5} 138`}
                transform="rotate(-90 27 27)"
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  color: overTarget ? 'var(--warn)' : 'var(--good)',
                  fontWeight: 600,
                }}
              >
                {currentGrade}%
              </div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                fontWeight: 500,
                color: overTarget ? 'var(--warn)' : 'var(--good)',
              }}
            >
              {overTarget ? 'Above target grade' : 'On target'}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--bone-dim)',
                letterSpacing: '0.05em',
                marginTop: 3,
                lineHeight: 1.4,
              }}
            >
              TARGET {targetGrade}% · CAP 12% · EASE INTO NEXT SWITCHBACK IN 28 M
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Live stats panel */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          margin: '0 16px 10px',
          padding: '12px 14px',
          borderRadius: 14,
          background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--line-soft)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { l: 'DIST', v: distance.toFixed(2), u: 'km'  },
            { l: 'GAIN', v: `+${gain}`,          u: 'm'   },
            { l: 'PACE', v: elapsed > 0 && distance > 0 ? formatPace(elapsed, distance) : '—:—', u: '/km' },
            { l: 'ELEV', v: `${420 + gain}`,    u: 'm'   },
          ].map((s) => (
            <div key={s.l}>
              <div className="stat-label">{s.l}</div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 15,
                  color: 'var(--bone)',
                  fontWeight: 500,
                  marginTop: 2,
                }}
              >
                {s.v}
                <span className="stat-unit">{s.u}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, height: 32 }}>
          <ElevChart data={elevationSeries(gain)} height={32} mark={Math.max(0, Math.min(7, Math.floor(elapsed / 3)))} />
        </div>
      </div>

      {/* Record controls */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 18,
          padding: '6px 16px 18px',
        }}
      >
        <button
          type="button"
          onClick={addWaypoint}
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            display: 'grid',
            placeItems: 'center',
          }}
          aria-label="Capture waypoint"
        >
          <Icon name="waypoint" size={20} color="var(--topo)" />
        </button>
        <button
          type="button"
          onClick={handleTogglePause}
          style={{
            width: 76,
            height: 76,
            borderRadius: 38,
            background: 'var(--blaze)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
            border: 'none',
          }}
          aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
        >
          <Icon name={isPaused ? 'play' : 'pause'} size={28} color="#1A1208" />
        </button>
        <button
          type="button"
          onClick={handleStop}
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            display: 'grid',
            placeItems: 'center',
          }}
          aria-label="Stop and review"
        >
          <Icon name="stop" size={20} color="var(--danger)" />
        </button>
      </div>
      <NavPill />
    </div>
  );
}

function formatPace(elapsedSec: number, distanceKm: number): string {
  const secPerKm = elapsedSec / distanceKm;
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function elevationSeries(currentGain: number): number[] {
  const start = 420;
  const end = start + currentGain;
  const n = 8;
  return Array.from({ length: n }, (_, i) => Math.round(start + ((end - start) * i) / (n - 1)));
}
