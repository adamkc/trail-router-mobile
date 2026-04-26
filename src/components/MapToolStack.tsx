import { useEffect, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { useMapInstance } from './MapCanvas';
import { usePreferences } from '../store/preferences';

interface ToolDef {
  key: 'hill' | '3d' | 'north' | 'loc';
  icon: IconName;
  label: string;
}

const TOOLS: ToolDef[] = [
  { key: 'hill',  icon: 'layers',   label: 'HILL' },
  { key: '3d',    icon: 'mountain', label: '3D'   },
  { key: 'north', icon: 'compass',  label: 'N'    },
  { key: 'loc',   icon: 'target',   label: 'LOC'  },
];

const TILT_PITCH = 55;

interface MapToolStackProps {
  /** Distance from the top edge of the map container (px). */
  top?: number;
}

/**
 * Floating right-side tool stack that lives inside <MapCanvas>. Wires the
 * four header tools to real map state — hillshade toggle, 3D pitch, north
 * reset, and locate-on-map (geolocation).
 *
 * Lives inside MapCanvas so `useMapInstance()` resolves to the actual
 * MapLibre handle; safe to render on screens that fall back to the SVG
 * TopoMap (the buttons no-op when `map` is null).
 */
export function MapToolStack({ top = 76 }: MapToolStackProps) {
  const { map } = useMapInstance();
  const hillshadeOn = usePreferences((s) => s.hillshadeOn);
  const setHillshade = usePreferences((s) => s.setHillshade);
  const [pitched, setPitched] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [locating, setLocating] = useState(false);

  // Keep our `pitched` flag in sync with whatever the user does via touch
  // (two-finger drag) so the button reflects the actual map state.
  useEffect(() => {
    if (!map) return;
    const onPitch = () => setPitched(map.getPitch() > 5);
    const onRotate = () => setBearing(map.getBearing());
    map.on('pitch', onPitch);
    map.on('rotate', onRotate);
    return () => {
      map.off('pitch', onPitch);
      map.off('rotate', onRotate);
    };
  }, [map]);

  const togglePitch = () => {
    if (!map) return;
    const next = pitched ? 0 : TILT_PITCH;
    map.easeTo({ pitch: next, duration: 600 });
  };
  const resetNorth = () => {
    if (!map) return;
    map.easeTo({ bearing: 0, pitch: 0, duration: 600 });
  };
  const locate = () => {
    if (!map) return;
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16, duration: 700 });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const isActive = (k: ToolDef['key']) => {
    if (k === 'hill')  return hillshadeOn;
    if (k === '3d')    return pitched;
    if (k === 'north') return Math.abs(bearing) > 5;
    if (k === 'loc')   return locating;
    return false;
  };
  const handler = (k: ToolDef['key']) => {
    if (k === 'hill')  setHillshade(!hillshadeOn);
    else if (k === '3d')    togglePitch();
    else if (k === 'north') resetNorth();
    else if (k === 'loc')   locate();
  };
  const labelFor = (t: ToolDef): string => {
    if (t.key === 'north' && Math.abs(bearing) > 5) return Math.round(bearing).toString() + '°';
    return t.label;
  };

  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        top,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 4,
      }}
    >
      {TOOLS.map((t) => {
        const active = isActive(t.key);
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => handler(t.key)}
            aria-label={t.label}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: active
                ? 'color-mix(in oklch, var(--blaze) 22%, var(--surface))'
                : 'color-mix(in oklch, var(--surface) 90%, transparent)',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${active ? 'color-mix(in oklch, var(--blaze) 50%, transparent)' : 'var(--line-soft)'}`,
              display: 'grid',
              placeItems: 'center',
              position: 'relative',
              padding: 0,
              color: 'var(--bone)',
            }}
          >
            <Icon name={t.icon} size={18} color={active ? 'var(--blaze)' : 'var(--bone)'} />
            <div
              style={{
                position: 'absolute',
                bottom: 3,
                right: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                color: active ? 'var(--blaze)' : 'var(--moss)',
                letterSpacing: '0.04em',
              }}
            >
              {labelFor(t)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
