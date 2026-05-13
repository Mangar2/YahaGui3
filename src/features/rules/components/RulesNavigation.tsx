import type { JSX } from 'react';

interface RulesNavigationProps {
  items: string[];
  activeItem: string | null;
  onSelectItem: (item: string) => void;
}

/**
 * Navigation list for rule folders and rule names.
 * Mirrors original rule-nav behavior with active and "add rule" styles.
 * @param props Component props.
 * @returns {JSX.Element} Rule navigation.
 */
export function RulesNavigation(props: RulesNavigationProps): JSX.Element {
  const { items, activeItem, onSelectItem } = props;

  return (
    <aside className="rules-nav" aria-label="Rules Navigation">
      <ul className="rules-nav-list">
        {items.map((item: string): JSX.Element => {
          const type = resolveItemType(item, activeItem);
          return (
            <li key={item} className={`rules-nav-item rules-nav-item-${type}`}>
              <button
                type="button"
                className={`rules-nav-button rules-nav-button-${type}`}
                onClick={(): void => {
                  onSelectItem(item);
                }}
              >
                <span className={`rules-nav-label rules-nav-label-${type}`}>{item}</span>
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
 * @param item Navigation item label.
 * @param activeItem Currently active item label.
 * @returns {'active' | 'new' | 'normal'} Item type.
 */
function resolveItemType(item: string, activeItem: string | null): 'active' | 'new' | 'normal' {
  if (item === activeItem) {
    return 'active';
  }

  if (item === 'add rule') {
    return 'new';
  }

  return 'normal';
}
