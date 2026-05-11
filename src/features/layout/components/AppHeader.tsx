import { useEffect, useRef, useState, type JSX } from 'react';
import { MessagePathBreadcrumb } from '../../message-path/components/MessagePathBreadcrumb';

type HeaderViewMode = 'overview' | 'detail' | 'settings';

interface AppHeaderProps {
  topicChunks: string[];
  currentViewMode: HeaderViewMode;
  onNavigateBreadcrumb: (depth: number) => void;
  onOpenHome: () => void;
  onOpenSettings: () => void;
}

/**
 * Header with breadcrumb and top-right menu actions.
 * @param props Component props.
 * @returns {JSX.Element} Header element.
 */
export function AppHeader(props: AppHeaderProps): JSX.Element {
  const { topicChunks, currentViewMode, onNavigateBreadcrumb, onOpenHome, onOpenSettings } = props;
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect((): (() => void) => {
    /**
     * Closes menu when user clicks outside the header menu container.
     * @param event Browser pointer event.
     */
    function handlePointerDown(event: PointerEvent): void {
      const rootElement = rootRef.current;
      if (rootElement === null) {
        return;
      }

      const eventTarget = event.target;
      if (!(eventTarget instanceof Node)) {
        return;
      }

      if (!rootElement.contains(eventTarget)) {
        setIsMenuOpen(false);
      }
    }

    /**
     * Closes menu on escape key press.
     * @param event Keyboard event.
     */
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return (): void => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  /**
   * Opens the Home view from menu action.
   */
  function openHome(): void {
    setIsMenuOpen(false);
    onOpenHome();
  }

  /**
   * Opens the Settings view from menu action.
   */
  function openSettings(): void {
    setIsMenuOpen(false);
    onOpenSettings();
  }

  return (
    <header className="app-header">
      <MessagePathBreadcrumb topicChunks={topicChunks} onNavigate={onNavigateBreadcrumb} />
      <div className="header-menu" ref={rootRef}>
        <button
          className="header-menu-trigger"
          type="button"
          aria-label="Menue"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          onClick={(): void => {
            setIsMenuOpen((currentOpen: boolean): boolean => !currentOpen);
          }}
        >
          <span className="header-menu-trigger-bars" aria-hidden="true" />
        </button>

        {isMenuOpen ? (
          <div className="header-menu-dropdown" role="menu" aria-label="Hauptmenue">
            <button
              className="header-menu-item"
              type="button"
              role="menuitem"
              disabled={currentViewMode === 'overview'}
              onClick={openHome}
            >
              Home
            </button>
            <button
              className="header-menu-item header-menu-item-config"
              type="button"
              role="menuitem"
              disabled={currentViewMode === 'settings'}
              onClick={openSettings}
            >
              Settings
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
