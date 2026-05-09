import type { JSX } from 'react';

interface LeftTopicNavigationProps {
  navItems: string[];
  onSelectNavItem: (navItem: string) => void;
}

/**
 * Renders the left-side navigation list based on the active message node.
 * @param props Component props.
 * @returns Left navigation panel.
 */
export function LeftTopicNavigation(props: LeftTopicNavigationProps): JSX.Element {
  const { navItems, onSelectNavItem } = props;

  return (
    <aside className="left-nav" aria-label="Topic-Navigation">
      <ul className="left-nav-list">
        {navItems.map((navItem: string, index: number): JSX.Element => {
          const isActive = index === 0;
          return (
            <li key={`${navItem}-${index}`} className="left-nav-item">
              <button
                className={isActive ? 'left-nav-button left-nav-button-active' : 'left-nav-button'}
                type="button"
                onClick={(): void => onSelectNavItem(navItem)}
              >
                {navItem}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
