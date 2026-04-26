import { useEffect } from 'react';
import { useMapInstance } from './MapCanvas';
import { HAYFORK_BOUNDS } from '../utils/geo';

interface MapHillshadeProps {
  /** When false, the layer is hidden (kept around so toggling is instant). */
  enabled?: boolean;
  /** 0..1 — defaults to a gentle 0.55 so it tints rather than dominates the basemap. */
  opacity?: number;
}

const SOURCE_ID = 'hayfork-hillshade';
const LAYER_ID = 'hayfork-hillshade-layer';

/**
 * Adds the bundled pre-rendered Hayfork hillshade PNG to the parent map as
 * an `image` source clipped to its known geographic bounds. The image was
 * exported from the desktop trail-route-editor and stitched from SRTM 1-arc-sec
 * DEM, so it lines up naturally with the editor's GeoJSON trails.
 */
export function MapHillshade({ enabled = true, opacity = 0.55 }: MapHillshadeProps) {
  const { map, styleLoaded } = useMapInstance();

  // Add the source + layer once the style is loaded.
  useEffect(() => {
    if (!map || !styleLoaded) return;

    const url = `${import.meta.env.BASE_URL ?? '/'}data/hayfork-hillshade.png`;
    const { west, east, south, north } = HAYFORK_BOUNDS;
    // image source coords are [TL, TR, BR, BL] — clockwise from the top-left.
    const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ];

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'image', url, coordinates });
    }
    if (!map.getLayer(LAYER_ID)) {
      map.addLayer(
        {
          id: LAYER_ID,
          type: 'raster',
          source: SOURCE_ID,
          paint: {
            'raster-opacity': enabled ? opacity : 0,
            'raster-fade-duration': 200,
          },
        },
        // Insert below any GeoJSON line layers we add later so trails render on top.
        // If no such layers exist yet, MapLibre simply appends to the top.
        undefined,
      );
    }

    return () => {
      if (!map || (map as unknown as { _removed?: boolean })._removed) return;
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        // map already torn down
      }
    };
  }, [map, styleLoaded]);

  // React to opacity / enabled changes by mutating paint property in place.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (!map.getLayer(LAYER_ID)) return;
    map.setPaintProperty(LAYER_ID, 'raster-opacity', enabled ? opacity : 0);
  }, [map, styleLoaded, enabled, opacity]);

  return null;
}
