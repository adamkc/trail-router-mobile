/**
 * Loader for the bundled Hayfork project data (the GeoJSON + hillshade
 * exported from the desktop trail-route-editor, parked in public/data/).
 *
 * Fetched at runtime instead of imported as a JS module so the 124 KB
 * GeoJSON doesn't bloat the main bundle and so the service worker can
 * cache it as a static asset.
 */

import type { LibraryRoute, RouteStatus } from '../store/library';
import type { ChipTone } from '../components/Chip';
import { resampleSpark } from './elevation';

interface EditorTrailFeature {
  type: 'Feature';
  properties: {
    Id?: number;
    Name?: string;
    UserGroup?: string;
    length_m?: number;
    elev_min_m?: number;
    elev_max_m?: number;
    elev_gain_m?: number;
    elev_loss_m?: number;
    avg_grade_pct?: number;
    max_grade_pct?: number;
    pct_over_8?: number;
    pct_over_12?: number;
  };
  geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
}

interface EditorTrailCollection {
  type: 'FeatureCollection';
  features: EditorTrailFeature[];
}

/**
 * Map the editor's per-segment metadata onto our library's route fields.
 * The editor classifies trails by `UserGroup` (e.g. "Access Rd",
 * "Singletrack", "Doubletrack") rather than the app's status flags, so
 * we infer status + tag from grade severity instead.
 */
function statusForFeature(props: EditorTrailFeature['properties']): { status: RouteStatus; tag: ChipTone | null } {
  const max = props.max_grade_pct ?? 0;
  const userGroup = (props.UserGroup ?? '').toLowerCase();
  // Built/access roads → "built"
  if (userGroup.includes('access') || userGroup.includes('road')) return { status: 'built', tag: 'good' };
  // Steep singletracks (>15% max) → "review" so they stand out as needing
  // attention in the optimizer
  if (max > 15) return { status: 'review', tag: 'warn' };
  // Anything with a survey-ish vibe → "draft"
  if (userGroup.includes('survey') || userGroup.includes('proposed')) return { status: 'draft', tag: null };
  // Otherwise it's a working built trail
  return { status: 'built', tag: 'good' };
}

/**
 * Synthesize a 14-point elevation spark from the feature's elev_min/max +
 * gain/loss. We don't have the actual elevation profile per vertex in the
 * editor's GeoJSON — only the per-segment summary stats — so this is a
 * shaped curve that respects the climb/descent ratio.
 */
function syntheticSparkForFeature(props: EditorTrailFeature['properties']): number[] {
  const min = props.elev_min_m ?? 420;
  const max = props.elev_max_m ?? min + 60;
  const gain = props.elev_gain_m ?? 0;
  const loss = props.elev_loss_m ?? 0;
  const total = gain + loss || 1;
  const climbFrac = gain / total;
  // Build a curve that climbs for `climbFrac` of the length, then descends.
  const n = 14;
  const peakIdx = Math.max(1, Math.min(n - 2, Math.round(climbFrac * (n - 1))));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i <= peakIdx) {
      out.push(Math.round(min + ((max - min) * i) / peakIdx));
    } else {
      const t = (i - peakIdx) / (n - 1 - peakIdx);
      out.push(Math.round(max - (max - min) * t));
    }
  }
  return resampleSpark(out, n);
}

function slugifyId(name: string, idx: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `trail-${idx}`;
  return `hayfork-${slug}`;
}

export async function loadHayforkProject(): Promise<LibraryRoute[]> {
  const res = await fetch(`${import.meta.env.BASE_URL ?? '/'}data/hayfork-trails.geojson`);
  if (!res.ok) throw new Error(`Failed to load Hayfork data: HTTP ${res.status}`);
  const json = (await res.json()) as EditorTrailCollection;
  if (json.type !== 'FeatureCollection' || !Array.isArray(json.features)) {
    throw new Error('Hayfork data is not a FeatureCollection');
  }

  const routes: LibraryRoute[] = [];
  json.features.forEach((f, i) => {
    if (f.geometry?.type !== 'LineString') return;
    const coords = f.geometry.coordinates.filter(
      (c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]),
    ) as Array<[number, number]>;
    if (coords.length < 2) return;
    const props = f.properties ?? {};
    const name = (props.Name ?? `Trail ${i + 1}`).trim();
    const { status, tag } = statusForFeature(props);
    const lengthKm = ((props.length_m ?? 0) / 1000).toFixed(1);
    const gain = `+${Math.round(props.elev_gain_m ?? 0)}`;
    const grade = (props.avg_grade_pct ?? 0).toFixed(1);
    routes.push({
      id: slugifyId(name, i),
      name,
      km: lengthKm,
      gain,
      grade,
      status,
      tag,
      spark: syntheticSparkForFeature(props),
      geo: coords,
      // No waypoints in the editor's trails GeoJSON — leave empty.
      waypoints: [],
    });
  });
  return routes;
}
