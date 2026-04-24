import type { SVGProps } from 'react';

export type IconName =
  | 'back'
  | 'menu'
  | 'search'
  | 'plus'
  | 'more'
  | 'layers'
  | 'pin'
  | 'route'
  | 'record'
  | 'edit'
  | 'library'
  | 'mountain'
  | 'compass'
  | 'download'
  | 'share'
  | 'close'
  | 'filter'
  | 'target'
  | 'trend-up'
  | 'trend-down'
  | 'play'
  | 'pause'
  | 'stop'
  | 'undo'
  | 'lock'
  | 'flag'
  | 'waypoint'
  | 'chevron-right'
  | 'chevron-up'
  | 'settings';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  color?: string;
}

/** Inline outline icon set (1.6 stroke). Ported from design source. */
export function Icon({ name, size = 20, color = 'currentColor', ...rest }: IconProps) {
  const base = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  };

  switch (name) {
    case 'back': return <svg {...base}><path d="M15 6l-6 6 6 6" /></svg>;
    case 'menu': return <svg {...base}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case 'search': return <svg {...base}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
    case 'plus': return <svg {...base}><path d="M12 5v14M5 12h14" /></svg>;
    case 'more': return <svg {...base}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>;
    case 'layers': return <svg {...base}><path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" /></svg>;
    case 'pin': return <svg {...base}><path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>;
    case 'route': return <svg {...base}><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h6a4 4 0 004-4V9a4 4 0 00-4-4h-2" /></svg>;
    case 'record': return <svg {...base}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" fill={color} /></svg>;
    case 'edit': return <svg {...base}><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>;
    case 'library': return <svg {...base}><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>;
    case 'mountain': return <svg {...base}><path d="M3 20l6-10 4 6 3-4 5 8H3z" /><circle cx="8" cy="6" r="1.5" /></svg>;
    case 'compass': return <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M14.5 9.5L10 10.5 9.5 15 14 14l.5-4.5z" fill={color} /></svg>;
    case 'download': return <svg {...base}><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" /></svg>;
    case 'share': return <svg {...base}><circle cx="6" cy="12" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 11l8-4M8 13l8 4" /></svg>;
    case 'close': return <svg {...base}><path d="M6 6l12 12M18 6l-12 12" /></svg>;
    case 'filter': return <svg {...base}><path d="M4 6h16M7 12h10M10 18h4" /></svg>;
    case 'target': return <svg {...base}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></svg>;
    case 'trend-up': return <svg {...base}><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></svg>;
    case 'trend-down': return <svg {...base}><path d="M3 7l6 6 4-4 8 8M15 17h6v-6" /></svg>;
    case 'play': return <svg {...base}><path d="M8 5v14l11-7L8 5z" fill={color} /></svg>;
    case 'pause': return <svg {...base}><rect x="7" y="5" width="3.5" height="14" rx="1" fill={color} /><rect x="13.5" y="5" width="3.5" height="14" rx="1" fill={color} /></svg>;
    case 'stop': return <svg {...base}><rect x="6" y="6" width="12" height="12" rx="2" fill={color} /></svg>;
    case 'undo': return <svg {...base}><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 016 6v1" /></svg>;
    case 'lock': return <svg {...base}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>;
    case 'flag': return <svg {...base}><path d="M5 21V4h12l-2 4 2 4H5" /></svg>;
    case 'waypoint': return <svg {...base}><path d="M12 2l2 7h7l-5.5 4 2 7L12 15.5 6.5 20l2-7L3 9h7z" /></svg>;
    case 'chevron-right': return <svg {...base}><path d="M9 6l6 6-6 6" /></svg>;
    case 'chevron-up': return <svg {...base}><path d="M6 15l6-6 6 6" /></svg>;
    case 'settings': return <svg {...base}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>;
    default: return null;
  }
}
