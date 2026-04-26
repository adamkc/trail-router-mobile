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
import { elevationGain, fetchElevations, resampleSpark } from './elevation';

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

/** Pick `n` evenly-spaced indices from a length, including first + last. */
function evenIndices(length: number, n: number): number[] {
  if (length <= n) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round(i * step));
}

/**
 * Expand a downsampled elevation array back to one value per `geo` vertex
 * via linear interpolation between sampled indices. Avoids the API trip
 * for every single vertex while still giving a smooth per-vertex profile
 * for the chart and grade analysis.
 */
function interpolateElevations(
  geoLen: number,
  sampleIdx: number[],
  sampled: number[],
): number[] {
  if (sampleIdx.length === 0 || sampled.length !== sampleIdx.length) return [];
  const out: number[] = new Array(geoLen);
  let segIdx = 0;
  for (let i = 0; i < geoLen; i++) {
    while (segIdx < sampleIdx.length - 1 && sampleIdx[segIdx + 1] < i) segIdx++;
    if (i <= sampleIdx[0]) {
      out[i] = sampled[0];
    } else if (i >= sampleIdx[sampleIdx.length - 1]) {
      out[i] = sampled[sampled.length - 1];
    } else {
      const a = sampleIdx[segIdx];
      const b = sampleIdx[segIdx + 1];
      const t = (i - a) / (b - a || 1);
      out[i] = Math.round(sampled[segIdx] * (1 - t) + sampled[segIdx + 1] * t);
    }
  }
  return out;
}

/**
 * Fetch real Open-Meteo elevations for every route in `routes` (mutates in
 * place). Each route is downsampled to ~80 vertices for the API trip then
 * expanded back to one elevation per geo vertex. Recomputes `spark` and
 * `gain` from the real profile. Silent on network failure — leaves the
 * synthesized stats in place.
 */
export async function backfillElevations(routes: LibraryRoute[]): Promise<number> {
  let successCount = 0;
  // Open-Meteo's free tier allows ~600 calls/min. We burn one call per route
  // (downsampled to ≤80 coords). A small inter-route delay keeps us well clear
  // of any per-IP burst throttling, and a single retry handles transient drops.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let routeIdx = 0; routeIdx < routes.length; routeIdx++) {
    const r = routes[routeIdx];
    if (r.geo.length < 2) continue;
    const idx = evenIndices(r.geo.length, Math.min(80, r.geo.length));
    const sampled = idx.map((i) => r.geo[i]);
    let elevs = await fetchElevations(sampled);
    if (!elevs || elevs.length !== sampled.length) {
      // One retry after a longer pause — covers brief 429/503 blips.
      await sleep(800);
      elevs = await fetchElevations(sampled);
    }
    if (!elevs || elevs.length !== sampled.length) continue;
    const full = interpolateElevations(r.geo.length, idx, elevs);
    r.elevations = full;
    r.spark = resampleSpark(full, 14);
    const realGain = elevationGain(full);
    if (realGain > 0) r.gain = `+${realGain}`;
    successCount += 1;
    if (routeIdx < routes.length - 1) await sleep(200);
  }
  return successCount;
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
      // Filled in by backfillElevations(routes) after parse — left empty
      // here so the loader stays sync-only and the network step is opt-in.
      elevations: [],
      // No waypoints in the editor's trails GeoJSON — leave empty.
      waypoints: [],
    });
  });
  return routes;
}
