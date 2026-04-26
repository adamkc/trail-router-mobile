import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { BottomTabBar } from '../components/BottomTabBar';
import { useLibrary } from '../store/library';
import { useRecording } from '../store/recording';
import { usePreferences } from '../store/preferences';
import { downloadString, parseGeoJsonRoutes, pickJsonFile, serializeRoutesToGeoJson } from '../utils/geojson';
import { serializeRoutesToGpx } from '../utils/gpx';
import { loadHayforkProject } from '../utils/hayforkData';

export function SettingsScreen() {
  const navigate = useNavigate();
  const routes = useLibrary((s) => s.routes);
  const addRoute = useLibrary((s) => s.addRoute);
  const replaceLibrary = useLibrary((s) => s.replaceLibrary);
  const status = useRecording((s) => s.status);
  const hillshadeOn = usePreferences((s) => s.hillshadeOn);
  const setHillshade = usePreferences((s) => s.setHillshade);
  const markHayforkImported = usePreferences((s) => s.markHayforkImported);
  const [units, setUnits] = useState<'km' | 'mi'>('km');
  const [wifiOnly, setWifiOnly] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [highAccuracy, setHighAccuracy] = useState(true);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleClearLibrary = () => {
    if (!confirm(`Clear all ${routes.length} saved routes? This can't be undone.`)) return;
    localStorage.removeItem('trail-router-library');
    location.reload();
  };

  const handleImport = async () => {
    setImportStatus(null);
    try {
      const file = await pickJsonFile();
      if (!file) return;
      const parsed = parseGeoJsonRoutes(file.text);
      if (parsed.length === 0) {
        setImportStatus(`No LineString features found in ${file.name}`);
        return;
      }
      for (const r of parsed) addRoute(r);
      setImportStatus(`Imported ${parsed.length} route${parsed.length === 1 ? '' : 's'} from ${file.name}`);
    } catch (e) {
      setImportStatus(`Import failed: ${(e as Error).message}`);
    }
  };

  const handleReloadHayfork = async () => {
    setImportStatus(null);
    try {
      const fresh = await loadHayforkProject();
      if (fresh.length === 0) {
        setImportStatus('Hayfork data has no usable trails');
        return;
      }
      replaceLibrary(fresh);
      markHayforkImported();
      setImportStatus(`Reloaded ${fresh.length} routes from Hayfork project`);
    } catch (e) {
      setImportStatus(`Reload failed: ${(e as Error).message}`);
    }
  };

  const handleExportAll = (format: 'geojson' | 'gpx') => {
    if (routes.length === 0) {
      setImportStatus('Library is empty — nothing to export');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'geojson') {
      downloadString(
        `trail-router-library-${stamp}.geojson`,
        'application/geo+json',
        serializeRoutesToGeoJson(routes),
      );
    } else {
      downloadString(
        `trail-router-library-${stamp}.gpx`,
        'application/gpx+xml',
        serializeRoutesToGpx(routes),
      );
    }
    setImportStatus(`Exported ${routes.length} routes as ${format.toUpperCase()}`);
  };

  return (
    <div className="screen">
      <StatusBar />

      {/* Header */}
      <div style={{ padding: '12px 20px 16px' }}>
        <div className="stat-label">PREFERENCES</div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            marginTop: 2,
          }}
        >
          Settings
        </div>
      </div>

      {/* Section: Field */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
        <SectionLabel>FIELD</SectionLabel>
        <Card>
          <ToggleRow
            label="High-accuracy GPS"
            sub="Uses more battery; required for grade coaching"
            on={highAccuracy}
            onToggle={() => setHighAccuracy((v) => !v)}
          />
          <Divider />
          <ToggleRow
            label="Snap haptics"
            sub="Light tick when a vertex snaps to a junction or contour"
            on={haptics}
            onToggle={() => setHaptics((v) => !v)}
          />
          <Divider />
          <ToggleRow
            label="Show hillshade"
            sub="Pre-rendered SRTM relief overlay on the Hayfork project area"
            on={hillshadeOn}
            onToggle={() => setHillshade(!hillshadeOn)}
          />
          <Divider />
          <SegmentRow
            label="Units"
            options={[
              { key: 'km', label: 'KM · M'      },
              { key: 'mi', label: 'MI · FT'     },
            ]}
            value={units}
            onSelect={setUnits}
          />
        </Card>

        {/* Section: Offline */}
        <SectionLabel>OFFLINE</SectionLabel>
        <Card>
          <ToggleRow
            label="Download over Wi-Fi only"
            sub="Prevents cellular data use for tile + DEM downloads"
            on={wifiOnly}
            onToggle={() => setWifiOnly((v) => !v)}
          />
          <Divider />
          <NavRow
            label="Manage offline data"
            sub="Per-project tile + DEM cache"
            onClick={() => navigate('/offline')}
          />
        </Card>

        {/* Section: Account */}
        <SectionLabel>PROJECT</SectionLabel>
        <Card>
          <NavRow label="Hayfork" sub={`Trinity County · ${routes.length} routes`} onClick={() => navigate('/projects')} />
          <Divider />
          <NavRow label="Saved routes" sub={`${routes.length} in library`} onClick={() => navigate('/library')} />
          <Divider />
          <NavRow
            label="Reload Hayfork data"
            sub="Replace the library with fresh trails from the bundled GeoJSON"
            onClick={handleReloadHayfork}
          />
        </Card>

        {/* Section: Data */}
        <SectionLabel>DATA</SectionLabel>
        <Card>
          <NavRow
            label="Import GeoJSON…"
            sub="Add LineString features from a .geojson file (Strava, OSM, QGIS export)"
            onClick={handleImport}
          />
          <Divider />
          <NavRow
            label="Export library · GeoJSON"
            sub={`Download all ${routes.length} routes (Strava, OSM, QGIS, geojson.io)`}
            onClick={() => handleExportAll('geojson')}
          />
          <Divider />
          <NavRow
            label="Export library · GPX"
            sub={`Download all ${routes.length} routes (Garmin, Komoot, Gaia, AllTrails)`}
            onClick={() => handleExportAll('gpx')}
          />
          <Divider />
          <DangerRow
            label="Clear saved routes"
            sub={`Removes all ${routes.length} entries from local storage`}
            onClick={handleClearLibrary}
          />
        </Card>
        {importStatus && (
          <div
            style={{
              marginTop: 8,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'color-mix(in oklch, var(--blaze) 12%, var(--surface-2))',
              border: '1px solid color-mix(in oklch, var(--blaze) 35%, transparent)',
              color: 'var(--bone)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.04em',
            }}
          >
            {importStatus}
          </div>
        )}

        {/* Section: About */}
        <SectionLabel>ABOUT</SectionLabel>
        <Card>
          <ReadOnlyRow label="Version" value="0.1 · dev" />
          <Divider />
          <ReadOnlyRow label="Recording state" value={status.toUpperCase()} />
          <Divider />
          <ReadOnlyRow label="Map tiles" value="Carto · OSM" />
        </Card>

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--moss)',
            letterSpacing: '0.08em',
            textAlign: 'center',
            marginTop: 16,
            marginBottom: 16,
          }}
        >
          TRAIL ROUTER · MOBILE · ADAMKC/TRAIL-ROUTER-MOBILE
        </div>
      </div>

      <BottomTabBar active="settings" />
      <NavPill />
    </div>
  );
}

// ─── Settings sub-components ───────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--moss)',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        margin: '14px 4px 6px',
      }}
    >
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line-soft)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--line-soft)' }} />;
}

function ToggleRow({
  label, sub, on, onToggle,
}: { label: string; sub?: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        color: 'var(--bone)',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500 }}>{label}</div>
        {sub && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--moss)',
              letterSpacing: '0.05em',
              marginTop: 2,
            }}
          >
            {sub.toUpperCase()}
          </div>
        )}
      </div>
      <div
        style={{
          width: 44,
          height: 26,
          borderRadius: 14,
          background: on ? 'var(--blaze)' : 'var(--surface-3)',
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.15s ease',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 'calc(100% - 24px)' : 2,
            width: 22,
            height: 22,
            borderRadius: 11,
            background: on ? '#1A1208' : 'var(--bone-dim)',
            transition: 'left 0.15s ease',
          }}
        />
      </div>
    </button>
  );
}

function SegmentRow<T extends string>({
  label, options, value, onSelect,
}: {
  label: string;
  options: Array<{ key: T; label: string }>;
  value: T;
  onSelect: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
      <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500 }}>{label}</div>
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 8, padding: 2 }}>
        {options.map((o) => {
          const active = o.key === value;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onSelect(o.key)}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                background: active ? 'var(--blaze)' : 'transparent',
                color: active ? '#1A1208' : 'var(--bone-dim)',
                border: 'none',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavRow({ label, sub, onClick }: { label: string; sub?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        color: 'var(--bone)',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500 }}>{label}</div>
        {sub && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--moss)',
              letterSpacing: '0.05em',
              marginTop: 2,
            }}
          >
            {sub.toUpperCase()}
          </div>
        )}
      </div>
      <Icon name="chevron-right" size={16} color="var(--moss)" />
    </button>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
      <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500 }}>{label}</div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--moss)',
          letterSpacing: '0.06em',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DangerRow({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        color: 'var(--danger)',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500 }}>{label}</div>
        {sub && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--moss)',
              letterSpacing: '0.05em',
              marginTop: 2,
            }}
          >
            {sub.toUpperCase()}
          </div>
        )}
      </div>
      <Icon name="chevron-right" size={16} color="var(--danger)" />
    </button>
  );
}
