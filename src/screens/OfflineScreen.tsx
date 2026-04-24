import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';

const STORAGE_BREAKDOWN = [
  { label: 'DEM',      color: 'var(--blaze)', size: '720 MB', width: '9%' },
  { label: 'TILES',    color: 'var(--topo)',  size: '310 MB', width: '4%' },
  { label: 'CONTOURS', color: 'var(--good)',  size: '240 MB', width: '3%' },
  { label: 'PHOTOS',   color: 'var(--warn)',  size: '150 MB', width: '2%' },
];

const HAYFORK_ASSETS = ['DEM ✓', 'HILLSHADE ✓', 'CONTOURS ✓', 'TRAILS ✓'];

export function OfflineScreen() {
  const navigate = useNavigate();
  return (
    <div className="screen">
      <StatusBar />

      {/* Header */}
      <div style={{ padding: '6px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={() => navigate('/home')}
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
          aria-label="Back to home"
        >
          <Icon name="back" size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="eyebrow">FIELD READY</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>
            Offline data
          </div>
        </div>
      </div>

      {/* Storage summary */}
      <div
        style={{
          margin: '0 16px',
          padding: 14,
          borderRadius: 16,
          background: 'var(--surface)',
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
          <div className="eyebrow">STORAGE</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone-dim)' }}>
            1.42 / 8.0 GB
          </div>
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: 'var(--surface-2)',
            overflow: 'hidden',
            display: 'flex',
          }}
        >
          {STORAGE_BREAKDOWN.map((s) => (
            <div key={s.label} style={{ width: s.width, background: s.color }} />
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 14,
            marginTop: 8,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--bone-dim)',
            letterSpacing: '0.05em',
            flexWrap: 'wrap',
          }}
        >
          {STORAGE_BREAKDOWN.map((s) => (
            <span key={s.label}>
              <span style={{ color: s.color }}>●</span> {s.label} {s.size}
            </span>
          ))}
        </div>
      </div>

      {/* Project download cards */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px 16px' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>DOWNLOADED PROJECTS</div>

        {/* Hayfork — fully cached */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid color-mix(in oklch, var(--blaze) 35%, var(--line-soft))',
            borderRadius: 14,
            padding: 12,
            marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'color-mix(in oklch, var(--blaze) 15%, var(--surface-2))',
                border: '1px solid color-mix(in oklch, var(--blaze) 40%, transparent)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="mountain" size={18} color="var(--blaze)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500 }}>Hayfork</div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--good)',
                  letterSpacing: '0.08em',
                  marginTop: 2,
                }}
              >
                ● READY OFFLINE · 980 MB
              </div>
            </div>
            <Icon name="more" size={18} color="var(--moss)" />
          </div>
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginTop: 10,
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--bone-dim)',
              letterSpacing: '0.06em',
            }}
          >
            {HAYFORK_ASSETS.map((a) => (
              <span
                key={a}
                style={{ padding: '3px 7px', borderRadius: 6, background: 'var(--surface-2)' }}
              >
                {a}
              </span>
            ))}
          </div>
        </div>

        {/* Hidden Lakes — downloading */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line-soft)',
            borderRadius: 14,
            padding: 12,
            marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--surface-2)',
                border: '1px solid var(--line-soft)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="download" size={18} color="var(--topo)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500 }}>
                Hidden Lakes Loop
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--topo)',
                  letterSpacing: '0.08em',
                  marginTop: 2,
                }}
              >
                DOWNLOADING · 62% · 4.2 MB/s
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone-dim)' }}>
              340/550 MB
            </div>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 2,
              background: 'var(--surface-2)',
              overflow: 'hidden',
              marginTop: 10,
            }}
          >
            <div style={{ width: '62%', height: '100%', background: 'var(--topo)' }} />
          </div>
        </div>

        {/* Sierra Buttes — cloud only */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line-soft)',
            borderRadius: 14,
            padding: 12,
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--line-soft)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name="layers" size={18} color="var(--moss)" />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                fontWeight: 500,
                color: 'var(--bone-dim)',
              }}
            >
              Sierra Buttes
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--moss)',
                letterSpacing: '0.08em',
                marginTop: 2,
              }}
            >
              CLOUD ONLY · 1.2 GB
            </div>
          </div>
          <div
            style={{
              padding: '7px 12px',
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--line-soft)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.1em',
              color: 'var(--bone)',
            }}
          >
            DOWNLOAD
          </div>
        </div>

        {/* Wi-Fi only toggle */}
        <div className="eyebrow" style={{ marginTop: 16, marginBottom: 8 }}>AUTOMATIC</div>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line-soft)',
            borderRadius: 14,
            padding: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500 }}>
              Download over Wi-Fi only
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
              PREVENTS CELLULAR DATA USE
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 26,
              borderRadius: 14,
              background: 'var(--blaze)',
              position: 'relative',
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
      </div>
      <NavPill />
    </div>
  );
}
