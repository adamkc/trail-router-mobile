import { useNavigate } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

export type BottomTabKey = 'home' | 'projects' | 'record' | 'settings';

interface BottomTab {
  key: BottomTabKey;
  label: string;
  icon: IconName;
}

const DEFAULT_TABS: BottomTab[] = [
  { key: 'home',     label: 'Home',     icon: 'compass'  },
  { key: 'projects', label: 'Projects', icon: 'layers'   },
  { key: 'record',   label: 'Record',   icon: 'record'   },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

const DEFAULT_DESTINATION: Record<BottomTabKey, string | null> = {
  home: '/home',
  projects: '/projects',
  record: '/record',
  settings: null,
};

interface BottomTabBarProps {
  active: BottomTabKey;
  tabs?: BottomTab[];
  onSelect?: (key: BottomTabKey) => void;
}

/**
 * Default behavior: tapping a tab navigates to its mapped route.
 * Caller can pass onSelect to intercept (e.g., for flows that need custom handling).
 */
export function BottomTabBar({ active, tabs = DEFAULT_TABS, onSelect }: BottomTabBarProps) {
  const navigate = useNavigate();
  const handle = (key: BottomTabKey) => {
    if (onSelect) {
      onSelect(key);
      return;
    }
    const dest = DEFAULT_DESTINATION[key];
    if (dest) navigate(dest);
  };

  return (
    <div className="bottomtab">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`tab ${t.key === active ? 'active' : ''}`}
          onClick={() => handle(t.key)}
        >
          <div className="dot" />
          <Icon name={t.icon} size={20} />
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
