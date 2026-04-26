import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { BottomTabBar } from '../components/BottomTabBar';
import { useRecording } from '../store/recording';
import { useLibrary } from '../store/library';
import { useActiveProject } from '../store/projects';
import { computeDaylight, fetchCurrentWeather, type WeatherInfo } from '../utils/weather';
import type { ChipTone } from '../components/Chip';

type RecentTag = ChipTone | null;

const tagColor = (t: RecentTag): string =>
  t === 'blaze' ? 'var(--blaze)'
  : t === 'warn'  ? 'var(--warn)'
  : t === 'good'  ? 'var(--good)'
  : 'var(--bone)';

const formatElapsed = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** Pick a time-of-day greeting based on the local hour. */
function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 5)  return 'Late one,';
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  if (h < 21) return 'Good evening,';
  return 'Late one,';
}

/** Format [lng, lat] as a degree-and-decimal string with N/S/E/W suffixes. */
function formatCoords(coord: [number, number]): string {
  const [lng, lat] = coord;
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns} · ${Math.abs(lng).toFixed(4)}° ${ew}`;
}

export function HomeScreen() {
  const navigate = useNavigate();
  const allRoutes = useLibrary((s) => s.routes);
  const activeProject = useActiveProject();
  // Recents are scoped to the active project so the Home shelf reflects the
  // user's current context — switching projects swaps what's shown.
  const routes = allRoutes.filter((r) => r.projectId === activeProject.id);
  const recents = routes.slice(0, 4);
  const recordingStatus = useRecording((s) => s.status);
  const elapsed = useRecording((s) => s.elapsed);
  const distance = useRecording((s) => s.distance);
  const gain = useRecording((s) => s.gain);
  const draftName = useRecording((s) => s.draftName);
  const startRecording = useRecording((s) => s.start);
  const resumeRecording = useRecording((s) => s.resume);
  const canResume = recordingStatus === 'paused';

  const handleRecord = () => {
    if (recordingStatus === 'idle') startRecording();
    else if (recordingStatus === 'paused') resumeRecording();
    navigate('/record');
  };
  const handleResume = () => {
    resumeRecording();
    navigate('/record');
  };

  // Daylight is computed locally (NOAA solar formula) — no network. Weather
  // is one Open-Meteo fetch on mount; null fields render as dashes if the
  // call fails (offline first-launch).
  const daylight = useMemo(() => computeDaylight(activeProject.center), [activeProject.center]);
  const [weather, setWeather] = useState<WeatherInfo>({ tempC: null, windKph: null, windDir: null });
  useEffect(() => {
    const ctrl = new AbortController();
    fetchCurrentWeather(activeProject.center, ctrl.signal).then(setWeather);
    return () => ctrl.abort();
  }, [activeProject.center]);
  const contours = [];
  for (let i = 0; i < 16; i++) {
    const rx = 60 + i * 26;
    const ry = 40 + i * 20;
    contours.push(
      <ellipse
        key={i}
        cx={196}
        cy={260}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={i % 5 === 0 ? 'var(--moss)' : 'var(--moss-dim)'}
        strokeWidth={i % 5 === 0 ? 0.7 : 0.35}
        opacity={i % 5 === 0 ? 0.45 : 0.25}
      />,
    );
  }

  return (
    <div className="screen">
      <StatusBar />

      {/* Topo hero backdrop */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <svg viewBox="0 0 392 820" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%' }}>
          <defs>
            <radialGradient id="topo-vignette" cx="50%" cy="28%" r="70%">
              <stop offset="0%"   stopColor="#1d2418" stopOpacity="1" />
              <stop offset="100%" stopColor="#12160F" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="392" height="820" fill="url(#topo-vignette)" />
          {contours}
          {/* crosshair at "you are here" */}
          <g transform="translate(196, 240)">
            <circle r="26" fill="none" stroke="var(--blaze)" strokeWidth="0.8" opacity="0.35" />
            <circle r="14" fill="none" stroke="var(--blaze)" strokeWidth="0.8" opacity="0.55" />
            <circle r="5" fill="var(--blaze)" stroke="#12160F" strokeWidth="1.5" />
            <line x1="-40" y1="0" x2="-22" y2="0" stroke="var(--blaze)" strokeWidth="0.8" opacity="0.5" />
            <line x1="22" y1="0" x2="40" y2="0" stroke="var(--blaze)" strokeWidth="0.8" opacity="0.5" />
            <line x1="0" y1="-40" x2="0" y2="-22" stroke="var(--blaze)" strokeWidth="0.8" opacity="0.5" />
            <line x1="0" y1="22" x2="0" y2="40" stroke="var(--blaze)" strokeWidth="0.8" opacity="0.5" />
          </g>
        </svg>
      </div>

      {/* Orientation strip */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '8px 20px 4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.1em',
          color: 'var(--moss)',
        }}
      >
        <span>◉ PROJECT · {activeProject.name.toUpperCase()}</span>
        <span>{routes.length} ROUTE{routes.length === 1 ? '' : 'S'}</span>
      </div>

      {/* Hero greeting */}
      <div style={{ position: 'relative', zIndex: 2, padding: '80px 24px 0' }}>
        <div className="eyebrow">TRAIL ROUTER</div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 34,
            fontWeight: 500,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            marginTop: 8,
            color: 'var(--bone)',
          }}
        >
          {greetingForNow()}
          <br />
          <span style={{ color: 'var(--blaze)' }}>{activeProject.name}.</span>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--bone-dim)',
            letterSpacing: '0.05em',
            marginTop: 10,
            lineHeight: 1.5,
          }}
        >
          {formatCoords(activeProject.center)}
          <br />
          <span style={{ color: 'var(--moss)' }}>{activeProject.subtitle.toUpperCase()}</span>
        </div>
      </div>

      {/* spacer */}
      <div style={{ flex: 1 }} />

      {/* Resume card — only when a recording is paused */}
      {canResume && (
        <button
          type="button"
          onClick={handleResume}
          style={{
            position: 'relative',
            zIndex: 2,
            margin: '0 16px 10px',
            padding: 14,
            borderRadius: 16,
            background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
            backdropFilter: 'blur(12px)',
            border: '1px solid color-mix(in oklch, var(--blaze) 35%, var(--line-soft))',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textAlign: 'left',
            width: 'auto',
          }}
        >
          <div style={{ width: 8, height: 38, borderRadius: 4, background: 'var(--blaze)' }} />
          <div style={{ flex: 1 }}>
            <div className="eyebrow" style={{ color: 'var(--blaze)' }}>RESUME RECORDING</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, marginTop: 2 }}>
              {draftName}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--moss)',
                letterSpacing: '0.08em',
                marginTop: 3,
              }}
            >
              PAUSED {formatElapsed(elapsed)} · {distance.toFixed(2)} KM · +{gain} M
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              background: 'var(--blaze)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="play" size={18} color="#1A1208" />
          </div>
        </button>
      )}

      {/* Primary actions */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          margin: '0 16px 12px',
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr 1fr',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={handleRecord}
          style={{
            padding: '16px 14px',
            borderRadius: 16,
            background: 'var(--blaze)',
            color: '#1A1208',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 110,
            textAlign: 'left',
            border: 'none',
          }}
        >
          <Icon name="record" size={22} color="#1A1208" />
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', opacity: 0.7 }}>
              {canResume ? 'RESUME' : 'PRIMARY'}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              {canResume ? 'Resume' : 'Record'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', opacity: 0.75, marginTop: 2 }}>
              {canResume ? formatElapsed(elapsed).toUpperCase() : 'NEW TRACK'}
            </div>
          </div>
        </button>

        {[
          { icon: 'library' as const, label: 'Routes', meta: `${routes.length} SAVED`, to: '/library' },
          { icon: 'pin'     as const, label: 'Map',    meta: 'HILLSHADE',              to: '/map'     },
        ].map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => navigate(card.to)}
            style={{
              padding: '14px 12px',
              borderRadius: 16,
              background: 'var(--surface)',
              border: '1px solid var(--line-soft)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 110,
              textAlign: 'left',
              color: 'var(--bone)',
            }}
          >
            <Icon name={card.icon} size={20} color="var(--bone)" />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500 }}>
                {card.label}
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
                {card.meta}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Recents strip */}
      <div style={{ position: 'relative', zIndex: 2, margin: '4px 0 10px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '0 20px 8px',
          }}
        >
          <div className="eyebrow">RECENT ROUTES</div>
          <button
            type="button"
            onClick={() => navigate('/library')}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--moss)',
              letterSpacing: '0.08em',
            }}
          >
            SEE ALL →
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 20px' }}>
          {recents.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => navigate(`/details/${r.id}`)}
              style={{
                flexShrink: 0,
                width: 118,
                padding: 10,
                borderRadius: 12,
                background: 'color-mix(in oklch, var(--surface) 88%, transparent)',
                border: '1px solid var(--line-soft)',
                backdropFilter: 'blur(8px)',
                color: 'var(--bone)',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 8,
                  background: 'var(--surface-2)',
                  position: 'relative',
                  overflow: 'hidden',
                  marginBottom: 8,
                }}
              >
                <svg
                  viewBox="0 0 100 44"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                >
                  {[0, 1, 2, 3].map((k) => (
                    <ellipse
                      key={k}
                      cx={50 + Math.sin(i + k) * 6}
                      cy={22 + Math.cos(i) * 2}
                      rx={12 + k * 9}
                      ry={6 + k * 5}
                      fill="none"
                      stroke="var(--moss-dim)"
                      strokeWidth="0.4"
                      opacity="0.5"
                    />
                  ))}
                  <path
                    d={`M 6 ${30 - i * 2} Q 30 ${14 + i}, 50 ${22 + i} T 94 ${24 + i * 2}`}
                    fill="none"
                    stroke={tagColor(r.tag)}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 12,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {r.name}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: 'var(--moss)',
                  letterSpacing: '0.06em',
                  marginTop: 3,
                }}
              >
                {r.km} KM · {r.gain} M
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Conditions footer */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          margin: '0 16px 10px',
          padding: '10px 14px',
          borderRadius: 12,
          background: 'color-mix(in oklch, var(--surface) 85%, transparent)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--line-soft)',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 4,
        }}
      >
        {[
          { label: 'SUNSET',   value: daylight.sunset ?? '—',                                              color: 'var(--bone)' },
          { label: 'DAYLIGHT', value: daylight.daylight ?? '—',                                            color: 'var(--warn)' },
          { label: 'TEMP',     value: weather.tempC == null ? '—'   : `${weather.tempC}°C`,                color: 'var(--bone)' },
          { label: 'WIND',     value: weather.windKph == null ? '—' : `${weather.windDir ?? ''} ${weather.windKph}`.trim(), color: 'var(--bone)' },
        ].map((s) => (
          <div key={s.label}>
            <div className="stat-label" style={{ fontSize: 9 }}>{s.label}</div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: s.color,
                marginTop: 2,
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <BottomTabBar active="home" />
      <NavPill />
    </div>
  );
}
