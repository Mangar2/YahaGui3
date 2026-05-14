import { useEffect, useMemo, useRef, useState } from 'react';
import { getPublishBaseUrl, getPublishPath, getPublishTopicSetSuffix } from '../../../config/runtime';
import { RulePath, type Rule, type RuleValue, type RulesLoadResult } from '../../../domain/rules/interfaces';
import { RuleTreeStore } from '../../../domain/rules/ruleTreeStore';
import { RulesConfigClient } from '../../../infrastructure/rules/rulesConfigClient';

export type RulesNavigationItemType = 'current' | 'back' | 'new' | 'normal';

const RULES_PUBLISH_TOPIC_PREFIX = '$MONITOR/automation/rules';
const RULE_WEEKDAY_OPTIONS: readonly string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface RuleEditorState {
  prefix: string;
  name: string;
  active: boolean;
  doLog: boolean;
  isValid: boolean;
  time: string;
  weekdays: string[];
  duration: string;
  cooldownInSeconds: string;
  delayInSeconds: string;
  durationWithoutMovementInMinutes: string;
  qos: string;
  allOf: string;
  anyOf: string;
  allow: string;
  noneOf: string;
  check: string;
  value: string;
  topic: string;
  errors: string;
}

export type RuleEditorField = keyof RuleEditorState;

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
  editorState: RuleEditorState | null;
  isSaving: boolean;
  saveError: string | null;
  saveSuccessMessage: string | null;
  navigateToDepth: (depth: number) => void;
  selectNavigationItem: (item: RulesNavigationItem) => void;
  updateEditorField: (field: RuleEditorField, value: string | boolean | string[]) => void;
  saveRuleDetails: () => Promise<void>;
  deleteRuleDetails: () => Promise<void>;
  reloadRules: () => Promise<void>;
  copyRuleDetails: () => void;
}

/**
 * Loads and manages rules navigation state for the rules workspace.
 * @param baseUrl Base URL of the file-store API.
 * @param configPath Rules path inside the file-store API.
 * @param isActive Indicates whether the rules view is currently active.
 * @returns {UseRulesControllerState} Rules workspace state and actions.
 */
export function useRulesController(baseUrl: string, configPath: string, isActive: boolean): UseRulesControllerState {
  const rulesClientRef = useRef<RulesConfigClient>(new RulesConfigClient(baseUrl, configPath));
  const [loadResult, setLoadResult] = useState<RulesLoadResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshIso, setLastRefreshIso] = useState<string | null>(null);
  const [rulesStore, setRulesStore] = useState<RuleTreeStore | null>(null);
  const [selectedPath, setSelectedPath] = useState<RulePath>(new RulePath());
  const [editorState, setEditorState] = useState<RuleEditorState | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  useEffect((): void => {
    if (!isActive) {
      return;
    }
    void reloadRulesFromBackend();
  }, [isActive]);

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
      return;
    }

    const nextPath = rulesStore.getPath(selectedPath, item.label);
    setSelectedPath(nextPath);
  }

  /**
   * Synchronizes editor state from selected rule changes.
   */
  useEffect((): void => {
    if (rulesStore === null || selectedPath.name === null) {
      setEditorState(null);
      return;
    }

    const selectedRule = rulesStore.getRule(selectedPath);
    if (selectedRule === null) {
      setEditorState(null);
      return;
    }

    setEditorState(mapRuleToEditorState(selectedRule));
  }, [rulesStore, selectedPath]);

  /**
   * Updates one field in the rule detail editor state.
   * @param field Target field identifier.
   * @param value Next field value.
   */
  function updateEditorField(field: RuleEditorField, value: string | boolean | string[]): void {
    setEditorState((current: RuleEditorState | null): RuleEditorState | null => {
      if (current === null) {
        return current;
      }

      if (field === 'weekdays' && Array.isArray(value)) {
        return {
          ...current,
          weekdays: value,
        };
      }

      if ((field === 'active' || field === 'doLog' || field === 'isValid') && typeof value === 'boolean') {
        return {
          ...current,
          [field]: value,
        };
      }

      if (typeof value === 'string') {
        return {
          ...current,
          [field]: value,
        };
      }

      return current;
    });
  }

  /**
   * Saves the current rule details and publishes them to the automation save topic.
   */
  async function saveRuleDetails(): Promise<void> {
    if (rulesStore === null || selectedPath.name === null || editorState === null) {
      return;
    }

    setSaveError(null);
    setSaveSuccessMessage(null);

    const targetPathTopic = toPathTopic(editorState.prefix, editorState.name);
    if (targetPathTopic.length === 0) {
      setSaveError('Rule Path darf nicht leer sein.');
      return;
    }

    const targetPath = RulePath.fromTopic(targetPathTopic);
    if (targetPath.name === null) {
      setSaveError('Rule Path braucht mindestens einen Regelnamen.');
      return;
    }

    const renameResult = rulesStore.renameRulePath(selectedPath, targetPath);
    if (!renameResult.success) {
      setSaveError(renameResult.error);
      return;
    }

    const rulePayload = mapEditorStateToRule(editorState, targetPath.toTopic());
    const updateResult = rulesStore.updateRule(targetPath, rulePayload);
    if (!updateResult.success) {
      setSaveError(updateResult.error);
      return;
    }

    setIsSaving(true);
    try {
      const publishTopic = `${RULES_PUBLISH_TOPIC_PREFIX}/${targetPath.toTopic()}`;
      const publishPayload = JSON.stringify(rulePayload);
      await publishRulesCommand(publishTopic, publishPayload);
    } catch (unknownError: unknown) {
      const message = formatRulesPublishError(unknownError);
      setSaveError(message);
      setIsSaving(false);
      return;
    }

    const saveResult = await rulesClientRef.current.saveRules(rulesStore.getSnapshot());
    setIsSaving(false);
    if (!saveResult.success) {
      setSaveError(saveResult.error ?? 'Unbekannter Fehler beim Speichern.');
      return;
    }

    const nextStore = new RuleTreeStore(rulesStore.getSnapshot());
    setRulesStore(nextStore);
    setSelectedPath(targetPath);
    setEditorState(mapRuleToEditorState(rulePayload));
    setSaveSuccessMessage('Rule gespeichert.');
    setLastRefreshIso(new Date().toISOString());
  }

  /**
   * Deletes the selected rule, publishes delete command and persists updated tree.
   */
  async function deleteRuleDetails(): Promise<void> {
    if (rulesStore === null || selectedPath.name === null) {
      return;
    }

    setSaveError(null);
    setSaveSuccessMessage(null);

    const deletePath = selectedPath.clone();
    const publishTopic = `${RULES_PUBLISH_TOPIC_PREFIX}/${deletePath.toTopic()}`;
    const deleteResult = rulesStore.deleteRule(deletePath);
    if (!deleteResult.success) {
      setSaveError(deleteResult.error);
      return;
    }

    setIsSaving(true);
    try {
      await publishRulesCommand(publishTopic, 'delete');
    } catch (unknownError: unknown) {
      setSaveError(formatRulesPublishError(unknownError));
      setIsSaving(false);
      return;
    }

    const saveResult = await rulesClientRef.current.saveRules(rulesStore.getSnapshot());
    setIsSaving(false);
    if (!saveResult.success) {
      setSaveError(saveResult.error ?? 'Unbekannter Fehler beim Loeschen.');
      return;
    }

    const nextStore = new RuleTreeStore(rulesStore.getSnapshot());
    const nextPath = deletePath.clone();
    nextPath.name = null;
    setRulesStore(nextStore);
    setSelectedPath(nextPath);
    setEditorState(null);
    setLoadResult((currentResult: RulesLoadResult | null): RulesLoadResult | null => {
      if (!currentResult?.success) {
        return currentResult;
      }
      return {
        ...currentResult,
        ruleCount: nextStore.countRules(),
      };
    });
    setSaveSuccessMessage('Rule geloescht.');
    setLastRefreshIso(new Date().toISOString());
  }

  /**
   * Copies the selected rule to a new sibling name with "-copy" suffix.
   */
  function copyRuleDetails(): void {
    if (rulesStore === null || selectedPath.name === null) {
      return;
    }

    setSaveError(null);
    setSaveSuccessMessage(null);

    const sourceRule = rulesStore.getRule(selectedPath);
    if (sourceRule === null) {
      setSaveError('Ausgewaehlte Regel wurde nicht gefunden.');
      return;
    }

    const copyPath = selectedPath.clone();
    copyPath.name = `${selectedPath.name}-copy`;

    const copiedRule: Rule = {
      ...sourceRule,
      name: copyPath.toTopic(),
    };

    const createResult = rulesStore.createRule(copyPath, copiedRule);
    if (!createResult.success) {
      setSaveError(createResult.error);
      return;
    }

    const nextStore = new RuleTreeStore(rulesStore.getSnapshot());
    setRulesStore(nextStore);
    setSelectedPath(copyPath);
    setEditorState(mapRuleToEditorState(copiedRule));
    setLoadResult((currentResult: RulesLoadResult | null): RulesLoadResult | null => {
      if (!currentResult?.success) {
        return currentResult;
      }
      return {
        ...currentResult,
        ruleCount: nextStore.countRules(),
      };
    });
    setSaveSuccessMessage('Rule kopiert.');
  }

  /**
   * Triggers backend automation reload and refreshes current rules from file-store.
   */
  async function reloadRules(): Promise<void> {
    setSaveError(null);
    setSaveSuccessMessage(null);
    setIsSaving(true);

    try {
      await publishRulesCommand('$MONITOR/automation/update', 'on');
    } catch (unknownError: unknown) {
      setSaveError(formatRulesPublishError(unknownError));
      setIsSaving(false);
      return;
    }

    await reloadRulesFromBackend();
    setIsSaving(false);
    setSaveSuccessMessage('Rules neu geladen.');
  }

  /**
   * Loads rules from backend and updates local rule store state.
   */
  async function reloadRulesFromBackend(): Promise<void> {
    setIsLoading(true);
    const result = await rulesClientRef.current.loadRules();
    setLoadResult(result);

    if (result.success && result.rulesTree !== null) {
      const nextStore = new RuleTreeStore(result.rulesTree);
      setRulesStore(nextStore);
      setLastRefreshIso(new Date().toISOString());

      setSelectedPath((currentPath: RulePath): RulePath => {
        const selectedRule = nextStore.getRule(currentPath);
        if (currentPath.name === null) {
          return currentPath;
        }
        if (selectedRule === null) {
          return new RulePath();
        }
        return currentPath;
      });
    }

    setIsLoading(false);
  }

  return {
    loadResult,
    isLoading,
    lastRefreshIso,
    selectedPath,
    navigationItems,
    editorState,
    isSaving,
    saveError,
    saveSuccessMessage,
    navigateToDepth,
    selectNavigationItem,
    updateEditorField,
    saveRuleDetails,
    deleteRuleDetails,
    reloadRules,
    copyRuleDetails,
  };
}

/**
 * Maps one rule payload into mutable editor state fields.
 * @param rule Source rule.
 * @returns {RuleEditorState} Editor state for all visible inputs.
 */
function mapRuleToEditorState(rule: Rule): RuleEditorState {
  const path = RulePath.fromTopic(typeof rule.name === 'string' ? rule.name : '');

  return {
    prefix: path.chunks.join('/'),
    name: path.name ?? '',
    active: rule.active ?? true,
    doLog: rule.doLog ?? false,
    isValid: rule.isValid ?? true,
    time: stringifyRuleField(rule.time),
    weekdays: normalizeWeekdays(rule.weekdays),
    duration: stringifyRuleField(rule.duration),
    cooldownInSeconds: stringifyRuleField(rule.cooldownInSeconds),
    delayInSeconds: stringifyRuleField(rule.delayInSeconds),
    durationWithoutMovementInMinutes: stringifyRuleField(rule.durationWithoutMovementInMinutes),
    qos: typeof rule.qos === 'number' ? String(rule.qos) : '0',
    allOf: stringifyRuleField(rule.allOf),
    anyOf: stringifyRuleField(rule.anyOf),
    allow: stringifyRuleField(rule.allow),
    noneOf: stringifyRuleField(rule.noneOf),
    check: stringifyRuleField(rule.check),
    value: stringifyRuleField(rule.value),
    topic: stringifyRuleField(rule.topic),
    errors: stringifyRuleField(rule.errors),
  };
}

/**
 * Converts editor state back to one rule payload.
 * @param editorState Current editor fields.
 * @param topicPath Fully-qualified rule path.
 * @returns {Rule} Rule payload for publish/save.
 */
function mapEditorStateToRule(editorState: RuleEditorState, topicPath: string): Rule {
  const nextRule: Rule = {
    name: topicPath,
    topic: parseRuleField(editorState.topic) as string | Record<string, number | string>,
  };

  applyRuleFlags(nextRule, editorState);
  applyRuleTimeAndWeekdays(nextRule, editorState);
  applyRuleDurationAndNumbers(nextRule, editorState);
  applyRuleConditionFields(nextRule, editorState);

  return nextRule;
}

/**
 * Applies rule flag values to payload.
 * @param rule Target rule.
 * @param editorState Source editor state.
 */
function applyRuleFlags(rule: Rule, editorState: RuleEditorState): void {
  if (!editorState.active) {
    rule.active = false;
  }
  if (editorState.doLog) {
    rule.doLog = true;
  }
}

/**
 * Applies time and weekday values to payload.
 * @param rule Target rule.
 * @param editorState Source editor state.
 */
function applyRuleTimeAndWeekdays(rule: Rule, editorState: RuleEditorState): void {
  const parsedTime = parseRuleField(editorState.time);
  if (parsedTime !== undefined && parsedTime !== '') {
    rule.time = parsedTime as string | RuleValue;
  }

  if (!sameWeekdays(editorState.weekdays, RULE_WEEKDAY_OPTIONS)) {
    rule.weekdays = [...editorState.weekdays];
  }
}

/**
 * Applies duration and numeric timing values.
 * @param rule Target rule.
 * @param editorState Source editor state.
 */
function applyRuleDurationAndNumbers(rule: Rule, editorState: RuleEditorState): void {
  const parsedDuration = parseDurationField(editorState.duration);
  if (parsedDuration !== undefined) {
    rule.duration = parsedDuration;
  }

  setOptionalNumber(rule, 'cooldownInSeconds', editorState.cooldownInSeconds);
  setOptionalNumber(rule, 'delayInSeconds', editorState.delayInSeconds);
  setOptionalNumber(rule, 'durationWithoutMovementInMinutes', editorState.durationWithoutMovementInMinutes);
  setOptionalNumber(rule, 'qos', editorState.qos);
}

/**
 * Applies JSON-like condition fields to payload.
 * @param rule Target rule.
 * @param editorState Source editor state.
 */
function applyRuleConditionFields(rule: Rule, editorState: RuleEditorState): void {
  setOptionalRuleField(rule, 'allOf', parseRuleField(editorState.allOf));
  setOptionalRuleField(rule, 'anyOf', parseRuleField(editorState.anyOf));
  setOptionalRuleField(rule, 'allow', parseRuleField(editorState.allow));
  setOptionalRuleField(rule, 'noneOf', parseRuleField(editorState.noneOf));
  setOptionalRuleField(rule, 'check', parseRuleField(editorState.check));
  setOptionalRuleField(rule, 'value', parseRuleField(editorState.value));
}

/**
 * Sets one numeric rule field when value is parseable and non-zero.
 * @param rule Target rule.
 * @param field Rule numeric field.
 * @param rawValue Input string value.
 */
function setOptionalNumber(
  rule: Rule,
  field: 'cooldownInSeconds' | 'delayInSeconds' | 'durationWithoutMovementInMinutes' | 'qos',
  rawValue: string,
): void {
  const parsedNumber = parseOptionalNumber(rawValue);
  if (parsedNumber !== undefined && parsedNumber !== 0) {
    rule[field] = parsedNumber;
  }
}

/**
 * Parses duration while preventing object-to-string fallbacks.
 * @param value Editor duration input.
 * @returns {number | string | undefined} Duration value for rule payload.
 */
function parseDurationField(value: string): number | string | undefined {
  const parsedDuration = parseRuleField(value);
  if (typeof parsedDuration === 'number') {
    return parsedDuration;
  }
  if (typeof parsedDuration === 'string' && parsedDuration.length > 0) {
    return parsedDuration;
  }
  return undefined;
}

/**
 * Sets an optional rule field when the value is non-empty.
 * @param rule Target rule.
 * @param field Optional field key.
 * @param value Candidate value.
 */
function setOptionalRuleField(
  rule: Rule,
  field: 'allOf' | 'anyOf' | 'allow' | 'noneOf' | 'check' | 'value',
  value: unknown,
): void {
  if (value === undefined || value === '') {
    return;
  }

  if (field === 'check' || field === 'value') {
    rule[field] = value as RuleValue;
    return;
  }

  rule[field] = value as string | string[];
}

/**
 * Converts one rule field value to editor text.
 * @param value Source value.
 * @returns {string} Display string.
 */
function stringifyRuleField(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

/**
 * Parses editor input into structured values when possible.
 * @param value Input text.
 * @returns {unknown} Parsed value or plain string.
 */
function parseRuleField(value: string): unknown {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(trimmedValue) as unknown;
  } catch {
    return value;
  }
}

/**
 * Parses an optional numeric field.
 * @param value Input text.
 * @returns {number | undefined} Number when parseable.
 */
function parseOptionalNumber(value: string): number | undefined {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return undefined;
  }

  const parsedValue = Number(trimmedValue);
  if (!Number.isFinite(parsedValue)) {
    return undefined;
  }
  return parsedValue;
}

/**
 * Normalizes weekdays from rule payload.
 * @param weekdays Source weekdays value.
 * @returns {string[]} Normalized weekday selection.
 */
function normalizeWeekdays(weekdays: string | string[] | undefined): string[] {
  if (Array.isArray(weekdays)) {
    return weekdays.filter((entry: string): boolean => RULE_WEEKDAY_OPTIONS.includes(entry));
  }
  if (typeof weekdays === 'string' && RULE_WEEKDAY_OPTIONS.includes(weekdays)) {
    return [weekdays];
  }
  return [...RULE_WEEKDAY_OPTIONS];
}

/**
 * Compares weekday arrays using fixed ordering.
 * @param left Left weekday list.
 * @param right Right weekday list.
 * @returns {boolean} True when both selections are equal.
 */
function sameWeekdays(left: string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < right.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

/**
 * Creates one slash-separated path topic from prefix + name fields.
 * @param prefix Folder prefix.
 * @param name Rule name.
 * @returns {string} Combined topic.
 */
function toPathTopic(prefix: string, name: string): string {
  const normalizedPrefix = prefix
    .split('/')
    .map((chunk: string): string => chunk.trim())
    .filter((chunk: string): boolean => chunk.length > 0)
    .join('/');
  const normalizedName = name.trim();

  if (normalizedPrefix.length === 0) {
    return normalizedName;
  }
  if (normalizedName.length === 0) {
    return normalizedPrefix;
  }

  return `${normalizedPrefix}/${normalizedName}`;
}

/**
 * Formats publish errors for rules save workflow.
 * @param unknownError Unknown thrown value.
 * @returns {string} Human-readable UI error.
 */
function formatRulesPublishError(unknownError: unknown): string {
  if (unknownError instanceof Error) {
    return `Fehler beim Publish: ${unknownError.message}`;
  }
  return 'Fehler beim Publish: Unbekannter Fehler';
}

/**
 * Publishes a rules command payload to backend publish endpoint without value verification.
 * @param topic Base topic without write suffix.
 * @param value Payload value string.
 * @returns {Promise<void>} Resolves when publish endpoint accepts request.
 */
async function publishRulesCommand(topic: string, value: string): Promise<void> {
  const endpoint = new URL(getPublishPath(), getPublishBaseUrl()).toString();
  const topicWithSuffix = `${topic}${getPublishTopicSetSuffix()}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: topicWithSuffix,
      value,
      reason: [
        {
          message: 'request by browser',
          timestamp: new Date().toISOString(),
        },
      ],
      qos: 1,
      retain: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`publish request failed with status ${String(response.status)}`);
  }
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
