import { Link } from 'react-router-dom';
import { AndroidDevice } from './AndroidDevice';
import { SCREENS, SECTIONS, type ScreenSection } from '../screens/registry';
import { useIsMobile } from '../hooks/useIsMobile';

/**
 * The "all artboards on one canvas" overview. Mirrors the reference prototype —
 * hero intro, then each section's framed screens laid out in a grid.
 * On phone-sized viewports, renders a compact list of screen links instead
 * (rendering 13 full artboards on a phone would be unusable).
 */
export function DesignCanvas() {
  const isMobile = useIsMobile();
  const grouped: Record<ScreenSection, typeof SCREENS> = {
    project: [],
    core: [],
    field: [],
    tablet: [],
  };
  for (const s of SCREENS) grouped[s.section].push(s);

  if (isMobile) return <MobileDirectory grouped={grouped} />;

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '48px 32px 80px',
        color: 'var(--bone)',
        background: 'var(--page-bg)',
      }}
    >
      {/* Intro */}
      <div style={{ maxWidth: 880, margin: '0 auto 40px', color: 'var(--bone-dim)' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.16em',
            color: 'var(--blaze)',
            textTransform: 'uppercase',
          }}
        >
          ■ Trail Router · Android field tool
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 40,
            letterSpacing: '-0.02em',
            color: 'var(--bone)',
            margin: '8px 0 14px',
          }}
        >
          Record, edit, and optimize trails with real terrain data — in your pocket.
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.7, maxWidth: 640, margin: 0 }}>
          A mobile companion to the Trail Route Editor desktop app. 13 artboards shown below — click any label
          to open the screen full-size.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 24 }}>
          {[
            { k: 'Framework', v: 'React + MapLibre' },
            { k: 'Type',      v: 'Space Grotesk · Plex Mono · Inter' },
            { k: 'Accent',    v: 'Blaze oklch(0.72 0.17 55)' },
            { k: 'Theme',     v: 'Dark · Field-readable' },
          ].map((m) => (
            <div
              key={m.k}
              style={{
                padding: 12,
                background: 'var(--surface)',
                border: '1px solid var(--line-soft)',
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--moss)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {m.k}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  color: 'var(--bone)',
                  marginTop: 4,
                  letterSpacing: '-0.01em',
                }}
              >
                {m.v}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      {(Object.keys(grouped) as ScreenSection[]).map((section) => {
        const entries = grouped[section];
        if (!entries.length) return null;
        const meta = SECTIONS[section];
        return (
          <section key={section} style={{ maxWidth: 1600, margin: '0 auto 56px' }}>
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  color: 'var(--blaze)',
                  textTransform: 'uppercase',
                }}
              >
                {section}
              </div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 22,
                  color: 'var(--bone)',
                  margin: '4px 0 2px',
                }}
              >
                {meta.title}
              </h2>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--bone-dim)' }}>
                {meta.subtitle}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
              {entries.map((s) => (
                <Artboard key={s.id} entry={s} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Artboard({ entry }: { entry: (typeof SCREENS)[number] }) {
  const { label, path, width, height, Component } = entry;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Link
        to={path}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          color: 'var(--bone-dim)',
          textTransform: 'uppercase',
        }}
      >
        {label} →
      </Link>
      <AndroidDevice width={width} height={height}>
        <Component />
      </AndroidDevice>
    </div>
  );
}

/** Compact list used on phone-sized viewports. Each row opens the screen full-bleed. */
function MobileDirectory({ grouped }: { grouped: Record<ScreenSection, typeof SCREENS> }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--page-bg)',
        color: 'var(--bone)',
        padding: '24px 18px 40px',
        paddingTop: 'max(24px, env(safe-area-inset-top))',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.16em',
          color: 'var(--blaze)',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        ■ Trail Router
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 26,
          letterSpacing: '-0.02em',
          color: 'var(--bone)',
          margin: '0 0 20px',
          lineHeight: 1.15,
        }}
      >
        Record, edit, and optimize trails — in your pocket.
      </h1>

      {/* Start button */}
      <Link
        to="/home"
        style={{
          display: 'block',
          background: 'var(--blaze)',
          color: '#1A1208',
          borderRadius: 14,
          padding: '14px 16px',
          textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          marginBottom: 24,
        }}
      >
        Open the app →
      </Link>

      {/* Per-section screen links */}
      {(Object.keys(grouped) as ScreenSection[]).map((section) => {
        const entries = grouped[section];
        if (!entries.length) return null;
        const meta = SECTIONS[section];
        return (
          <section key={section} style={{ marginBottom: 22 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.14em',
                color: 'var(--moss)',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              {meta.title}
            </div>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line-soft)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {entries.map((s, i) => (
                <Link
                  key={s.id}
                  to={s.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--line-soft)',
                    color: 'var(--bone)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 15,
                      fontWeight: 500,
                    }}
                  >
                    {s.label}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--moss)',
                    }}
                  >
                    →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
