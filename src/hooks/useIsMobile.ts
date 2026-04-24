import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 480px)';

/**
 * Returns true when the viewport is a phone-sized window.
 * Reactive to resize and orientation change, SSR-safe (starts false on the server).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mql.matches);
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isMobile;
}
