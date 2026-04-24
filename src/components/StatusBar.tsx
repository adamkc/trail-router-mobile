interface StatusBarProps {
  time?: string;
}

/** Custom trail-router status bar (mono font, dark theme, punch-hole camera). */
export function StatusBar({ time = '9:41' }: StatusBarProps) {
  return (
    <div className="statusbar">
      <span>{time}</span>
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
        <svg width="14" height="14" viewBox="0 0 16 16">
          <path d="M8 13.3L.67 5.97a10.37 10.37 0 0114.66 0L8 13.3z" fill="currentColor" />
        </svg>
        <svg width="14" height="14" viewBox="0 0 16 16">
          <path d="M14.67 14.67V1.33L1.33 14.67h13.34z" fill="currentColor" />
        </svg>
        <svg width="22" height="12" viewBox="0 0 22 12">
          <rect x="0.5" y="0.5" width="18" height="11" rx="2" fill="none" stroke="currentColor" opacity="0.8" />
          <rect x="2" y="2" width="12" height="8" rx="1" fill="currentColor" />
          <rect x="19.5" y="4" width="1.5" height="4" rx="0.5" fill="currentColor" opacity="0.8" />
        </svg>
      </div>
    </div>
  );
}
