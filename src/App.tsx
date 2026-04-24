import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { DesignCanvas } from './components/DesignCanvas';
import { AndroidDevice } from './components/AndroidDevice';
import { SCREENS } from './screens/registry';
import { useIsMobile } from './hooks/useIsMobile';

function ScreenFrame({ entry }: { entry: (typeof SCREENS)[number] }) {
  const { label, width, height, Component } = entry;
  const isMobile = useIsMobile();

  // On a real phone, strip the bezel/label chrome and let the screen fill the viewport.
  if (isMobile) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          width: '100vw',
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Component />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--page-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 20px 80px',
        gap: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          width: '100%',
          maxWidth: width,
        }}
      >
        <Link
          to="/"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            color: 'var(--bone-dim)',
            textTransform: 'uppercase',
          }}
        >
          ← Canvas
        </Link>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            color: 'var(--moss)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </div>
      <AndroidDevice width={width} height={height}>
        <Component />
      </AndroidDevice>
    </div>
  );
}

function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--page-bg)',
        color: 'var(--bone)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
        fontFamily: 'var(--font-display)',
      }}
    >
      <div>Screen not found.</div>
      <Link
        to="/"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--blaze)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        ← Back to canvas
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<DesignCanvas />} />
        {SCREENS.map((entry) => (
          <Route key={entry.id} path={entry.path} element={<ScreenFrame entry={entry} />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </HashRouter>
  );
}
