import { useEffect, useState } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

interface StatusBarProps {
  /** Override the auto-detected time (testing only). */
  time?: string;
}

const TICK_MS = 30_000; // re-render every 30s — minute precision is plenty.

function formatNow(): string {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Status bar that adapts to context:
 *  • Desktop demo (the framed Android-device preview) — renders the faux
 *    iPhone-style chrome (live clock + signal/wifi/battery glyphs) so the
 *    artboards still look like phone screens. Only the *clock* is real now.
 *  • Mobile (PWA / install) — collapses to a `safe-area-inset-top` spacer.
 *    The real OS status bar already paints the time + battery; rendering
 *    fake chrome on top would just be noise.
 */
export function StatusBar({ time }: StatusBarProps) {
  const isMobile = useIsMobile();
  const [now, setNow] = useState<string>(time ?? formatNow());

  useEffect(() => {
    if (time) return;
    const id = window.setInterval(() => setNow(formatNow()), TICK_MS);
    return () => window.clearInterval(id);
  }, [time]);

  // On a real phone, just reserve the safe-area inset so content doesn't slide
  // under the OS status bar. No fake clock / battery / wifi.
  if (isMobile) {
    return (
      <div
        style={{
          height: 'env(safe-area-inset-top, 0px)',
          flexShrink: 0,
          background: 'transparent',
        }}
      />
    );
  }

  // Desktop / framed-device preview — keep the bezel chrome but show real time.
  return (
    <div className="statusbar">
      <span>{now}</span>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 10,
          transform: 'translateX(-50%)',
          width: 20,
          height: 20,
          borderRadius: 100,
          background: '#0a0d07',
        }}
      />
      <div className="right">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 13.3L.67 5.97a10.37 10.37 0 0114.66 0L8 13.3z" fill="currentColor" />
        </svg>
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M14.67 14.67V1.33L1.33 14.67h13.34z" fill="currentColor" />
        </svg>
        <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">
          <rect x="0.5" y="0.5" width="18" height="11" rx="2" fill="none" stroke="currentColor" opacity="0.8" />
          <rect x="2" y="2" width="12" height="8" rx="1" fill="currentColor" />
          <rect x="19.5" y="4" width="1.5" height="4" rx="0.5" fill="currentColor" opacity="0.8" />
        </svg>
      </div>
    </div>
  );
}
