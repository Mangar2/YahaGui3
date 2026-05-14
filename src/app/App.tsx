import { useEffect, useRef, useState, type JSX } from 'react';
import type { TopicControlItem } from '../domain/messages/controlElementDecisions';
import { getSnackbarDurationMs, type SnackbarSeverity } from '../config/notificationConfigService';
import { getConfigStoreBaseUrl, getConfigStorePath, getValuesStoreFilename } from '../config/runtime';
import { TopicSettingsStore } from '../domain/settings/interfaces';
import { DetailViewPage } from '../features/detailview/components';
import { AppHeader } from '../features/layout/components/AppHeader';
import { LeftTopicNavigation } from '../features/message-path/components/LeftTopicNavigation';
import { useMessagePathController } from '../features/message-path/hooks/useMessagePathController';
import { RightTopicControls } from '../features/overview-controls/components/RightTopicControls';
import { SettingsPage, ValuesStorePage } from '../features/settings/components';
import { RulesPage } from '../features/rules/components';
import { useRulesController } from '../features/rules/hooks/useRulesController';
import { SettingsConfigClient } from '../infrastructure/settings/settingsConfigClient';
import { ValuesStoreClient } from '../infrastructure/values/valuesStoreClient';

type AppViewMode = 'overview' | 'detail' | 'settings' | 'values' | 'rules';

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
  const settingsStoreRef = useRef<TopicSettingsStore>(new TopicSettingsStore());
  const settingsClientRef = useRef<SettingsConfigClient>(
    new SettingsConfigClient(getConfigStoreBaseUrl(), getConfigStorePath()),
  );
  const valuesClientRef = useRef<ValuesStoreClient>(
    new ValuesStoreClient(getConfigStoreBaseUrl(), getValuesStoreFilename()),
  );
  const rulesController = useRulesController(getConfigStoreBaseUrl(), 'automation/rules');

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
  } = useMessagePathController(settingsStoreRef.current);
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

    enqueueSnackbar(snackbarContent);
  }, [error]);

  /**
   * Shows one snackbar entry and schedules automatic removal.
   * @param snackbarContent Snackbar payload.
   */
  function enqueueSnackbar(snackbarContent: SnackbarContent): void {
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
  }

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
   * Opens settings mode from top-right header menu.
   */
  function openSettingsPage(): void {
    writeViewStateToLocation({ mode: 'settings', detailTopic: '' });
    setViewState({ mode: 'settings', detailTopic: '' });
  }

  /**
   * Opens values-store mode from top-right header menu.
   */
  function openValuesPage(): void {
    writeViewStateToLocation({ mode: 'values', detailTopic: '' });
    setViewState({ mode: 'values', detailTopic: '' });
  }

  /**
   * Opens rules mode from top-right header menu.
   */
  function openRulesPage(): void {
    writeViewStateToLocation({ mode: 'rules', detailTopic: '' });
    setViewState({ mode: 'rules', detailTopic: '' });
  }

  /**
   * Navigates via breadcrumb and leaves detail mode when active.
   * @param depth Amount of topic chunks to keep.
   */
  function navigateBreadcrumb(depth: number): void {
    navigateToDepth(depth);
    if (viewState.mode !== 'overview') {
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
      <AppHeader
        topicChunks={topicChunks}
        currentViewMode={viewState.mode}
        onNavigateBreadcrumb={navigateBreadcrumb}
        rulesPath={rulesController.selectedPath}
        onNavigateRulesBreadcrumb={rulesController.navigateToDepth}
        onOpenHome={openOverviewPage}
        onOpenSettings={openSettingsPage}
        onOpenValues={openValuesPage}
        onOpenRules={openRulesPage}
      />

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
      ) : viewState.mode === 'detail' ? (
        <DetailViewPage
          topic={viewState.detailTopic}
          settingsStore={settingsStoreRef.current}
          onBackToOverview={openOverviewPage}
          onDeferredError={(errorMessage: string): void => {
            const snackbarContent = mapDeferredErrorToSnackbarContent(errorMessage);
            if (snackbarContent) {
              enqueueSnackbar(snackbarContent);
            }
          }}
        />
      ) : viewState.mode === 'settings' ? (
        <SettingsPage settingsStore={settingsStoreRef.current} settingsClient={settingsClientRef.current} />
      ) : viewState.mode === 'values' ? (
        <ValuesStorePage valuesClient={valuesClientRef.current} />
      ) : (
        <RulesPage
          loadResult={rulesController.loadResult}
          isLoading={rulesController.isLoading}
          lastRefreshIso={rulesController.lastRefreshIso}
          navigationItems={rulesController.navigationItems}
          editorState={rulesController.editorState}
          hasRuleSelection={rulesController.selectedPath.name !== null}
          isSaving={rulesController.isSaving}
          saveError={rulesController.saveError}
          saveSuccessMessage={rulesController.saveSuccessMessage}
          onSelectNavigationItem={rulesController.selectNavigationItem}
          onUpdateEditorField={rulesController.updateEditorField}
          onSaveRuleDetails={(): void => {
            void rulesController.saveRuleDetails();
          }}
          onDeleteRuleDetails={(): void => {
            void rulesController.deleteRuleDetails();
          }}
          onReloadRules={(): void => {
            void rulesController.reloadRules();
          }}
          onCopyRuleDetails={rulesController.copyRuleDetails}
        />
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
 * Maps deferred (async) error messages to snackbar payload.
 * @param errorMessage Deferred UI error.
 * @returns {SnackbarContent | null} Snackbar payload or null when not applicable.
 */
function mapDeferredErrorToSnackbarContent(errorMessage: string): SnackbarContent | null {
  if (errorMessage.startsWith('Fehler beim Publish in der Detailansicht:')) {
    return {
      severity: 'warning',
      message: normalizeErrorMessage(errorMessage, 'Fehler beim Publish in der Detailansicht:'),
    };
  }

  if (errorMessage.startsWith('Fehler beim Laden der Detaildaten:')) {
    return {
      severity: 'error',
      message: normalizeErrorMessage(errorMessage, 'Fehler beim Laden der Detaildaten:'),
    };
  }

  if (errorMessage.length > 0) {
    return {
      severity: 'warning',
      message: errorMessage,
    };
  }

  return null;
}

/**
 * Converts publish error text into warning text without severity label.
 * @param publishErrorMessage Raw publish error text.
 * @returns {string} User-facing warning text.
 */
function normalizePublishWarningMessage(publishErrorMessage: string): string {
  const prefix = 'Fehler beim Publish:';
  return normalizeErrorMessage(publishErrorMessage, prefix);
}

/**
 * Removes an optional prefix and returns fallback text when needed.
 * @param message Raw message.
 * @param prefix Prefix that should be removed.
 * @returns {string} Normalized user-facing message.
 */
function normalizeErrorMessage(message: string, prefix: string): string {
  if (!message.startsWith(prefix)) {
    return message;
  }

  const strippedMessage = message.slice(prefix.length).trim();
  return strippedMessage.length > 0 ? strippedMessage : message;
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
  if (view === 'settings') {
    return { mode: 'settings', detailTopic: '' };
  }
  if (view === 'values') {
    return { mode: 'values', detailTopic: '' };
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
  } else if (viewState.mode === 'settings') {
    currentUrl.searchParams.set('view', 'settings');
    currentUrl.searchParams.delete('detailTopic');
  } else if (viewState.mode === 'values') {
    currentUrl.searchParams.set('view', 'values');
    currentUrl.searchParams.delete('detailTopic');
  } else {
    currentUrl.searchParams.delete('view');
    currentUrl.searchParams.delete('detailTopic');
  }
  window.history.pushState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
}
