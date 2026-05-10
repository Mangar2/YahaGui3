import { useEffect, useRef, useState, type JSX } from 'react';
import type { TopicControlItem } from '../domain/messages/controlElementDecisions';
import { getSnackbarDurationMs, type SnackbarSeverity } from '../config/notificationConfigService';
import { DetailViewPage } from '../features/detailview/components';
import { LeftTopicNavigation } from '../features/message-path/components/LeftTopicNavigation';
import { MessagePathBreadcrumb } from '../features/message-path/components/MessagePathBreadcrumb';
import { useMessagePathController } from '../features/message-path/hooks/useMessagePathController';
import { RightTopicControls } from '../features/overview-controls/components/RightTopicControls';

type AppViewMode = 'overview' | 'detail';

interface AppViewState {
  mode: AppViewMode;
  detailTopic: string;
}

interface SnackbarState {
  id: number;
  message: string;
  severity: SnackbarSeverity;
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
  const [snackbarStack, setSnackbarStack] = useState<SnackbarState[]>([]);
  const snackbarTimeoutsRef = useRef<Map<number, number>>(new Map<number, number>());

  useEffect((): (() => void) => {
    return (): void => {
      for (const timeoutId of snackbarTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      snackbarTimeoutsRef.current.clear();
    };
  }, []);

  useEffect((): void => {
    const snackbarContent = mapSnackbarContentFromError(error);
    if (!snackbarContent) {
      return;
    }

    const nextId = Date.now();
    setSnackbarStack((currentStack: SnackbarState[]): SnackbarState[] => [
      ...currentStack,
      {
        id: nextId,
        message: snackbarContent.message,
        severity: snackbarContent.severity,
      },
    ]);

    const timeoutId = window.setTimeout((): void => {
      setSnackbarStack((currentStack: SnackbarState[]): SnackbarState[] => {
        return currentStack.filter((entry: SnackbarState): boolean => entry.id !== nextId);
      });
      snackbarTimeoutsRef.current.delete(nextId);
    }, getSnackbarDurationMs(snackbarContent.severity));

    snackbarTimeoutsRef.current.set(nextId, timeoutId);
  }, [error]);

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

  /**
   * Navigates via breadcrumb and leaves detail mode when active.
   * @param depth Amount of topic chunks to keep.
   */
  function navigateBreadcrumb(depth: number): void {
    navigateToDepth(depth);
    if (viewState.mode === 'detail') {
      openOverviewPage();
    }
  }

  const topSnackbar = snackbarStack.at(-1) ?? null;

  /**
   * Removes one snackbar by id and clears its timeout.
   * @param snackbarId Identifier of the snackbar to remove.
   */
  function removeSnackbar(snackbarId: number): void {
    const timeoutId = snackbarTimeoutsRef.current.get(snackbarId);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      snackbarTimeoutsRef.current.delete(snackbarId);
    }

    setSnackbarStack((currentStack: SnackbarState[]): SnackbarState[] => {
      return currentStack.filter((entry: SnackbarState): boolean => entry.id !== snackbarId);
    });
  }

  /**
   * Closes the currently visible snackbar.
   */
  function closeSnackbar(): void {
    if (!topSnackbar) {
      return;
    }
    removeSnackbar(topSnackbar.id);
  }

  const localizedLastRefreshTime = formatLocalizedTime(lastRefreshIso);

  return (
    <main className="app-shell">
      <header className="app-header">
        <MessagePathBreadcrumb topicChunks={topicChunks} onNavigate={navigateBreadcrumb} />
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
              {isLoading ? <span className="overview-status-loader" aria-label="Daten werden geladen" /> : null}
              <p>
                Letzte Aktualisierung: <strong>{localizedLastRefreshTime}</strong>
              </p>
            </div>
            {error && !isPublishErrorMessage(error) ? <p className="error-text">{error}</p> : null}
          </div>
        </section>
      ) : (
        <DetailViewPage topic={viewState.detailTopic} onBackToOverview={openOverviewPage} />
      )}

      {topSnackbar ? (
        <div
          className={`snackbar snackbar-${topSnackbar.severity}`}
          role={getSnackbarRole(topSnackbar.severity)}
          aria-live={getSnackbarAriaLive(topSnackbar.severity)}
          aria-atomic="true"
        >
          <p className="snackbar-message">{topSnackbar.message}</p>
          <button className="snackbar-close" type="button" onClick={closeSnackbar} aria-label="Schliessen">
            X
          </button>
        </div>
      ) : null}
    </main>
  );
}

/**
 * Determines whether a UI error message represents a publish failure.
 * @param errorMessage Potential UI error message.
 * @returns {boolean} True when the message belongs to the publish path.
 */
function isPublishErrorMessage(errorMessage: string | null): errorMessage is string {
  return typeof errorMessage === 'string' && errorMessage.startsWith('Fehler beim Publish:');
}

interface SnackbarContent {
  severity: SnackbarSeverity;
  message: string;
}

/**
 * Maps controller error state to snackbar payload when needed.
 * @param errorMessage Controller error state.
 * @returns {SnackbarContent | null} Snackbar payload or null when no snackbar should be shown.
 */
function mapSnackbarContentFromError(errorMessage: string | null): SnackbarContent | null {
  if (!isPublishErrorMessage(errorMessage)) {
    return null;
  }

  return {
    severity: 'warning',
    message: normalizePublishWarningMessage(errorMessage),
  };
}

/**
 * Converts publish error text into warning text without severity label.
 * @param publishErrorMessage Raw publish error text.
 * @returns {string} User-facing warning text.
 */
function normalizePublishWarningMessage(publishErrorMessage: string): string {
  const prefix = 'Fehler beim Publish:';
  if (publishErrorMessage.startsWith(prefix)) {
    const strippedMessage = publishErrorMessage.slice(prefix.length).trim();
    if (strippedMessage.length > 0) {
      return strippedMessage;
    }
  }
  return publishErrorMessage;
}

/**
 * Returns the appropriate snackbar role for a severity.
 * @param severity Snackbar severity.
 * @returns {'alert' | 'status'} ARIA role.
 */
function getSnackbarRole(severity: SnackbarSeverity): 'alert' | 'status' {
  return severity === 'error' || severity === 'warning' ? 'alert' : 'status';
}

/**
 * Returns ARIA live level for a snackbar severity.
 * @param severity Snackbar severity.
 * @returns {'assertive' | 'polite'} ARIA live value.
 */
function getSnackbarAriaLive(severity: SnackbarSeverity): 'assertive' | 'polite' {
  return severity === 'error' || severity === 'warning' ? 'assertive' : 'polite';
}

/**
 * Formats one ISO timestamp into localized time-only output.
 * @param isoTimestamp Timestamp in ISO format.
 * @returns {string} Localized time representation or placeholder.
 */
function formatLocalizedTime(isoTimestamp: string | null): string {
  if (typeof isoTimestamp !== 'string' || isoTimestamp.length === 0) {
    return '-';
  }

  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
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
