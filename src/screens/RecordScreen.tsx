import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { MapCanvas, useMapInstance } from '../components/MapCanvas';
import { MapGeoLine } from '../components/MapGeoLine';
import { MapLongPressHandler } from '../components/MapMarkers';
import { CompassBadge } from '../components/CompassBadge';
import { MapToolStack } from '../components/MapToolStack';
import { ElevChart } from '../components/ElevChart';
import { useRecording, haversineKm, WAYPOINT_TYPES, type GpsState, type WaypointKind } from '../store/recording';
import { useLibrary } from '../store/library';
import { useActiveProject } from '../store/projects';
import { newPhotoId, pickCameraPhoto, savePhoto } from '../utils/photoStore';

export function RecordScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const followId = searchParams.get('follow');
  const followRoute = useLibrary((s) =>
    followId ? s.routes.find((r) => r.id === followId) ?? null : null,
  );
  const activeProject = useActiveProject();
  const projectCenter = activeProject.center;

  const status       = useRecording((s) => s.status);
  const elapsed      = useRecording((s) => s.elapsed);
  const distance     = useRecording((s) => s.distance);
  const gain         = useRecording((s) => s.gain);
  const currentGrade = useRecording((s) => s.currentGrade);
  const targetGrade  = useRecording((s) => s.targetGrade);
  const geoTrack     = useRecording((s) => s.geoTrack);
  const capturedWaypoints = useRecording((s) => s.capturedWaypoints);
  const gps          = useRecording((s) => s.gps);
  const start        = useRecording((s) => s.start);
  const pause        = useRecording((s) => s.pause);
  const resume       = useRecording((s) => s.resume);
  const stop         = useRecording((s) => s.stop);
  const bumpElapsed  = useRecording((s) => s.bumpElapsed);
  const pushFix      = useRecording((s) => s.pushFix);
  const setGpsState  = useRecording((s) => s.setGpsState);
  const addWaypointOfType = useRecording((s) => s.addWaypointOfType);
  const addWaypointAt = useRecording((s) => s.addWaypointAt);
  const setFollowingRouteId = useRecording((s) => s.setFollowingRouteId);
  const [pendingDrop, setPendingDrop] = useState<[number, number] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Auto-start a recording if the user lands here with no active session.
  useEffect(() => {
    if (status === 'idle' || status === 'reviewing') start();
    // Intentionally only runs on mount — subsequent status changes shouldn't re-start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track which route we're following (?follow=<id>) so RecordReview can
  // log a visit against it on save. Cleared when the URL drops the param.
  useEffect(() => {
    setFollowingRouteId(followId ?? null);
  }, [followId, setFollowingRouteId]);

  // 1Hz elapsed counter while recording.
  useEffect(() => {
    if (status !== 'recording') return;
    const id = setInterval(bumpElapsed, 1000);
    return () => clearInterval(id);
  }, [status, bumpElapsed]);

  // Real GPS via navigator.geolocation; falls back to a slow synthetic walk
  // around Hayfork if permission is denied or the API is unavailable.
  useEffect(() => {
    if (status !== 'recording') return;
    let watchId: number | null = null;
    let simInterval: number | null = null;

    const startSim = () => {
      setGpsState('simulated');
      // Walk roughly NE from the active project's center at ~3 m every 2s.
      const [originLng, originLat] = projectCenter;
      let i = 0;
      simInterval = window.setInterval(() => {
        i += 1;
        const drift = i * 0.00003;
        const wobble = Math.sin(i / 4) * 0.00002;
        pushFix(originLng + drift, originLat + drift * 0.6 + wobble, 420 + i * 0.6);
      }, 2000);
    };

    if (!navigator.geolocation) {
      setGpsState('unavailable');
      startSim();
    } else {
      setGpsState('requesting');
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsState('tracking');
          pushFix(pos.coords.longitude, pos.coords.latitude, pos.coords.altitude);
        },
        (err) => {
          setGpsState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
          startSim();
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 },
      );
    }

    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (simInterval != null) clearInterval(simInterval);
    };
  }, [status, pushFix, setGpsState, projectCenter]);

  const hrs = Math.floor(elapsed / 3600);
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const overTarget = currentGrade > targetGrade + 1;
  const isPaused = status === 'paused';

  // Off-track distance: nearest follow-vertex to current position, in meters.
  // (A line-projection would be more accurate; vertex distance is fine for demo + small per-vertex steps.)
  const offTrackMeters = useMemo(() => {
    if (!followRoute || geoTrack.length === 0) return null;
    const here = geoTrack[geoTrack.length - 1];
    let best = Infinity;
    for (const v of followRoute.geo) {
      const d = haversineKm(here, v) * 1000;
      if (d < best) best = d;
    }
    return Math.round(best);
  }, [followRoute, geoTrack]);
  const onTrack = offTrackMeters != null && offTrackMeters < 30;

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
        <MapCanvas
          center={followRoute?.geo[0] ?? geoTrack[geoTrack.length - 1] ?? projectCenter}
          zoom={16}
          hillshade={activeProject.hasHillshade}
        >
          {/* Target trail (if following) — faint dashed underlay */}
          {followRoute && followRoute.geo.length >= 2 && (
            <MapGeoLine
              id="rec-follow"
              coords={followRoute.geo}
              color={onTrack ? '#74D5C6' : '#8E9483'}
              width={3}
              dashed
              glow={false}
            />
          )}
          <MapGeoLine id="rec-track" coords={geoTrack} color="#E88A3C" width={4} onTop />
          <FollowUserCamera coord={geoTrack[geoTrack.length - 1] ?? null} active={status === 'recording'} />
          <MapDot coord={geoTrack[0] ?? null} color="oklch(0.74 0.14 145)" outerColor="#12160F" size={14} />
          <MapCursor coord={geoTrack[geoTrack.length - 1] ?? null} pulse={status === 'recording'} />
          <MapLongPressHandler
            onLongPress={(lng, lat) => {
              // Long-press anywhere on the map drops a waypoint at that
              // coord (after the user picks a type from the picker), not
              // at the live GPS fix. Useful for marking hazards/water seen
              // at distance, or noting points before reaching them.
              setPendingDrop([lng, lat]);
              setPickerOpen(true);
            }}
          />
          <MapToolStack top={140} />
        </MapCanvas>
      </div>

      {/* Compass — overlay on the map. Shows heading on Android automatically;
          iOS users tap once to grant DeviceOrientation permission. */}
      <div style={{ position: 'absolute', top: 80, right: 16, zIndex: 3 }}>
        <CompassBadge />
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
            {followRoute && (
              <div
                style={{
                  marginLeft: 8,
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  color: onTrack ? 'var(--good)' : 'var(--warn)',
                  background: onTrack
                    ? 'color-mix(in oklch, var(--good) 18%, transparent)'
                    : 'color-mix(in oklch, var(--warn) 18%, transparent)',
                }}
              >
                {offTrackMeters == null ? 'FOLLOW' : onTrack ? `ON TRACK · ${offTrackMeters}M` : `OFF · ${offTrackMeters}M`}
              </div>
            )}
            <div
              style={{
                marginLeft: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.08em',
                color: gpsBadgeColor(gps),
              }}
            >
              GPS · {gpsBadgeLabel(gps)}
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
                strokeDasharray={`${Math.abs(currentGrade) * 5.5} 138`}
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
          onClick={() => setPickerOpen(true)}
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            display: 'grid',
            placeItems: 'center',
            position: 'relative',
          }}
          aria-label="Capture waypoint"
        >
          <Icon name="waypoint" size={20} color="var(--topo)" />
          {capturedWaypoints.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                borderRadius: 9,
                background: 'var(--topo)',
                color: '#1A1208',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                display: 'grid',
                placeItems: 'center',
                border: '2px solid var(--bg)',
              }}
            >
              {capturedWaypoints.length}
            </span>
          )}
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

      {/* Waypoint type picker modal — fires either at the live GPS fix
          (toolbar +) or at a long-pressed map coord (pendingDrop). */}
      {pickerOpen && (
        <WaypointPicker
          atCoord={pendingDrop}
          onPick={async (kind) => {
            setPickerOpen(false);
            const drop = pendingDrop;
            setPendingDrop(null);
            const dropAt = (k: WaypointKind, photoId?: string) => {
              if (drop) addWaypointAt(k, drop, undefined, photoId);
              else addWaypointOfType(k, undefined, photoId);
            };
            if (kind === 'PHOTO') {
              // Open the camera (or photo picker on desktop). On capture we
              // save the blob to IndexedDB and attach the id; on cancel we
              // still drop a generic photo waypoint at the chosen position.
              try {
                const blob = await pickCameraPhoto();
                if (blob) {
                  const photoId = newPhotoId();
                  await savePhoto(photoId, blob);
                  dropAt('PHOTO', photoId);
                  return;
                }
              } catch {
                // fall through to plain waypoint
              }
            }
            dropAt(kind);
          }}
          onCancel={() => { setPickerOpen(false); setPendingDrop(null); }}
        />
      )}

      <NavPill />
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

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

const gpsBadgeLabel = (g: GpsState): string =>
  g === 'tracking'   ? 'FIX'
  : g === 'simulated'  ? 'SIM'
  : g === 'requesting' ? '...'
  : g === 'denied'     ? 'DENIED'
  : g === 'unavailable'? 'OFF'
  : '—';

const gpsBadgeColor = (g: GpsState): string =>
  g === 'tracking'   ? 'var(--good)'
  : g === 'simulated'  ? 'var(--topo)'
  : g === 'requesting' ? 'var(--moss)'
  : 'var(--moss)';

// ─── Map child components: keep the map's MapLibre instance alive while
//     reflecting reactive coords. They render null but manage markers/cameras.

function WaypointPicker({
  onPick,
  onCancel,
  atCoord,
}: {
  onPick: (kind: WaypointKind) => void;
  onCancel: () => void;
  /** When set, waypoint will drop at this lng/lat instead of the GPS fix.
   *  Surfaced as a hint in the modal header so the user knows where it'll land. */
  atCoord?: [number, number] | null;
}) {
  const eyebrow = atCoord
    ? `DROP HERE · ${atCoord[1].toFixed(4)}° ${atCoord[1] >= 0 ? 'N' : 'S'} · ${Math.abs(atCoord[0]).toFixed(4)}° ${atCoord[0] >= 0 ? 'E' : 'W'}`
    : 'CAPTURE WAYPOINT';
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        background: 'color-mix(in oklch, var(--bg) 60%, transparent)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          border: '1px solid var(--line-soft)',
          padding: '14px 16px 22px',
          margin: '0 8px 10px',
          boxShadow: 'var(--sheet-shadow)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div className="eyebrow" style={{ color: atCoord ? 'var(--blaze)' : undefined }}>{eyebrow}</div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            style={{ background: 'transparent', border: 'none', color: 'var(--moss)' }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {WAYPOINT_TYPES.map((t) => (
            <button
              key={t.kind}
              type="button"
              onClick={() => onPick(t.kind)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '12px 4px',
                borderRadius: 12,
                background: 'var(--surface-2)',
                border: `1px solid ${t.color}`,
                color: t.color,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  background: t.color,
                  color: '#1A1208',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {t.icon}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em' }}>
                {t.label.toUpperCase()}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FollowUserCamera({ coord, active }: { coord: [number, number] | null; active: boolean }) {
  const { map } = useMapInstance();
  useEffect(() => {
    if (!map || !coord || !active) return;
    map.easeTo({ center: coord, duration: 600 });
  }, [map, coord?.[0], coord?.[1], active]);
  return null;
}

function MapDot({
  coord, color, outerColor, size,
}: { coord: [number, number] | null; color: string; outerColor: string; size: number }) {
  const { map } = useMapInstance();
  const ref = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    if (!map || !coord) return;
    const el = document.createElement('div');
    el.style.cssText = `
      width: ${size}px; height: ${size}px; border-radius: 50%;
      background: ${color}; border: 2px solid ${outerColor};
      box-shadow: 0 0 0 2px ${color}55;
    `;
    const marker = new maplibregl.Marker({ element: el }).setLngLat(coord).addTo(map);
    ref.current = marker;
    return () => { marker.remove(); ref.current = null; };
  }, [map, color, outerColor, size]);
  useEffect(() => {
    if (ref.current && coord) ref.current.setLngLat(coord);
  }, [coord?.[0], coord?.[1]]);
  return null;
}

function MapCursor({ coord, pulse }: { coord: [number, number] | null; pulse: boolean }) {
  const { map } = useMapInstance();
  const ref = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    if (!map || !coord) return;
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="width:30px;height:30px;position:relative;">
        ${pulse ? `
          <div style="position:absolute;inset:0;border-radius:50%;background:#E88A3C;opacity:0.25;animation:pulse-ring 1.6s infinite;"></div>
        ` : ''}
        <div style="position:absolute;left:9px;top:9px;width:12px;height:12px;border-radius:50%;background:#E8E4D8;border:2px solid #E88A3C;"></div>
      </div>
    `;
    const marker = new maplibregl.Marker({ element: el }).setLngLat(coord).addTo(map);
    ref.current = marker;
    return () => { marker.remove(); ref.current = null; };
  }, [map, pulse]);
  useEffect(() => {
    if (ref.current && coord) ref.current.setLngLat(coord);
  }, [coord?.[0], coord?.[1]]);
  return null;
}
