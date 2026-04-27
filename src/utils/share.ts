/**
 * Share helper. Uses the Web Share API on devices that support it (any
 * modern Android/iOS browser) so the user gets the OS share sheet —
 * Messages / Email / Chat / etc. Falls back to copying the URL to the
 * clipboard on desktop. Returns the action taken so the caller can
 * surface a toast.
 */

export interface ShareResult {
  /** What actually happened — drives the user-visible feedback. */
  action: 'shared' | 'copied' | 'error' | 'cancelled';
  message: string;
}

interface ShareOptions {
  title?: string;
  text?: string;
  url: string;
}

export async function shareOrCopy(opts: ShareOptions): Promise<ShareResult> {
  // The DOM lib's Navigator already types `share` and `canShare` as
  // optional, but they're not declared on every TS lib version we may
  // ship against. Cast to a permissive shape and feature-detect.
  const nav = navigator as Navigator & {
    share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    canShare?: (data: { title?: string; text?: string; url?: string }) => boolean;
  };
  // Try the Web Share API first.
  if (typeof nav.share === 'function') {
    const payload = { title: opts.title, text: opts.text, url: opts.url };
    if (!nav.canShare || nav.canShare(payload)) {
      try {
        await nav.share(payload);
        return { action: 'shared', message: 'Shared' };
      } catch (e) {
        // AbortError = user cancelled; anything else is a real failure.
        const name = (e as { name?: string })?.name;
        if (name === 'AbortError') {
          return { action: 'cancelled', message: 'Share cancelled' };
        }
        // Fall through to clipboard on other errors.
      }
    }
  }
  // Clipboard fallback.
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(opts.url);
      return { action: 'copied', message: 'Link copied to clipboard' };
    } catch {
      // continue to legacy fallback
    }
  }
  // Last-ditch fallback: a temporary textarea + execCommand('copy').
  // Works in older WebViews where the Clipboard API is gated.
  try {
    const ta = document.createElement('textarea');
    ta.value = opts.url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) return { action: 'copied', message: 'Link copied to clipboard' };
  } catch {
    // ignore
  }
  return { action: 'error', message: 'Could not share or copy' };
}

/** Build the public URL the user should share for a given hash route. The
 *  app uses HashRouter so deep links are `<origin>/<base>#/path`. */
export function shareUrlForHash(hashPath: string): string {
  const base = window.location.href.split('#')[0];
  const trimmed = hashPath.startsWith('#') ? hashPath : `#${hashPath}`;
  return `${base}${trimmed}`;
}
