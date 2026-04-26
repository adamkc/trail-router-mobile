import { useIsMobile } from '../hooks/useIsMobile';

/**
 * Faux Android gesture-nav pill.
 *
 * Useful only inside the desktop-framed-device preview so the artboards keep
 * the "this is a phone screen" silhouette. On a real phone the OS already
 * draws the real gesture bar — rendering a fake one wastes 22 px and looks
 * like crud sitting on top of the actual handle. Reserve the safe-area
 * inset instead so content respects the home-indicator zone.
 */
export function NavPill() {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <div
        style={{
          height: 'env(safe-area-inset-bottom, 0px)',
          flexShrink: 0,
          background: 'transparent',
        }}
      />
    );
  }
  return (
    <div className="navpill">
      <div className="pill" />
    </div>
  );
}
