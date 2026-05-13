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
    <aside className="rules-nav" aria-label="Rules Navigation">
      <ul className="rules-nav-list">
        {items.map((item: RulesNavigationItem): JSX.Element => {
          const type = resolveStyleType(item);
          return (
            <li key={item.id} className={`rules-nav-item rules-nav-item-${type}`}>
              <button
                type="button"
                className={`rules-nav-button rules-nav-button-${type}`}
                onClick={(): void => {
                  onSelectItem(item);
                }}
                aria-current={item.type === 'current' ? 'page' : undefined}
              >
                <span className={`rules-nav-label rules-nav-label-${type}`}>{item.label}</span>
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
