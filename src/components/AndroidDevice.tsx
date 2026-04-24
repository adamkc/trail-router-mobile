import type { CSSProperties, ReactNode } from 'react';

interface AndroidDeviceProps {
  children: ReactNode;
  width?: number;
  height?: number;
  /** Use dark chrome — trail router is dark-only. */
  dark?: boolean;
  /** Wrapper style override (e.g. to drop the outer shadow in embedded contexts). */
  style?: CSSProperties;
}

const FRAME_BORDER = 'rgba(116,119,117,0.5)';

/**
 * Material 3 device frame. Renders only the outer bezel + bottom gesture bar.
 * The screen inside is expected to render its own custom status bar + nav pill.
 */
export function AndroidDevice({ children, width = 392, height = 820, dark = true, style }: AndroidDeviceProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 18,
        overflow: 'hidden',
        background: dark ? '#1d1b20' : '#f4fbf8',
        border: `8px solid ${FRAME_BORDER}`,
        boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>{children}</div>
    </div>
  );
}
