import { StatusBar } from '../components/StatusBar';
import { NavPill } from '../components/NavPill';

interface ScreenShellProps {
  label: string;
}

/** Placeholder screen — renders the status bar + centered label + nav pill. */
export function ScreenShell({ label }: ScreenShellProps) {
  return (
    <div className="screen">
      <StatusBar />
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div className="eyebrow">NOT YET IMPLEMENTED</div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 500,
            color: 'var(--bone)',
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--moss)',
            letterSpacing: '0.08em',
          }}
        >
          WIP · SCAFFOLD ONLY
        </div>
      </div>
      <NavPill />
    </div>
  );
}
