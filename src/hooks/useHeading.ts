import { useCallback, useEffect, useState } from 'react';

interface HeadingState {
  /** Compass bearing in degrees (0–360, 0 = north). null when no fix yet. */
  heading: number | null;
  /** True when DeviceOrientationEvent is supported by the browser. */
  available: boolean;
  /** True on iOS 13+ when explicit permission is required. */
  needsPermission: boolean;
  /** Trigger the iOS permission prompt; no-op elsewhere. */
  requestPermission: () => Promise<void>;
}

interface IosOrientationCtor {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
}

interface AbsoluteOrientationEvent extends DeviceOrientationEvent {
  /** iOS-only: 0 = north, increases clockwise. */
  webkitCompassHeading?: number;
}

const computeHeading = (e: DeviceOrientationEvent): number | null => {
  const ev = e as AbsoluteOrientationEvent;
  if (typeof ev.webkitCompassHeading === 'number') return ev.webkitCompassHeading;
  if (typeof e.alpha === 'number') return (360 - e.alpha) % 360;
  return null;
};

/**
 * React hook around DeviceOrientationEvent → compass heading.
 *
 * iOS 13+ requires a one-time permission grant via a user gesture; we surface
 * `needsPermission` + `requestPermission()` for the caller to wire to a button.
 * On Android (and desktop browsers that ship the API) the listener is attached
 * automatically and `heading` updates as the device rotates.
 */
export function useHeading(): HeadingState {
  const [heading, setHeading] = useState<number | null>(null);
  const [available, setAvailable] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
    setAvailable(true);
    const ctor = window.DeviceOrientationEvent as unknown as IosOrientationCtor;
    if (typeof ctor.requestPermission === 'function') {
      // iOS path — wait for explicit grant via requestPermission().
      setNeedsPermission(true);
      return;
    }
    setGranted(true);
  }, []);

  useEffect(() => {
    if (!granted) return;
    const handler = (e: DeviceOrientationEvent) => {
      const h = computeHeading(e);
      if (h !== null) setHeading(h);
    };
    // `deviceorientationabsolute` is preferred on Chrome/Android; some browsers
    // only emit `deviceorientation`. Listening to both covers the spread.
    window.addEventListener('deviceorientationabsolute', handler as EventListener, true);
    window.addEventListener('deviceorientation', handler, true);
    return () => {
      window.removeEventListener('deviceorientationabsolute', handler as EventListener, true);
      window.removeEventListener('deviceorientation', handler, true);
    };
  }, [granted]);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const ctor = window.DeviceOrientationEvent as unknown as IosOrientationCtor;
    if (typeof ctor.requestPermission !== 'function') {
      setGranted(true);
      return;
    }
    try {
      const result = await ctor.requestPermission();
      if (result === 'granted') {
        setGranted(true);
        setNeedsPermission(false);
      }
    } catch {
      // user denied or no user gesture — leave needsPermission true so the
      // button stays available for retry
    }
  }, []);

  return { heading, available, needsPermission, requestPermission };
}
