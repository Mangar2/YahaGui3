import type { JSX } from 'react';
import type { MessageReason } from '../../../domain/messages/interfaces';
import type { RulesLoadResult } from '../../../domain/rules/interfaces';
import type { RuleEditorField, RuleEditorState, RulesNavigationItem, RuleTraceState } from '../hooks/useRulesController';
import { RulePathEditor } from './RulePathEditor';
import { RulesNavigation } from './RulesNavigation';
import '../styles/rules.css';

interface RulesPageProps {
  loadResult: RulesLoadResult | null;
  isLoading: boolean;
  lastRefreshIso: string | null;
  navigationItems: RulesNavigationItem[];
  editorState: RuleEditorState | null;
  hasRuleSelection: boolean;
  isSaving: boolean;
  traceState: RuleTraceState;
  saveError: string | null;
  saveSuccessMessage: string | null;
  onSelectNavigationItem: (item: RulesNavigationItem) => void;
  onUpdateEditorField: (field: RuleEditorField, value: string | boolean | string[]) => void;
  onSaveRuleDetails: () => void;
  onDeleteRuleDetails: () => void;
  onReloadRules: () => void;
  onCopyRuleDetails: () => void;
  onTraceRule: () => void;
}

/**
 * Rules page for managing automation rules.
 * Renders the shared home-like layout for rules content only.
 * @param props Component props with controller state and handlers.
 * @returns {JSX.Element} Rules management page.
 */
export function RulesPage(props: RulesPageProps): JSX.Element {
  const {
    loadResult,
    isLoading,
    lastRefreshIso,
    navigationItems,
    editorState,
    hasRuleSelection,
    isSaving,
    traceState,
    saveError,
    saveSuccessMessage,
    onSelectNavigationItem,
    onUpdateEditorField,
    onSaveRuleDetails,
    onDeleteRuleDetails,
    onReloadRules,
    onCopyRuleDetails,
    onTraceRule,
  } = props;

  if (isLoading) {
    return (
      <section className="rules-page">
        <div className="app-panel rules-loading-panel">
          <div className="rules-loading">
            <span className="rules-loader" aria-label="Rules werden geladen" />
            <p>Laden...</p>
          </div>
        </div>
      </section>
    );
  }

  if (!(loadResult?.success && loadResult.ruleCount >= 0)) {
    return (
      <section className="rules-page">
        <div className="app-panel rules-error-panel">
          <div className="rules-error">
            <p className="rules-error-text">{loadResult?.error ?? 'Fehler beim Laden der Rules'}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rules-page">
      <div className="rules-page-body overview-layout">
        <div className="rules-nav-panel">
          <RulesNavigation items={navigationItems} onSelectItem={onSelectNavigationItem} />
        </div>

        <div className="app-panel rules-editor-panel">
          <RulePathEditor
            editorState={editorState}
            hasSelection={hasRuleSelection}
            isSaving={isSaving}
            saveError={saveError}
            saveSuccessMessage={saveSuccessMessage}
            onFieldChange={onUpdateEditorField}
            onSave={onSaveRuleDetails}
            onDelete={onDeleteRuleDetails}
            onReload={onReloadRules}
            onCopy={onCopyRuleDetails}
            onTrace={onTraceRule}
          />
        </div>

        <div className="overview-status rules-update-status" aria-live="polite">
          {loadResult.warning ? <p className="rules-warning-text">{loadResult.warning}</p> : null}
          <p>
            Letzte Aktualisierung: <strong>{formatLocalizedTime(lastRefreshIso)}</strong>
          </p>
        </div>

        {hasRuleSelection ? <RulesTracePanel traceState={traceState} /> : null}
      </div>
    </section>
  );
}

/**
 * Renders trace polling status and latest trace response payload.
 * @param props Component props.
 * @param props.traceState Current trace polling state from controller.
 * @returns {JSX.Element} Trace panel.
 */
function RulesTracePanel(props: { traceState: RuleTraceState }): JSX.Element {
  const { traceState } = props;

  return (
    <section className="app-panel rules-trace-panel" aria-live="polite" aria-label="Trace panel">
      <h3 className="rules-trace-title">trace</h3>

      {traceState.status === 'idle' ? <p className="rules-trace-empty">Noch kein Trace gesendet.</p> : null}

      {traceState.status === 'pending' ? (
        <p className="rules-trace-info">
          Trace gesendet. Warte auf Antwort auf <strong>{traceState.responseTopic ?? '-'}</strong> ...
        </p>
      ) : null}

      {traceState.status === 'error' ? <p className="rules-trace-error">{traceState.error ?? 'Unbekannter Trace-Fehler.'}</p> : null}

      {traceState.status === 'success' && traceState.response !== null ? (
        <div className="rules-trace-response">
          <p>
            Topic: <strong>{traceState.response.topic}</strong>
          </p>
          <p>
            Value: <strong>{traceState.response.value.length > 0 ? traceState.response.value : '-'}</strong>
          </p>
          <p>
            Last Update: <strong>{formatLocalizedTime(traceState.response.time)}</strong>
          </p>

          <div className="rules-trace-reason-block">
            <h4>Reason</h4>
            {traceState.response.reason.length > 0 ? (
              <ol className="rules-trace-reason-list">
                {traceState.response.reason.map((reasonEntry: MessageReason, index: number): JSX.Element => {
                  return <li key={`${reasonEntry.timestamp}-${reasonEntry.message}-${String(index)}`}>{formatReasonLine(reasonEntry, index)}</li>;
                })}
              </ol>
            ) : (
              <p className="rules-trace-empty">Keine Reason-Eintraege vorhanden.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Formats one reason entry with numbering and localized timestamp.
 * @param reasonEntry Reason payload entry.
 * @param index Zero-based item index.
 * @returns {string} Display line for one reason.
 */
function formatReasonLine(reasonEntry: MessageReason, index: number): string {
  return `${String(index + 1)}. ${reasonEntry.message} (${formatReasonTimestamp(reasonEntry.timestamp, index === 0)})`;
}

/**
 * Formats one timestamp with optional date prefix (first entry only).
 * @param isoTimestamp ISO timestamp string.
 * @param includeDate Whether the date part should be included.
 * @returns {string} Localized timestamp text.
 */
function formatReasonTimestamp(isoTimestamp: string, includeDate: boolean): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp;
  }

  const timeText = date.toLocaleTimeString();
  if (!includeDate) {
    return timeText;
  }

  const dateText = isToday(date)
    ? 'Today'
    : date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });

  return `${dateText}, ${timeText}`;
}

/**
 * Checks whether a date belongs to the current day.
 * @param date Candidate date.
 * @returns {boolean} True when date is today.
 */
function isToday(date: Date): boolean {
  const givenDate = new Date(date.getTime());
  const todayDate = new Date();
  return givenDate.setHours(0, 0, 0, 0) === todayDate.setHours(0, 0, 0, 0);
}

/**
 * Formats one ISO timestamp with localized time output.
 * @param isoTimestamp Last update timestamp in ISO format.
 * @returns {string} Localized time or a placeholder when unavailable.
 */
function formatLocalizedTime(isoTimestamp: string | null): string {
  if (isoTimestamp === null) {
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
