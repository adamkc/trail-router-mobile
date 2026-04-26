import { useEffect, useState } from 'react';
import { loadPhotoUrl } from '../utils/photoStore';

interface WaypointPhotoProps {
  photoId: string;
  /** Square edge in px. */
  size?: number;
  /** When true, renders a wider 16:9 thumbnail instead of a square. */
  wide?: boolean;
  alt?: string;
  onClick?: () => void;
}

/**
 * Lazy-loads a waypoint's photo from IndexedDB and renders it as a tiny
 * thumbnail. Manages its own blob: URL lifecycle (revokes on unmount).
 *
 * Renders an empty placeholder div while the blob loads, then swaps in the
 * <img> once available. If the photo id is missing or the blob can't be
 * found (e.g. user cleared site data), renders nothing — caller's layout
 * shouldn't depend on the photo being present.
 */
export function WaypointPhoto({ photoId, size = 56, wide = false, alt, onClick }: WaypointPhotoProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    loadPhotoUrl(photoId).then((u) => {
      if (cancelled) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      if (!u) setMissing(true);
      else {
        createdUrl = u;
        setUrl(u);
      }
    });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [photoId]);

  if (missing) return null;

  const w = wide ? Math.round(size * (16 / 9)) : size;
  const h = size;
  const sharedStyle: React.CSSProperties = {
    width: w,
    height: h,
    borderRadius: 8,
    background: 'var(--surface-2)',
    border: '1px solid var(--line-soft)',
    overflow: 'hidden',
    display: 'block',
    flexShrink: 0,
  };

  if (!url) return <div style={sharedStyle} aria-hidden="true" />;

  const img = (
    <img
      src={url}
      alt={alt ?? 'Waypoint photo'}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
  return onClick ? (
    <button type="button" onClick={onClick} style={{ ...sharedStyle, padding: 0, cursor: 'pointer' }}>
      {img}
    </button>
  ) : (
    <div style={sharedStyle}>{img}</div>
  );
}
