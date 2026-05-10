import type { JSX } from 'react';
import { LeftTopicNavigation } from '../features/message-path/components/LeftTopicNavigation';
import { MessagePathBreadcrumb } from '../features/message-path/components/MessagePathBreadcrumb';
import { useMessagePathController } from '../features/message-path/hooks/useMessagePathController';

/**
 * Main application shell for step 1 of the new GUI.
 * @returns {JSX.Element} Application root component.
 */
export default function App(): JSX.Element {
  const { topicChunks, activeNode, navItems, isLoading, lastRefreshIso, error, navigateToDepth, selectNavItem } =
    useMessagePathController();

  return (
    <main className="app-shell">
      <header className="app-header">
        <MessagePathBreadcrumb topicChunks={topicChunks} onNavigate={navigateToDepth} />
      </header>

      <section className="overview-layout" aria-live="polite">
        <LeftTopicNavigation navItems={navItems} onSelectNavItem={selectNavItem} />
        <div className="app-panel">
          <h2>Message-Pfad</h2>
          <p>
            Aktiver Pfad: <strong>{topicChunks.length > 0 ? topicChunks.join('/') : '(root)'}</strong>
          </p>
          <p>
            Node verfuegbar: <strong>{activeNode ? 'ja' : 'nein'}</strong>
          </p>
          <p>
            Laden: <strong>{isLoading ? 'aktiv' : 'bereit'}</strong>
          </p>
          <p>
            Letzte Aktualisierung: <strong>{lastRefreshIso ?? 'noch keine'}</strong>
          </p>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
