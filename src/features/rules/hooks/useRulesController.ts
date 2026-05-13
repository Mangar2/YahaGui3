import { useEffect, useMemo, useRef, useState } from 'react';
import { RulePath, type RulesLoadResult } from '../../../domain/rules/interfaces';
import { RuleTreeStore } from '../../../domain/rules/ruleTreeStore';
import { RulesConfigClient } from '../../../infrastructure/rules/rulesConfigClient';

export type RulesNavigationItemType = 'current' | 'back' | 'new' | 'normal';

export interface RulesNavigationItem {
  id: string;
  label: string;
  type: RulesNavigationItemType;
}

interface UseRulesControllerState {
  loadResult: RulesLoadResult | null;
  isLoading: boolean;
  lastRefreshIso: string | null;
  selectedPath: RulePath;
  navigationItems: RulesNavigationItem[];
  pathInputValue: string;
  isSaving: boolean;
  saveError: string | null;
  saveSuccessMessage: string | null;
  navigateToDepth: (depth: number) => void;
  selectNavigationItem: (item: RulesNavigationItem) => void;
  updatePathInputValue: (value: string) => void;
  saveRulePath: () => Promise<void>;
}

/**
 * Loads and manages rules navigation state for the rules workspace.
 * @param baseUrl Base URL of the file-store API.
 * @param configPath Rules path inside the file-store API.
 * @returns {UseRulesControllerState} Rules workspace state and actions.
 */
export function useRulesController(baseUrl: string, configPath: string): UseRulesControllerState {
  const rulesClientRef = useRef<RulesConfigClient>(new RulesConfigClient(baseUrl, configPath));
  const [loadResult, setLoadResult] = useState<RulesLoadResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshIso, setLastRefreshIso] = useState<string | null>(null);
  const [rulesStore, setRulesStore] = useState<RuleTreeStore | null>(null);
  const [selectedPath, setSelectedPath] = useState<RulePath>(new RulePath());
  const [pathInputValue, setPathInputValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  useEffect((): void => {
    /**
     * Loads rules once on mount.
     */
    async function loadRules(): Promise<void> {
      setIsLoading(true);
      const result = await rulesClientRef.current.loadRules();
      setLoadResult(result);
      if (result.success && result.rulesTree !== null) {
        setRulesStore(new RuleTreeStore(result.rulesTree));
        setLastRefreshIso(new Date().toISOString());
      }
      setIsLoading(false);
    }

    void loadRules();
  }, []);

  const navigationItems = useMemo((): RulesNavigationItem[] => {
    if (rulesStore === null) {
      return [];
    }

    const list: RulesNavigationItem[] = [
      {
        id: 'rules-current',
        label: getCurrentNavigationLabel(selectedPath),
        type: 'current',
      },
    ];

    if (!isRootPath(selectedPath)) {
      list.push({
        id: 'rules-back',
        label: '<',
        type: 'back',
      });
    }

    for (const childName of rulesStore.getNameList(selectedPath)) {
      list.push({
        id: `rules-child-${childName}`,
        label: childName,
        type: 'normal',
      });
    }

    list.push({
      id: 'rules-add',
      label: 'add rule',
      type: 'new',
    });

    return list;
  }, [rulesStore, selectedPath]);

  /**
   * Navigates to one breadcrumb depth in the rules hierarchy.
   * @param depth Folder depth to show.
   */
  function navigateToDepth(depth: number): void {
    if (rulesStore === null) {
      return;
    }

    const nextPath = selectedPath.clone();
    nextPath.name = null;
    while (nextPath.chunks.length > depth) {
      nextPath.pop();
    }

    setSelectedPath(nextPath);
    setPathInputValue('');
    setSaveError(null);
    setSaveSuccessMessage(null);
  }

  /**
   * Handles one item selection in the rules navigation.
   * @param item Selected navigation item.
   */
  function selectNavigationItem(item: RulesNavigationItem): void {
    if (rulesStore === null) {
      return;
    }

    if (item.type === 'current') {
      return;
    }

    setSaveError(null);
    setSaveSuccessMessage(null);

    if (item.type === 'new') {
      const newPath = rulesStore.addRule(selectedPath);
      const nextStore = new RuleTreeStore(rulesStore.getSnapshot());
      setRulesStore(nextStore);
      setSelectedPath(newPath);
      setPathInputValue(newPath.toTopic());
      setLoadResult((currentResult: RulesLoadResult | null): RulesLoadResult | null => {
        if (!currentResult?.success) {
          return currentResult;
        }
        return {
          ...currentResult,
          ruleCount: nextStore.countRules(),
        };
      });
      return;
    }

    if (item.type === 'back') {
      const upPath = selectedPath.clone();
      upPath.pop();
      upPath.name = null;
      setSelectedPath(upPath);
      setPathInputValue('');
      return;
    }

    const nextPath = rulesStore.getPath(selectedPath, item.label);
    setSelectedPath(nextPath);

    if (nextPath.name !== null) {
      setPathInputValue(nextPath.toTopic());
    } else {
      setPathInputValue('');
    }
  }

  /**
   * Updates the current rule path input.
   * @param value Next input value.
   */
  function updatePathInputValue(value: string): void {
    setPathInputValue(value);
  }

  /**
   * Saves the current rule path change and persists the complete rules tree.
   */
  async function saveRulePath(): Promise<void> {
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
    setPathInputValue(targetPath.toTopic());
    setSaveSuccessMessage('Rule Path gespeichert.');
    setLastRefreshIso(new Date().toISOString());
  }

  return {
    loadResult,
    isLoading,
    lastRefreshIso,
    selectedPath,
    navigationItems,
    pathInputValue,
    isSaving,
    saveError,
    saveSuccessMessage,
    navigateToDepth,
    selectNavigationItem,
    updatePathInputValue,
    saveRulePath,
  };
}

/**
 * Resolves the active top navigation label for the current rules path.
 * @param path Current selected rules path.
 * @returns {string} Active navigation label.
 */
function getCurrentNavigationLabel(path: RulePath): string {
  if (path.name !== null) {
    return path.name;
  }

  const currentChunk = path.chunks.at(-1);
  if (currentChunk !== undefined) {
    return currentChunk;
  }

  return 'rules';
}

/**
 * Checks whether the rules selection points to root level.
 * @param path Current selected rules path.
 * @returns {boolean} True when root is selected.
 */
function isRootPath(path: RulePath): boolean {
  return path.chunks.length === 0 && path.name === null;
}
