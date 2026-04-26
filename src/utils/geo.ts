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

/** Resolve `var(--name)` CSS-var references to their literal value (for MapLibre paint props). */
export function resolveCssVar(value: string): string {
  if (!value.startsWith('var(')) return value;
  const match = value.match(/var\((--[\w-]+)\)/);
  if (!match) return value;
  if (typeof window === 'undefined') return value;
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || value;
}
