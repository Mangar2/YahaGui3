import { useEffect, useMemo, useState, type ChangeEvent, type JSX } from 'react';
import type { TopicSettingsStore } from '../../../domain/settings/interfaces';

interface LeftTopicNavigationProps {
  navItems: string[];
  topicChunks: string[];
  settingsStore: TopicSettingsStore;
  onSelectNavItem: (navItem: string) => void;
  onConfigurationChanged: () => void;
}

/**
 * Renders the left-side navigation list based on the active message node.
 * @param props Component props.
 * @returns {JSX.Element} Left navigation panel.
 */
export function LeftTopicNavigation(props: LeftTopicNavigationProps): JSX.Element {
  const { navItems, topicChunks, settingsStore, onSelectNavItem, onConfigurationChanged } = props;
  const [isConfigurationMode, setIsConfigurationMode] = useState<boolean>(false);
  const [selectionRevision, setSelectionRevision] = useState<number>(0);

  const navSettings = useMemo(() => {
    return settingsStore.getNavSettings(topicChunks);
  }, [settingsStore, topicChunks, selectionRevision]);

  const enabledNavItems = useMemo((): string[] => {
    return navItems.filter((navItem: string): boolean => navSettings.isEnabled(navItem));
  }, [navItems, navSettings, selectionRevision]);

  useEffect((): void => {
    setIsConfigurationMode(false);
    setSelectionRevision((currentRevision: number): number => currentRevision + 1);
  }, [topicChunks]);

  /**
   * Checks whether one navigation item must stay enabled in configuration mode.
   * Legacy parity: first and second entries are required.
   * @param navItem Navigation item.
   * @returns {boolean} True when the item is required.
   */
  function isRequired(navItem: string): boolean {
    if (navItems.length <= 1) {
      return false;
    }
    return navItem === navItems[0] || navItem === navItems[1];
  }

  /**
   * Creates legacy-compatible configure button text.
   * @returns {string} Configure label.
   */
  function getConfigurationLabel(): string {
    if (navSettings.allEnabled()) {
      return 'Configure ...';
    }
    return `Configure (+${String(navSettings.countDisabled())})`;
  }

  /**
   * Applies one navigation visibility change.
   * @param navItem Navigation item.
   * @param selected True when item should remain visible.
   */
  function setItemSelection(navItem: string, selected: boolean): void {
    navSettings.setEnabled(navItem, selected);
    setSelectionRevision((currentRevision: number): number => currentRevision + 1);
  }

  /**
   * Closes configuration mode and persists visibility changes.
   */
  function closeConfigurationMode(): void {
    setIsConfigurationMode(false);
    settingsStore.writeToLocalStore();
    onConfigurationChanged();
  }

  return (
    <aside className="left-nav" aria-label="Topic-Navigation">
      <ul className="left-nav-list">
        {!isConfigurationMode
          ? enabledNavItems.map((navItem: string): JSX.Element => {
              const navIndex = navItems.indexOf(navItem);
              const isActive = navIndex === 0;
              const isBackAction = navItem === '<';

              return (
                <li key={`${navItem}-${String(navIndex)}`} className="left-nav-item">
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
            })
          : navItems.map((navItem: string): JSX.Element => {
              const navIndex = navItems.indexOf(navItem);
              const isActive = navIndex === 0;
              const itemRequired = isRequired(navItem);
              const selected = navSettings.isEnabled(navItem);

              return (
                <li key={`${navItem}-${String(navIndex)}`} className="left-nav-item">
                  <label className="left-nav-config-row">
                    <input
                      className="left-nav-config-toggle"
                      type="checkbox"
                      checked={selected}
                      disabled={itemRequired}
                      onChange={(event: ChangeEvent<HTMLInputElement>): void => {
                        setItemSelection(navItem, event.currentTarget.checked);
                      }}
                    />
                    <span
                      className={isActive ? 'left-nav-button-text-active left-nav-config-label' : 'left-nav-config-label'}
                      title={navItem}
                    >
                      {navItem}
                    </span>
                  </label>
                </li>
              );
            })}

        {!isConfigurationMode ? (
          <li className="left-nav-item">
            <button
              className="left-nav-button left-nav-config-button"
              type="button"
              onClick={(): void => {
                setIsConfigurationMode(true);
              }}
            >
              <span className="left-nav-label" title={getConfigurationLabel()}>
                {getConfigurationLabel()}
              </span>
            </button>
          </li>
        ) : (
          <li className="left-nav-item">
            <button
              className="left-nav-button left-nav-config-button"
              type="button"
              onClick={closeConfigurationMode}
            >
              <span className="left-nav-label" title="Done">
                Done
              </span>
            </button>
          </li>
        )}
      </ul>
    </aside>
  );
}
