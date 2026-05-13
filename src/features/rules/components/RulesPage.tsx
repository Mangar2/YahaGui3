import type { JSX } from 'react';
import type { RulesLoadResult } from '../../../domain/rules/interfaces';
import type { RulesNavigationItem } from '../hooks/useRulesController';
import { RulePathEditor } from './RulePathEditor';
import { RulesNavigation } from './RulesNavigation';
import '../styles/rules.css';

interface RulesPageProps {
  loadResult: RulesLoadResult | null;
  isLoading: boolean;
  lastRefreshIso: string | null;
  navigationItems: RulesNavigationItem[];
  pathInputValue: string;
  isSaving: boolean;
  saveError: string | null;
  saveSuccessMessage: string | null;
  hasRuleSelection: boolean;
  onSelectNavigationItem: (item: RulesNavigationItem) => void;
  onUpdatePathInputValue: (value: string) => void;
  onSaveRulePath: () => void;
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
    pathInputValue,
    isSaving,
    saveError,
    saveSuccessMessage,
    hasRuleSelection,
    onSelectNavigationItem,
    onUpdatePathInputValue,
    onSaveRulePath,
  } = props;

  return (
    <section className="rules-page">
      {isLoading ? (
        <div className="app-panel rules-loading-panel">
          <div className="rules-loading">
            <span className="rules-loader" aria-label="Rules werden geladen" />
            <p>Laden...</p>
          </div>
        </div>
      ) : loadResult?.success && loadResult.ruleCount >= 0 ? (
        <div className="rules-page-body overview-layout">
          <div className="app-panel rules-nav-panel">
            <div className="rules-status">
              {isSaving ? <span className="rules-status-loader" aria-label="Rules werden gespeichert" /> : null}
              <p>
                Letzte Aktualisierung: <strong>{formatLocalizedTime(lastRefreshIso)}</strong>
              </p>
            </div>

            <RulesNavigation items={navigationItems} onSelectItem={onSelectNavigationItem} />
          </div>

          <div className="app-panel rules-editor-panel">
            <RulePathEditor
              value={pathInputValue}
              hasSelection={hasRuleSelection}
              isSaving={isSaving}
              error={saveError}
              successMessage={saveSuccessMessage}
              onChange={onUpdatePathInputValue}
              onSave={onSaveRulePath}
            />
          </div>
        </div>
      ) : (
        <div className="app-panel rules-error-panel">
          <div className="rules-error">
            <p className="rules-error-text">{loadResult?.error ?? 'Fehler beim Laden der Rules'}</p>
          </div>
        </div>
      )}
    </section>
  );
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
