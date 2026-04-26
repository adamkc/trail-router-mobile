import { useEffect, useMemo } from 'react';
import type { GeoJSONSource } from 'maplibre-gl';
import { useMapInstance } from './MapCanvas';
import { haversineKm } from '../store/recording';
import { resolveCssVar } from '../utils/geo';

interface MapGradeLineProps {
  /** Stable id used to namespace the source + layer. */
  id: string;
  coords: Array<[number, number]>;
  elevations: number[];
  width?: number;
  /** Render glow underlay; off by default — grade colors look busier than the
   *  uniform-color tail and the glow tends to muddy the bucket boundaries. */
  glow?: boolean;
}

/** Map a percent grade (signed; negative = descending) to a stop color. */
function gradeColor(pct: number): string {
  const abs = Math.abs(pct);
  if (abs < 5)   return resolveCssVar('var(--good)');   // 0-5 % easy
  if (abs < 10)  return resolveCssVar('var(--topo)');   // 5-10 % moderate
  if (abs < 15)  return resolveCssVar('var(--warn)');   // 10-15 % hard
  return resolveCssVar('var(--danger)');                // 15+ % severe
}

/**
 * Render a route as multiple short LineString features, one per geo segment,
 * each colored by its computed grade (rise/run × 100 %). The legend bucket
 * boundaries match the optimizer thresholds (5, 10, 15 %) so the overlay
 * doubles as a "where would the optimizer flag this trail" hint.
 *
 * Renders nothing when fewer than 2 elevations are available (legacy/seed
 * routes); caller should fall back to a uniform-color MapGeoLine in that
 * case.
 */
export function MapGradeLine({ id, coords, elevations, width = 4, glow = false }: MapGradeLineProps) {
  const { map, styleLoaded } = useMapInstance();
  const sourceId = `grade-${id}`;
  const layerId = `grade-${id}-line`;
  const glowLayerId = `grade-${id}-glow`;

  const fc = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(() => {
    if (coords.length < 2 || elevations.length !== coords.length) {
      return { type: 'FeatureCollection', features: [] };
    }
    const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    for (let i = 0; i < coords.length - 1; i++) {
      const distM = haversineKm(coords[i], coords[i + 1]) * 1000;
      const dE = elevations[i + 1] - elevations[i];
      const grade = distM > 0 ? (dE / distM) * 100 : 0;
      features.push({
        type: 'Feature',
        properties: { grade, color: gradeColor(grade) },
        geometry: { type: 'LineString', coordinates: [coords[i], coords[i + 1]] },
      });
    }
    return { type: 'FeatureCollection', features };
  }, [coords, elevations]);

  useEffect(() => {
    if (!map || !styleLoaded) return;
    if (fc.features.length === 0) return;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: fc });
    }
    if (glow && !map.getLayer(glowLayerId)) {
      map.addLayer({
        id: glowLayerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': width + 4,
          'line-opacity': 0.18,
          'line-blur': 1,
        },
      });
    }
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': width,
        },
      });
    }
    return () => {
      if (!map || (map as unknown as { _removed?: boolean })._removed) return;
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getLayer(glowLayerId)) map.removeLayer(glowLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // Map already torn down.
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleLoaded, sourceId, layerId, glowLayerId, glow, width]);

  // Update source data when coords/elevations change (e.g. live recording).
  useEffect(() => {
    if (!map || !styleLoaded) return;
    const src = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (src) src.setData(fc);
  }, [map, styleLoaded, sourceId, fc]);

  return null;
}
