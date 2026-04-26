/**
 * Elevation backfill via Open-Meteo's free elevation API.
 *
 * No API key required, ~1 KB per request, returns 90m SRTM-derived elevation
 * for any [lat, lng] pair. We use it when a recording lands without altitude
 * (most browsers don't return GPS altitude over the web) and when a plotted
 * route has no elevation at all (sketched on a map, no GPS context).
 *
 * Docs: https://open-meteo.com/en/docs/elevation-api
 *
 * The endpoint accepts up to 100 coords per request. Larger inputs are
 * batched. Returns null on any network/API error so callers can fall back
 * to a synthetic ramp without crashing.
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/elevation';
const MAX_PER_REQUEST = 100;

export async function fetchElevations(coords: Array<[number, number]>): Promise<number[] | null> {
  if (coords.length === 0) return [];
  try {
    const all: number[] = [];
    for (let offset = 0; offset < coords.length; offset += MAX_PER_REQUEST) {
      const batch = coords.slice(offset, offset + MAX_PER_REQUEST);
      const lats = batch.map((c) => c[1].toFixed(6)).join(',');
      const lngs = batch.map((c) => c[0].toFixed(6)).join(',');
      const url = `${ENDPOINT}?latitude=${lats}&longitude=${lngs}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = (await res.json()) as { elevation?: number[] };
      if (!Array.isArray(json.elevation) || json.elevation.length !== batch.length) return null;
      all.push(...json.elevation);
    }
    return all.map((e) => Math.round(e));
  } catch {
    return null;
  }
}

/** Sum positive elevation deltas across the array (climb-only meters). */
export function elevationGain(elevs: number[]): number {
  let gain = 0;
  for (let i = 1; i < elevs.length; i++) {
    const d = elevs[i] - elevs[i - 1];
    if (d > 0) gain += d;
  }
  return Math.round(gain);
}

/** Resample an elevation array to N evenly-spaced points (for the spark chart). */
export function resampleSpark(elevs: number[], n = 12): number[] {
  if (elevs.length === 0) return [];
  if (elevs.length <= n) return elevs.slice();
  const step = (elevs.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => elevs[Math.round(i * step)]);
}
