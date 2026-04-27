import { useEffect, useMemo } from 'react';
import type { GeoJSONSource } from 'maplibre-gl';
import { useMapInstance } from './MapCanvas';

interface TrailLabel {
  id: string;
  name: string;
  /** [lng, lat][] — only the midpoint is used as the anchor. */
  geo: Array<[number, number]>;
  /** Resolved label color (rgb()). */
  color: string;
}

interface MapTrailLabelsProps {
  trails: TrailLabel[];
  /** Hide labels below this zoom (the network is too dense to read). */
  minZoom?: number;
  /** Stable id namespace so multiple instances on one map don't clash. */
  id?: string;
}

/**
 * Trail-name labels rendered as a single MapLibre symbol layer instead of N
 * individual <Marker> divs. The native renderer's `text-allow-overlap=false`
 * + `text-padding` automatically hides labels that would collide with
 * higher-priority neighbors, and the layer is gated behind a zoom floor so
 * the network map stops looking like a wall of text at z11.
 *
 * Drop-in replacement for the per-trail <MapLabel> stamping that
 * NetworkMapScreen used to do.
 */
export function MapTrailLabels({ trails, minZoom = 12, id = 'trail-labels' }: MapTrailLabelsProps) {
  const { map, styleLoaded } = useMapInstance();
  const sourceId = `${id}-src`;
  const layerId = `${id}-layer`;

  const fc = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    const features: GeoJSON.Feature<GeoJSON.Point>[] = trails
      .filter((t) => t.geo.length >= 2)
      .map((t) => {
        const mid = t.geo[Math.floor(t.geo.length / 2)];
        return {
          type: 'Feature',
          properties: { name: t.name.toUpperCase(), color: t.color },
          geometry: { type: 'Point', coordinates: mid },
        };
      });
    return { type: 'FeatureCollection', features };
  }, [trails]);

  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: fc });
    }
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'symbol',
        source: sourceId,
        minzoom: minZoom,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          // Zoom-interpolated size: small at the floor, comfortable at z15+.
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            minZoom, 9,
            15, 11,
            18, 13,
          ],
          'text-letter-spacing': 0.06,
          'text-padding': 6,
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          // Place above the line; symbol-z-order=auto avoids upside-down text.
          'text-anchor': 'bottom',
          'text-offset': [0, -0.6],
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': '#0a0d07',
          'text-halo-width': 1.4,
          'text-halo-blur': 0.8,
        },
      });
    }
    return () => {
      if (!map || (map as unknown as { _removed?: boolean })._removed) return;
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // map already torn down
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleLoaded, sourceId, layerId, minZoom]);

  // Keep the source's data in sync with the latest trails (no re-add).
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const src = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (src) src.setData(fc);
  }, [map, styleLoaded, sourceId, fc]);

  return null;
}
