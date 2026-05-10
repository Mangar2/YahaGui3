import { useEffect, useState, type JSX } from 'react';
import type { TopicControlItem } from '../domain/messages/controlElementDecisions';
import { DetailViewPage } from '../features/detailview/components/DetailViewPage';
import { LeftTopicNavigation } from '../features/message-path/components/LeftTopicNavigation';
import { MessagePathBreadcrumb } from '../features/message-path/components/MessagePathBreadcrumb';
import { useMessagePathController } from '../features/message-path/hooks/useMessagePathController';
import { RightTopicControls } from '../features/overview-controls/components/RightTopicControls';

type AppViewMode = 'overview' | 'detail';

interface AppViewState {
  mode: AppViewMode;
  detailTopic: string;
}

/**
 * Main application shell for step 1 of the new GUI.
 * @returns {JSX.Element} Application root component.
 */
export default function App(): JSX.Element {
  const {
    topicChunks,
    navItems,
    controlItems,
    pendingPublishTopics,
    isLoading,
    lastRefreshIso,
    error,
    navigateToDepth,
    selectNavItem,
    publishControlValue,
  } = useMessagePathController();
  const [viewState, setViewState] = useState<AppViewState>(readViewStateFromLocation());

  useEffect((): (() => void) => {
    /**
     * Synchronizes local view mode with browser navigation.
     */
    function handlePopState(): void {
      setViewState(readViewStateFromLocation());
    }

    window.addEventListener('popstate', handlePopState);
    return (): void => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  /**
   * Opens the placeholder detail page for the selected topic.
   * @param topic Topic path to show in detail mode.
   */
  function openDetailPage(topic: string): void {
    writeViewStateToLocation({ mode: 'detail', detailTopic: topic });
    setViewState({ mode: 'detail', detailTopic: topic });
  }

  /**
   * Returns from detail mode back to overview mode.
   */
  function openOverviewPage(): void {
    writeViewStateToLocation({ mode: 'overview', detailTopic: '' });
    setViewState({ mode: 'overview', detailTopic: '' });
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <MessagePathBreadcrumb topicChunks={topicChunks} onNavigate={navigateToDepth} />
      </header>

      {viewState.mode === 'overview' ? (
        <section className="overview-layout" aria-live="polite">
          <LeftTopicNavigation navItems={navItems} onSelectNavItem={selectNavItem} />
          <div className="app-panel app-panel-controls">
            <RightTopicControls
              controlItems={controlItems}
              pendingPublishTopics={pendingPublishTopics}
              onOpenDetail={openDetailPage}
              onPublishSwitchChange={(item: TopicControlItem, checked: boolean): void => {
                void publishControlValue(item, checked);
              }}
            />
            <div className="overview-status">
              <p>
                Laden: <strong>{isLoading ? 'aktiv' : 'bereit'}</strong>
              </p>
              <p>
                Letzte Aktualisierung: <strong>{lastRefreshIso ?? 'noch keine'}</strong>
              </p>
            </div>
            {error ? <p className="error-text">{error}</p> : null}
          </div>
        </section>
      ) : (
        <DetailViewPage topic={viewState.detailTopic} onBackToOverview={openOverviewPage} />
      )}
    </main>
  );
}

/**
 * Reads detail/overview state from URL query params.
 * @returns {AppViewState} Current view mode and detail topic.
 */
function readViewStateFromLocation(): AppViewState {
  const searchParams = new URLSearchParams(window.location.search);
  const view = searchParams.get('view');
  const detailTopic = searchParams.get('detailTopic') ?? '';
  if (view === 'detail') {
    return { mode: 'detail', detailTopic };
  }
  return { mode: 'overview', detailTopic: '' };
}

/**
 * Persists detail/overview state into URL query params.
 * @param viewState View mode payload.
 */
function writeViewStateToLocation(viewState: AppViewState): void {
  const currentUrl = new URL(window.location.href);
  if (viewState.mode === 'detail') {
    currentUrl.searchParams.set('view', 'detail');
    currentUrl.searchParams.set('detailTopic', viewState.detailTopic);
  } else {
    currentUrl.searchParams.delete('view');
    currentUrl.searchParams.delete('detailTopic');
  }
  window.history.pushState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
}
