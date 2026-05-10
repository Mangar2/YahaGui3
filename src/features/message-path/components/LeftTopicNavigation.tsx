import type { JSX } from 'react';

interface LeftTopicNavigationProps {
  navItems: string[];
  onSelectNavItem: (navItem: string) => void;
}

/**
 * Renders the left-side navigation list based on the active message node.
 * @param props Component props.
 * @returns {JSX.Element} Left navigation panel.
 */
export function LeftTopicNavigation(props: LeftTopicNavigationProps): JSX.Element {
  const { navItems, onSelectNavItem } = props;

  return (
    <aside className="left-nav" aria-label="Topic-Navigation">
      <ul className="left-nav-list">
        {navItems.map((navItem: string, index: number): JSX.Element => {
          const isActive = index === 0;
          const isBackAction = navItem === '<';
          return (
            <li key={`${navItem}-${String(index)}`} className="left-nav-item">
              <button
                className={[
                  'left-nav-button',
                  isActive ? 'left-nav-button-active' : '',
                  isBackAction ? 'left-nav-button-back' : '',
                ]
                  .filter((value: string): boolean => value.length > 0)
                  .join(' ')}
                type="button"
                onClick={(): void => {
                  onSelectNavItem(navItem);
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="left-nav-label" title={navItem}>
                  {navItem}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
