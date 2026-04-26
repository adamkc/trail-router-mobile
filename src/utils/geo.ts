/**
 * Project a 2D SVG-coord point (in the design's 412×600 viewBox) to a real
 * geographic [lng, lat] anchored at the Hayfork project area. Lets us reuse
 * the original trail shapes from the Figma reference while rendering as real
 * GeoJSON on top of MapLibre tiles.
 *
 * The Y axis flips (SVG goes down, latitude goes up) and the latitude span is
 * scaled by cos(lat) so a circle drawn in SVG looks roughly circular on the map.
 */

const SVG_VIEWBOX_W = 412;
const SVG_VIEWBOX_H = 600;

/** Real Hayfork project center — middle of the data bundle's hillshade bounds.
 *  (Earlier code used a stub coordinate; this is the actual Hayfork CA project area.) */
export const HAYFORK: [number, number] = [-123.0809, 40.7137];

/** Geographic bounds of the bundled hillshade tile. Matches public/data/hayfork-hillshade-bounds.json. */
export const HAYFORK_BOUNDS = {
  west: -123.1155,
  east: -123.0462,
  south: 40.6953,
  north: 40.732,
} as const;

export interface SvgToGeoOpts {
  /** [lng, lat] the SVG center maps to. */
  anchor?: [number, number];
  /** Longitude span (degrees) corresponding to the full viewBox width. */
  span?: number;
}

export function svgToGeo(
  svgPt: [number, number],
  { anchor = HAYFORK, span = 0.012 }: SvgToGeoOpts = {},
): [number, number] {
  const [x, y] = svgPt;
  const dx = (x - SVG_VIEWBOX_W / 2) / SVG_VIEWBOX_W;
  const dy = (y - SVG_VIEWBOX_H / 2) / SVG_VIEWBOX_H;
  const latSpan = (span * (SVG_VIEWBOX_H / SVG_VIEWBOX_W)) / Math.cos((anchor[1] * Math.PI) / 180);
  return [anchor[0] + dx * span, anchor[1] - dy * latSpan];
}

/** Convenience: project an array of SVG points. */
export function svgArrayToGeo(
  pts: Array<[number, number]>,
  opts?: SvgToGeoOpts,
): Array<[number, number]> {
  return pts.map((p) => svgToGeo(p, opts));
}

/** 1×1 canvas reused across calls to convert arbitrary CSS color strings to rgb(). */
let _colorCanvas: HTMLCanvasElement | null = null;
let _colorCtx: CanvasRenderingContext2D | null = null;
const _colorMemo = new Map<string, string>();

/**
 * Resolve `var(--name)` references AND normalize the result to a plain
 * `rgb(...)` / `rgba(...)` string. Browsers serialize design-token values
 * as `oklch(...)`, which MapLibre 4.x's paint validator rejects ("color
 * expected, oklch(...) found"). Canvas painting is the cheapest reliable
 * way to coerce any browser-accepted color (oklch, color(), named, hex,
 * var) into a legacy rgb form.
 */
export function resolveCssVar(value: string): string {
  if (typeof window === 'undefined') return value;
  const memo = _colorMemo.get(value);
  if (memo) return memo;

  // Step 1: dereference var(--token) via getComputedStyle.
  let resolved = value;
  if (value.startsWith('var(')) {
    const match = value.match(/var\((--[\w-]+)\)/);
    if (match) {
      const v = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
      if (v) resolved = v;
    }
  }
  // If already legacy-rgb, skip the canvas trip.
  if (/^rgba?\(/.test(resolved)) {
    _colorMemo.set(value, resolved);
    return resolved;
  }

  // Step 2: paint into a 1×1 canvas; the browser converts to sRGB display
  // space and we read the rgba pixel back as a legacy rgb() string.
  if (!_colorCanvas) {
    _colorCanvas = document.createElement('canvas');
    _colorCanvas.width = 1;
    _colorCanvas.height = 1;
    _colorCtx = _colorCanvas.getContext('2d');
  }
  if (!_colorCtx) {
    _colorMemo.set(value, resolved);
    return resolved;
  }
  try {
    _colorCtx.clearRect(0, 0, 1, 1);
    _colorCtx.fillStyle = resolved;
    _colorCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = _colorCtx.getImageData(0, 0, 1, 1).data;
    const rgb = a < 255 ? `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})` : `rgb(${r}, ${g}, ${b})`;
    _colorMemo.set(value, rgb);
    return rgb;
  } catch {
    _colorMemo.set(value, resolved);
    return resolved;
  }
}
