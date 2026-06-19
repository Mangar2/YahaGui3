import type { JSX } from 'react';
import type { RulesNavigationItem } from '../hooks/useRulesController';

interface RulesNavigationProps {
  items: RulesNavigationItem[];
  onSelectItem: (item: RulesNavigationItem) => void;
}

/**
 * Navigation list for rule folders and rule names.
 * Mirrors original rule-nav behavior with active and "add rule" styles.
 * @param props Component props.
 * @returns {JSX.Element} Rule navigation.
 */
export function RulesNavigation(props: RulesNavigationProps): JSX.Element {
  const { items, onSelectItem } = props;

  return (
    <aside className="left-nav" aria-label="Rules Navigation">
      <ul className="left-nav-list">
        {items.map((item: RulesNavigationItem): JSX.Element => {
          const type = resolveStyleType(item);
          const buttonClassName = [
            'left-nav-button',
            type === 'active' ? 'left-nav-button-active' : '',
            type === 'back' ? 'left-nav-button-back' : '',
            type === 'new' ? 'left-nav-config-button' : '',
          ]
            .filter((value: string): boolean => value.length > 0)
            .join(' ');

          return (
            <li key={item.id} className="left-nav-item">
              <button
                type="button"
                className={buttonClassName}
                onClick={(): void => {
                  onSelectItem(item);
                }}
                aria-current={item.type === 'current' ? 'page' : undefined}
              >
                <span className="left-nav-label">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

/**
 * Resolves the visual type of one nav item.
 * @param item Navigation item data.
 * @returns {'active' | 'back' | 'new' | 'normal'} Item style type.
 */
function resolveStyleType(item: RulesNavigationItem): 'active' | 'back' | 'new' | 'normal' {
  if (item.type === 'current') {
    return 'active';
  }

  if (item.type === 'new') {
    return 'new';
  }

  if (item.type === 'back') {
    return 'back';
  }

  return 'normal';
}
