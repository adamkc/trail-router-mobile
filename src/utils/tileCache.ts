/**
 * Pre-cache map tiles for a project's bounding box so the user can pan/zoom
 * the area offline. Workbox runtime caching (configured in vite.config.ts)
 * stores anything fetched from the Carto basemaps host; this util just
 * walks the slippy-tile grid for the bounds at chosen zooms and `fetch()`es
 * each one — the service worker writes them into the runtime cache as a
 * side effect.
 *
 * Style/source discovery: we fetch the same MapLibre style URL used by
 * MapCanvas, then walk every source's `tiles` template list (or fetch its
 * TileJSON `url` when no inline `tiles` exist). That covers vector + raster
 * sources without hardcoding host patterns.
 */

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface DiscoveredSource {
  tiles: string[];
  minzoom: number;
  maxzoom: number;
}

interface MlStyleSource {
  type: string;
  tiles?: string[];
  url?: string;
  minzoom?: number;
  maxzoom?: number;
}

interface MlStyle {
  sources: Record<string, MlStyleSource>;
}

interface TileJson {
  tiles?: string[];
  minzoom?: number;
  maxzoom?: number;
}

let _sourcesPromise: Promise<DiscoveredSource[]> | null = null;
async function discoverSources(): Promise<DiscoveredSource[]> {
  if (_sourcesPromise) return _sourcesPromise;
  _sourcesPromise = (async () => {
    const res = await fetch(STYLE_URL);
    if (!res.ok) throw new Error(`style.json HTTP ${res.status}`);
    const style = (await res.json()) as MlStyle;
    const out: DiscoveredSource[] = [];
    for (const key of Object.keys(style.sources ?? {})) {
      const s = style.sources[key];
      const minzoom = s.minzoom ?? 0;
      const maxzoom = s.maxzoom ?? 22;
      if (Array.isArray(s.tiles)) {
        out.push({ tiles: s.tiles, minzoom, maxzoom });
      } else if (s.url) {
        try {
          const tj = (await (await fetch(s.url)).json()) as TileJson;
          if (Array.isArray(tj.tiles)) {
            out.push({
              tiles: tj.tiles,
              minzoom: tj.minzoom ?? minzoom,
              maxzoom: tj.maxzoom ?? maxzoom,
            });
          }
        } catch {
          // Skip broken/private tilejson URLs.
        }
      }
    }
    return out;
  })();
  return _sourcesPromise;
}

/** Standard slippy-tile lng/lat → (x, y) at zoom z. */
function lonLatToTile(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

interface BoundsBox {
  west: number;
  east: number;
  south: number;
  north: number;
}

function tilesInBounds(b: BoundsBox, z: number): Array<{ z: number; x: number; y: number }> {
  const tl = lonLatToTile(b.west, b.north, z);
  const br = lonLatToTile(b.east, b.south, z);
  const out: Array<{ z: number; x: number; y: number }> = [];
  // Clamp to valid tile range; clamps protect against bad bounds.
  const maxIdx = 2 ** z - 1;
  const xMin = Math.max(0, Math.min(tl.x, br.x));
  const xMax = Math.min(maxIdx, Math.max(tl.x, br.x));
  const yMin = Math.max(0, Math.min(tl.y, br.y));
  const yMax = Math.min(maxIdx, Math.max(tl.y, br.y));
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      out.push({ z, x, y });
    }
  }
  return out;
}

/** Estimate how many tiles a precache job will touch. */
export async function estimateTileCount(bounds: BoundsBox, zooms: number[]): Promise<number> {
  const sources = await discoverSources();
  let total = 0;
  for (const z of zooms) {
    const inBox = tilesInBounds(bounds, z);
    for (const s of sources) {
      if (z < s.minzoom || z > s.maxzoom) continue;
      total += inBox.length * s.tiles.length;
    }
  }
  return total;
}

export interface PrecacheProgress {
  done: number;
  total: number;
  ok: number;
  failed: number;
}

/**
 * Walk the bounds at each requested zoom and fetch every tile, with light
 * concurrency. The browser SW (workbox CacheFirst rule for the basemap
 * host) writes each response into the offline cache. Returns a summary.
 */
export async function precacheBounds(
  bounds: BoundsBox,
  zooms: number[],
  onProgress?: (p: PrecacheProgress) => void,
  signal?: AbortSignal,
): Promise<PrecacheProgress> {
  const sources = await discoverSources();
  const queue: string[] = [];
  for (const z of zooms) {
    const inBox = tilesInBounds(bounds, z);
    for (const s of sources) {
      if (z < s.minzoom || z > s.maxzoom) continue;
      for (const tmpl of s.tiles) {
        for (const t of inBox) {
          // {r} is a retina-density placeholder Carto allows; render the
          // 1× variant for cache size, which is what most phones display
          // anyway after MapLibre's symbol scaling.
          const url = tmpl
            .replace('{z}', String(t.z))
            .replace('{x}', String(t.x))
            .replace('{y}', String(t.y))
            .replace(/\{r\}/g, '');
          queue.push(url);
        }
      }
    }
  }

  const total = queue.length;
  const progress: PrecacheProgress = { done: 0, total, ok: 0, failed: 0 };
  const tick = () => onProgress?.({ ...progress });
  tick();

  const CONCURRENCY = 4;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      if (signal?.aborted) return;
      const url = queue.shift();
      if (!url) return;
      try {
        const res = await fetch(url, { signal });
        if (res.ok) progress.ok++;
        else progress.failed++;
      } catch {
        progress.failed++;
      }
      progress.done++;
      // Coalesce updates to ~one per tile; cheap enough at 4 workers.
      tick();
    }
  });
  await Promise.all(workers);
  return progress;
}
