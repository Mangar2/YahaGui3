import { useEffect, useRef, useState, type JSX } from 'react';
import { RulePath, type RulesLoadResult } from '../../../domain/rules/interfaces';
import { RuleTreeStore } from '../../../domain/rules/ruleTreeStore';
import { RulesConfigClient } from '../../../infrastructure/rules/rulesConfigClient';
import { RulePathEditor } from './RulePathEditor';
import { RulesNavigation } from './RulesNavigation';
import '../styles/rules.css';

interface RulesPageProps {
  baseUrl: string;
  configPath: string;
}

/**
 * Rules page for managing automation rules.
 * Displays loaded rules and provides editing capabilities.
 * @param props Component props with configuration endpoints.
 * @returns {JSX.Element} Rules management page.
 */
export function RulesPage(props: RulesPageProps): JSX.Element {
  const { baseUrl, configPath } = props;
  const rulesClientRef = useRef<RulesConfigClient>(new RulesConfigClient(baseUrl, configPath));
  const [loadResult, setLoadResult] = useState<RulesLoadResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [rulesStore, setRulesStore] = useState<RuleTreeStore | null>(null);
  const [selectedPath, setSelectedPath] = useState<RulePath>(new RulePath());
  const [activeChunk, setActiveChunk] = useState<string | null>(null);
  const [pathInputValue, setPathInputValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  useEffect((): void => {
    /**
     * Loads rules when component mounts.
     */
    async function loadRules(): Promise<void> {
      setIsLoading(true);
      const result = await rulesClientRef.current.loadRules();
      setLoadResult(result);
      if (result.success && result.rulesTree !== null) {
        setRulesStore(new RuleTreeStore(result.rulesTree));
      }
      setIsLoading(false);
    }

    void loadRules();
  }, []);

  /**
   * Creates the left navigation item list from current path.
   * @returns {string[]} Navigation labels.
   */
  function getNavigationItems(): string[] {
    if (rulesStore === null) {
      return [];
    }

    const list = [...rulesStore.getNameList(selectedPath)];
    if (!selectedPath.isEmpty()) {
      list.unshift('<');
    }
    list.push('add rule');
    return list;
  }

  /**
   * Handles one item selection in the left rules navigation.
   * @param item Selected item label.
   */
  function handleSelectItem(item: string): void {
    if (rulesStore === null) {
      return;
    }

    setSaveError(null);
    setSaveSuccessMessage(null);

    if (item === 'add rule') {
      const newPath = rulesStore.addRule(selectedPath);
      setRulesStore(new RuleTreeStore(rulesStore.getSnapshot()));
      setSelectedPath(newPath);
      setActiveChunk(newPath.name);
      setPathInputValue(newPath.toTopic());
      setLoadResult((currentResult: RulesLoadResult | null): RulesLoadResult | null => {
        if (!currentResult?.success) {
          return currentResult;
        }
        return {
          ...currentResult,
          ruleCount: rulesStore.countRules(),
        };
      });
      return;
    }

    if (item === '<') {
      const upPath = selectedPath.clone();
      upPath.pop();
      upPath.name = null;
      setSelectedPath(upPath);
      setActiveChunk(null);
      setPathInputValue('');
      return;
    }

    const nextPath = rulesStore.getPath(selectedPath, item);
    setSelectedPath(nextPath);

    if (nextPath.name !== null) {
      setActiveChunk(nextPath.name);
      setPathInputValue(nextPath.toTopic());
    } else {
      setActiveChunk(null);
      setPathInputValue('');
    }
  }

  /**
   * Saves the current rule path change and persists the complete rules tree.
   */
  async function handleSaveRulePath(): Promise<void> {
    if (rulesStore === null || selectedPath.name === null) {
      return;
    }

    setSaveError(null);
    setSaveSuccessMessage(null);

    const normalizedInput = pathInputValue.trim();
    if (normalizedInput.length === 0) {
      setSaveError('Rule Path darf nicht leer sein.');
      return;
    }

    const targetPath = RulePath.fromTopic(normalizedInput);
    if (targetPath.name === null) {
      setSaveError('Rule Path braucht mindestens einen Regelnamen.');
      return;
    }

    const renameResult = rulesStore.renameRulePath(selectedPath, targetPath);
    if (!renameResult.success) {
      setSaveError(renameResult.error);
      return;
    }

    setIsSaving(true);
    const saveResult = await rulesClientRef.current.saveRules(rulesStore.getSnapshot());
    setIsSaving(false);

    if (!saveResult.success) {
      setSaveError(saveResult.error ?? 'Unbekannter Fehler beim Speichern.');
      return;
    }

    setRulesStore(new RuleTreeStore(rulesStore.getSnapshot()));
    setSelectedPath(targetPath);
    setActiveChunk(targetPath.name);
    setPathInputValue(targetPath.toTopic());
    setSaveSuccessMessage('Rule Path gespeichert.');
  }

  const navigationItems = getNavigationItems();
  const hasRuleSelection = selectedPath.name !== null;

  return (
    <section className="rules-page">
      <div className="rules-container">
        <h1>Automation Rules</h1>

        {isLoading ? (
          <div className="rules-loading">
            <span className="rules-loader" aria-label="Rules werden geladen" />
            <p>Laden...</p>
          </div>
        ) : loadResult?.success && loadResult.ruleCount >= 0 ? (
          <div className="rules-summary">
            <p className="rules-count">
              <strong>{loadResult.ruleCount}</strong> Regel{loadResult.ruleCount !== 1 ? 'n' : ''} geladen
            </p>

            <div className="rules-workspace">
              <RulesNavigation items={navigationItems} activeItem={activeChunk} onSelectItem={handleSelectItem} />
              <RulePathEditor
                value={pathInputValue}
                hasSelection={hasRuleSelection}
                isSaving={isSaving}
                error={saveError}
                successMessage={saveSuccessMessage}
                onChange={setPathInputValue}
                onSave={(): void => {
                  void handleSaveRulePath();
                }}
              />
            </div>
          </div>
        ) : (
          <div className="rules-error">
            <p className="rules-error-text">{loadResult?.error ?? 'Fehler beim Laden der Rules'}</p>
          </div>
        )}
      </div>
    </section>
  );
}
