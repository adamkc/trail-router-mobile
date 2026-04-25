import { useEffect } from 'react';
import type { GeoJSONSource, LineLayerSpecification } from 'maplibre-gl';
import { useMapInstance } from './MapCanvas';

interface MapGeoLineProps {
  /** Stable id used to namespace the source + layer (one per logical trail). */
  id: string;
  /** [lng, lat][] — points in geographic coordinates. */
  coords: Array<[number, number]>;
  color?: string;
  width?: number;
  /** Render as a dashed line (proposed/draft styling). */
  dashed?: boolean;
  /** Glow underlay (matches the SVG TrailLine aesthetic). */
  glow?: boolean;
  /** When true, layer renders above all others (active trail). */
  onTop?: boolean;
}

/**
 * Adds a GeoJSON line layer to the parent <MapCanvas>'s MapLibre instance.
 * The line is geo-anchored — pans/zooms with the map naturally.
 *
 * Lifecycle: source + layer are added when the map's style is loaded;
 * `coords` updates re-set the source data without recreating layers; the
 * layer is removed on unmount.
 */
export function MapGeoLine({
  id,
  coords,
  color = '#E88A3C',
  width = 4,
  dashed = false,
  glow = true,
  onTop = false,
}: MapGeoLineProps) {
  const { map, styleLoaded } = useMapInstance();
  const sourceId = `geo-${id}`;
  const lineLayerId = `geo-${id}-line`;
  const glowLayerId = `geo-${id}-glow`;

  // 1) On mount (and whenever the map/style becomes available), add source + layers.
  useEffect(() => {
    if (!map || !styleLoaded) return;

    const data: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    };

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data });
    }

    const linePaint: LineLayerSpecification['paint'] = {
      'line-color': color,
      'line-width': width,
      ...(dashed ? { 'line-dasharray': [2, 2] } : {}),
    };

    if (glow && !map.getLayer(glowLayerId)) {
      map.addLayer({
        id: glowLayerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': color,
          'line-width': width + 5,
          'line-opacity': 0.18,
          'line-blur': 1,
        },
      });
    }
    if (!map.getLayer(lineLayerId)) {
      map.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: linePaint,
      });
    }
    if (onTop && map.getLayer(lineLayerId)) {
      map.moveLayer(lineLayerId);
      if (map.getLayer(glowLayerId)) map.moveLayer(glowLayerId, lineLayerId);
    }

    return () => {
      if (!map || (map as unknown as { _removed?: boolean })._removed) return;
      try {
        if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
        if (map.getLayer(glowLayerId)) map.removeLayer(glowLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // Map already torn down — safe to ignore.
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleLoaded, sourceId, lineLayerId, glowLayerId]);

  // 2) On coords / paint changes, update the existing source + layer paint instead of recreating.
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const src = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      });
    }
    if (map.getLayer(lineLayerId)) {
      map.setPaintProperty(lineLayerId, 'line-color', color);
      map.setPaintProperty(lineLayerId, 'line-width', width);
    }
    if (map.getLayer(glowLayerId)) {
      map.setPaintProperty(glowLayerId, 'line-color', color);
      map.setPaintProperty(glowLayerId, 'line-width', width + 5);
    }
  }, [map, styleLoaded, coords, color, width, sourceId, lineLayerId, glowLayerId]);

  return null;
}
