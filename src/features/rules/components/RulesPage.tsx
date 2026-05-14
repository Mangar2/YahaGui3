import type { JSX } from 'react';
import type { RulesLoadResult } from '../../../domain/rules/interfaces';
import type { RuleEditorField, RuleEditorState, RulesNavigationItem } from '../hooks/useRulesController';
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
  saveError: string | null;
  saveSuccessMessage: string | null;
  onSelectNavigationItem: (item: RulesNavigationItem) => void;
  onUpdateEditorField: (field: RuleEditorField, value: string | boolean | string[]) => void;
  onSaveRuleDetails: () => void;
  onDeleteRuleDetails: () => void;
  onReloadRules: () => void;
  onCopyRuleDetails: () => void;
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
    saveError,
    saveSuccessMessage,
    onSelectNavigationItem,
    onUpdateEditorField,
    onSaveRuleDetails,
    onDeleteRuleDetails,
    onReloadRules,
    onCopyRuleDetails,
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
              <p>
                Letzte Aktualisierung: <strong>{formatLocalizedTime(lastRefreshIso)}</strong>
              </p>
            </div>

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
