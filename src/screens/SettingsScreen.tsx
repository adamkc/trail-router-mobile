import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';
import { Icon } from '../components/Icon';
import { BottomTabBar } from '../components/BottomTabBar';
import { useLibrary } from '../store/library';
import { useRecording } from '../store/recording';
import { usePreferences } from '../store/preferences';
import { useActiveProject, useProjects } from '../store/projects';
import {
  downloadString,
  parseGeoJsonRoutes,
  pickGpxFile,
  pickJsonFile,
  serializeRoutesToGeoJson,
} from '../utils/geojson';
import { parseGpxRoutes, serializeRoutesToGpx } from '../utils/gpx';
import {
  blobStorageBytes,
  clearBlobsByPrefix,
  deleteHillshade,
  pickImageFile,
  saveHillshade,
} from '../utils/photoStore';
import { exportBackup, formatSize, restoreBackup } from '../utils/backup';
import {
  disableSync,
  getSyncFolderName,
  isSyncSupported,
  pickSyncFolder,
  readSyncBackup,
  writeSyncBackup,
} from '../utils/syncFolder';
import { backfillElevations, loadHayforkProject } from '../utils/hayforkData';

export function SettingsScreen() {
  const navigate = useNavigate();
  const routes = useLibrary((s) => s.routes);
  const addRoute = useLibrary((s) => s.addRoute);
  const replaceLibrary = useLibrary((s) => s.replaceLibrary);
  const activeProject = useActiveProject();
  const projects = useProjects((s) => s.projects);
  const removeProject = useProjects((s) => s.removeProject);
  const renameProject = useProjects((s) => s.renameProject);
  const updateProject = useProjects((s) => s.updateProject);
  const setActive = useProjects((s) => s.setActive);
  const projectRoutes = routes.filter((r) => r.projectId === activeProject.id);

  const canDeleteActive = activeProject.id !== 'hayfork';

  const handleBackupExport = async () => {
    setImportStatus(null);
    try {
      const { filename, json, sizeBytes, counts } = await exportBackup();
      downloadString(filename, 'application/json', json);
      setImportStatus(
        `Backup saved: ${formatSize(sizeBytes)} · ${counts.projects} projects · ${counts.routes} routes · ${counts.visits} visits · ${counts.blobs} photos/hillshades`,
      );
    } catch (e) {
      setImportStatus(`Backup failed: ${(e as Error).message}`);
    }
  };
  const handleBackupRestore = async () => {
    setImportStatus(null);
    try {
      const file = await pickJsonFile('.json,application/json');
      if (!file) return;
      if (!confirm(
        `Restore from "${file.name}"? This will REPLACE all current projects, routes, visits, and photos with the backup's contents.`,
      )) return;
      const summary = await restoreBackup(file.text);
      setImportStatus(
        `Restored ${summary.projects} projects · ${summary.routes} routes · ${summary.visits} visits · ${summary.blobs} photos/hillshades from ${file.name}`,
      );
    } catch (e) {
      setImportStatus(`Restore failed: ${(e as Error).message}`);
    }
  };
  const handleUploadHillshade = async () => {
    if (activeProject.id === 'hayfork') {
      setImportStatus('Hayfork uses the bundled hillshade — pick a different project to upload your own');
      return;
    }
    setImportStatus(null);
    try {
      const blob = await pickImageFile();
      if (!blob) return;
      await saveHillshade(activeProject.id, blob);
      updateProject(activeProject.id, { hasHillshade: true });
      const sizeKb = (blob.size / 1024).toFixed(0);
      setImportStatus(`Hillshade attached to "${activeProject.name}" · ${sizeKb} KB · clipped to project bounds`);
    } catch (e) {
      setImportStatus(`Hillshade upload failed: ${(e as Error).message}`);
    }
  };
  const handleRemoveHillshade = async () => {
    if (activeProject.id === 'hayfork') return;
    if (!confirm(`Remove hillshade from "${activeProject.name}"?`)) return;
    await deleteHillshade(activeProject.id);
    updateProject(activeProject.id, { hasHillshade: false });
    setImportStatus(`Hillshade removed from "${activeProject.name}"`);
  };
  const handleRenameActiveProject = () => {
    const next = window.prompt(
      `Rename project "${activeProject.name}":`,
      activeProject.name,
    );
    if (!next || next.trim() === '' || next.trim() === activeProject.name) return;
    const sub = window.prompt('Subtitle (optional):', activeProject.subtitle) ?? undefined;
    renameProject(activeProject.id, next, sub);
  };
  const handleDeleteActiveProject = () => {
    if (!canDeleteActive) return;
    if (!confirm(
      `Delete project "${activeProject.name}"? Its ${projectRoutes.length} route${projectRoutes.length === 1 ? '' : 's'} will also be removed.`,
    )) return;
    // Drop the routes first so the library doesn't briefly orphan them.
    const remaining = routes.filter((r) => r.projectId !== activeProject.id);
    replaceLibrary(remaining);
    removeProject(activeProject.id);
    setActive('hayfork');
  };
  const status = useRecording((s) => s.status);
  const hillshadeOn = usePreferences((s) => s.hillshadeOn);
  const setHillshade = usePreferences((s) => s.setHillshade);
  const markHayforkImported = usePreferences((s) => s.markHayforkImported);
  const [units, setUnits] = useState<'km' | 'mi'>('km');
  const [wifiOnly, setWifiOnly] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [highAccuracy, setHighAccuracy] = useState(true);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const autoSyncEnabled = usePreferences((s) => s.autoSyncEnabled);
  const setAutoSyncEnabled = usePreferences((s) => s.setAutoSyncEnabled);
  const lastSyncedAt = usePreferences((s) => s.lastSyncedAt);
  const setLastSyncedAt = usePreferences((s) => s.setLastSyncedAt);
  const [syncFolder, setSyncFolder] = useState<string | null>(null);
  const syncSupported = isSyncSupported();
  const [photoUsage, setPhotoUsage] = useState<{ count: number; bytes: number } | null>(null);

  // One-shot photo storage scan on mount; refreshes after clear actions
  // so the row reflects what actually changed.
  const refreshPhotoUsage = () => {
    blobStorageBytes('ph-').then(setPhotoUsage).catch(() => setPhotoUsage(null));
  };
  useEffect(() => {
    refreshPhotoUsage();
  }, []);

  // Hydrate the saved folder name on mount so the Settings row reflects
  // reality without forcing the user to re-pick.
  useEffect(() => {
    if (!syncSupported) return;
    getSyncFolderName().then(setSyncFolder).catch(() => setSyncFolder(null));
  }, [syncSupported]);

  const handlePickSyncFolder = async () => {
    setImportStatus(null);
    try {
      const name = await pickSyncFolder();
      if (!name) return; // user cancelled
      setSyncFolder(name);
      setAutoSyncEnabled(true);
      setLastSyncedAt(Date.now());
      setImportStatus(`Auto-sync enabled — backup will write to "${name}" on every change.`);
    } catch (e) {
      setImportStatus(`Sync folder pick failed: ${(e as Error).message}`);
    }
  };
  const handleSyncNow = async () => {
    setImportStatus(null);
    try {
      const result = await writeSyncBackup();
      if (!result) {
        setImportStatus('Sync failed — folder permission denied or no folder picked.');
        return;
      }
      setLastSyncedAt(Date.now());
      setImportStatus(`Wrote ${formatSize(result.sizeBytes)} to "${result.folder}".`);
    } catch (e) {
      setImportStatus(`Sync failed: ${(e as Error).message}`);
    }
  };
  const handleRestoreFromSyncFolder = async () => {
    setImportStatus(null);
    if (!confirm('Restore from the sync folder? This REPLACES all current data with the folder copy.')) return;
    try {
      const summary = await readSyncBackup();
      if (!summary) {
        setImportStatus('No backup found in the sync folder.');
        return;
      }
      setImportStatus(
        `Restored ${summary.projects} projects · ${summary.routes} routes · ${summary.visits} visits · ${summary.blobs} photos/hillshades from sync folder`,
      );
    } catch (e) {
      setImportStatus(`Restore failed: ${(e as Error).message}`);
    }
  };
  const handleClearPhotos = async () => {
    if (!confirm(
      'Delete every photo waypoint blob?\n\nWaypoints stay in their routes (label, type, location), but their attached photos are removed permanently. This is irreversible.',
    )) return;
    const removed = await clearBlobsByPrefix('ph-');
    // Strip photoId references off every waypoint so the UI stops trying
    // to load missing blobs.
    const lib = useLibrary.getState();
    lib.replaceLibrary(
      lib.routes.map((r) => ({
        ...r,
        waypoints: r.waypoints.map((w) => ({ ...w, photoId: undefined })),
      })),
    );
    refreshPhotoUsage();
    setImportStatus(`Cleared ${removed} photo blob${removed === 1 ? '' : 's'}.`);
  };
  const handleClearAllData = async () => {
    if (!confirm(
      'NUKE ALL LOCAL DATA?\n\nDeletes: every project, route, waypoint, visit, photo, attached hillshade, and preference. The bundled Hayfork project will reload on next launch.\n\nThis CANNOT be undone. Backup first via "Save backup file…" if you might want any of it back.',
    )) return;
    if (!confirm('Are you absolutely sure?')) return;
    // Drop every IDB blob (photos + hillshades + sync folder handle).
    await clearBlobsByPrefix('');
    try {
      indexedDB.deleteDatabase('trail-router-sync');
    } catch { /* sync DB may not exist */ }
    // Clear the four persisted zustand stores.
    localStorage.removeItem('trail-router-library');
    localStorage.removeItem('trail-router-projects');
    localStorage.removeItem('trail-router-visits');
    localStorage.removeItem('trail-router-preferences');
    location.reload();
  };
  const handleDisableSync = async () => {
    await disableSync();
    setSyncFolder(null);
    setAutoSyncEnabled(false);
    setLastSyncedAt(null);
    setImportStatus('Auto-sync disabled.');
  };

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

  const handleImportGpx = async () => {
    setImportStatus(null);
    try {
      const file = await pickGpxFile();
      if (!file) return;
      const parsed = parseGpxRoutes(file.text);
      if (parsed.length === 0) {
        setImportStatus(`No <trk> elements found in ${file.name}`);
        return;
      }
      for (const r of parsed) addRoute(r);
      const wpCount = parsed.reduce((acc, r) => acc + r.waypoints.length, 0);
      setImportStatus(
        `Imported ${parsed.length} track${parsed.length === 1 ? '' : 's'} from ${file.name}` +
          (wpCount ? ` · ${wpCount} waypoint${wpCount === 1 ? '' : 's'}` : ''),
      );
    } catch (e) {
      setImportStatus(`GPX import failed: ${(e as Error).message}`);
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
      setImportStatus(`Reloaded ${fresh.length} routes — fetching real elevations…`);
      const enriched = await backfillElevations(fresh);
      if (enriched > 0) {
        replaceLibrary(fresh);
        setImportStatus(
          `Reloaded ${fresh.length} routes · real Open-Meteo elevations on ${enriched}`,
        );
      } else {
        setImportStatus(
          `Reloaded ${fresh.length} routes · elevation API unavailable, using synthetic profile`,
        );
      }
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
          <NavRow
            label={activeProject.name}
            sub={`${activeProject.subtitle} · ${projectRoutes.length} route${projectRoutes.length === 1 ? '' : 's'}`}
            onClick={() => navigate('/projects')}
          />
          <Divider />
          <NavRow label="All projects" sub={`${projects.length} in library`} onClick={() => navigate('/projects')} />
          <Divider />
          <NavRow label="Saved routes" sub={`${routes.length} across all projects`} onClick={() => navigate('/library')} />
          <Divider />
          <NavRow
            label="Reload Hayfork data"
            sub="Replace the library with fresh trails from the bundled GeoJSON"
            onClick={handleReloadHayfork}
          />
          <Divider />
          <NavRow
            label={`Rename "${activeProject.name}"`}
            sub="Edit the active project's display name + subtitle"
            onClick={handleRenameActiveProject}
          />
          {activeProject.id !== 'hayfork' && (
            <>
              <Divider />
              <NavRow
                label={activeProject.hasHillshade ? 'Replace hillshade…' : 'Add hillshade…'}
                sub={activeProject.hasHillshade
                  ? 'Pick a new PNG; clipped to project bounds'
                  : 'Attach a PNG (e.g. SRTM hillshade exported from QGIS) — clipped to project bounds'}
                onClick={handleUploadHillshade}
              />
              {activeProject.hasHillshade && (
                <>
                  <Divider />
                  <DangerRow
                    label="Remove hillshade"
                    sub="Drops the attached PNG; project still works without it"
                    onClick={handleRemoveHillshade}
                  />
                </>
              )}
            </>
          )}
          {canDeleteActive && (
            <>
              <Divider />
              <DangerRow
                label={`Delete project "${activeProject.name}"`}
                sub={`Removes ${projectRoutes.length} route${projectRoutes.length === 1 ? '' : 's'} and switches to Hayfork`}
                onClick={handleDeleteActiveProject}
              />
            </>
          )}
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
            label="Import GPX…"
            sub="Add tracks + waypoints from a .gpx file (Garmin, Komoot, Gaia, AllTrails)"
            onClick={handleImportGpx}
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

        {/* Section: Backup — single-file local backup; no cloud, no server. */}
        <SectionLabel>BACKUP</SectionLabel>
        <Card>
          <NavRow
            label="Save backup file…"
            sub="One JSON with everything: projects, routes, visits, photos, hillshades. Drop it in iCloud / Dropbox / OneDrive for cross-device sync via your own cloud."
            onClick={handleBackupExport}
          />
          <Divider />
          <NavRow
            label="Restore from backup file…"
            sub="Replaces all current data with the backup's contents. Confirm before applying."
            onClick={handleBackupRestore}
          />
        </Card>

        {/* Section: Storage — surfaces blob byte counts and offers nuclear
            options for users running low on space. */}
        <SectionLabel>STORAGE</SectionLabel>
        <Card>
          <ReadOnlyRow
            label="Photo waypoints"
            value={photoUsage ? `${photoUsage.count} · ${formatSize(photoUsage.bytes)}` : '—'}
          />
          <Divider />
          <DangerRow
            label="Clear photos"
            sub="Deletes every captured photo blob; keeps the waypoints themselves"
            onClick={handleClearPhotos}
          />
          <Divider />
          <DangerRow
            label="Clear ALL local data"
            sub="Wipes projects, routes, visits, photos, hillshades, and preferences. Hayfork reloads on next launch."
            onClick={handleClearAllData}
          />
        </Card>

        {/* Section: Auto-sync — Chrome/Edge only. Pick a folder once, app
            writes backup JSON on every change. Drop folder in iCloud Drive /
            Dropbox / OneDrive for free cross-device sync via the user's
            existing cloud. */}
        {syncSupported ? (
          <>
            <SectionLabel>AUTO-SYNC</SectionLabel>
            <Card>
              {syncFolder ? (
                <>
                  <ToggleRow
                    label={`Auto-sync to "${syncFolder}"`}
                    sub={
                      autoSyncEnabled
                        ? lastSyncedAt
                          ? `Last write ${formatRelativeAgo(lastSyncedAt)} · drop folder in iCloud / Dropbox to sync devices`
                          : 'Writing on every change — drop folder in iCloud / Dropbox to sync devices'
                        : 'Folder picked but auto-write is paused'
                    }
                    on={autoSyncEnabled}
                    onToggle={() => setAutoSyncEnabled(!autoSyncEnabled)}
                  />
                  <Divider />
                  <NavRow
                    label="Sync now"
                    sub="Force-write the current backup to the folder"
                    onClick={handleSyncNow}
                  />
                  <Divider />
                  <NavRow
                    label="Restore from sync folder"
                    sub="Replace local data with the folder's backup (e.g. on a fresh device)"
                    onClick={handleRestoreFromSyncFolder}
                  />
                  <Divider />
                  <DangerRow
                    label="Disable auto-sync"
                    sub="Forgets the folder; existing backups stay where they are"
                    onClick={handleDisableSync}
                  />
                </>
              ) : (
                <NavRow
                  label="Pick a folder to auto-sync…"
                  sub="App writes a backup JSON on every change. Drop the folder in iCloud / Dropbox / OneDrive for free cross-device sync. No server, no account."
                  onClick={handlePickSyncFolder}
                />
              )}
            </Card>
          </>
        ) : (
          <>
            <SectionLabel>AUTO-SYNC</SectionLabel>
            <Card>
              <ReadOnlyRow
                label="Auto-sync"
                value="Chrome / Edge only"
              />
            </Card>
          </>
        )}
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

function formatRelativeAgo(epoch: number): string {
  const ageMs = Date.now() - epoch;
  const sec = Math.floor(ageMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
