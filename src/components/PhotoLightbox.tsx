import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { loadPhotoUrl } from '../utils/photoStore';

interface PhotoLightboxProps {
  /** When non-null, the lightbox is open showing this photo. */
  photoId: string | null;
  caption?: string;
  /** Optional [lng, lat] shown beneath the caption as a mono coord line. */
  coord?: [number, number];
  /** Stamp shown alongside the coord ("0:14" relative or "APR 25"). */
  t?: string;
  onClose: () => void;
}

/**
 * Full-screen modal that hydrates a single photo from IndexedDB and shows
 * it center-fit on a black backdrop with caption + coord. Backdrop tap or
 * the close button dismisses; ESC also closes (desktop QA).
 *
 * Manages its own blob:URL lifecycle (revokes on close / id change) and
 * re-hydrates each open. Renders nothing when `photoId` is null so it can
 * live mounted at the page level without a perf hit.
 */
export function PhotoLightbox({ photoId, caption, coord, t, onClose }: PhotoLightboxProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoId) return;
    let cancelled = false;
    let createdUrl: string | null = null;
    loadPhotoUrl(photoId).then((u) => {
      if (cancelled) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      createdUrl = u;
      setUrl(u);
    });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      setUrl(null);
    };
  }, [photoId]);

  // ESC to dismiss (desktop QA).
  useEffect(() => {
    if (!photoId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photoId, onClose]);

  if (!photoId) return null;

  const coordStr = coord
    ? `${coord[1].toFixed(5)}° ${coord[1] >= 0 ? 'N' : 'S'} · ${Math.abs(coord[0]).toFixed(5)}° ${coord[0] >= 0 ? 'E' : 'W'}`
    : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.92)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
      }}
    >
      {/* Close button — top-right, always tappable */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close photo"
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          right: 12,
          width: 44,
          height: 44,
          borderRadius: 22,
          background: 'rgba(255, 255, 255, 0.12)',
          border: 'none',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          backdropFilter: 'blur(8px)',
          cursor: 'pointer',
        }}
      >
        <Icon name="close" size={20} color="#fff" />
      </button>

      {/* Image (or loading skeleton) */}
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', overflow: 'hidden', padding: 16 }}>
        {url ? (
          <img
            src={url}
            alt={caption ?? 'Waypoint photo'}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 8,
              cursor: 'default',
            }}
          />
        ) : (
          <div
            style={{
              width: 200,
              height: 200,
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'rgba(255, 255, 255, 0.4)',
              letterSpacing: '0.08em',
            }}
          >
            LOADING…
          </div>
        )}
      </div>

      {/* Caption + coord footer */}
      {(caption || coordStr) && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: '14px 20px calc(env(safe-area-inset-bottom, 0px) + 18px)',
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)',
            color: '#fff',
            cursor: 'default',
          }}
        >
          {caption && (
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500 }}>
              {caption}
            </div>
          )}
          {(coordStr || t) && (
            <div
              style={{
                marginTop: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'rgba(255, 255, 255, 0.7)',
                letterSpacing: '0.05em',
              }}
            >
              {[coordStr, t].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
