/**
 * HTTP/File-store client for loading and saving automation rules.
 * Rules are stored as JSON in the file store with rules organized in nested objects.
 * Per SPEC-automation: the "rules" property contains an object of rule key-value pairs.
 */

import type { Rule, RulesExternalFormat, RuleTreeNode, RulesLoadResult } from '../../domain/rules/interfaces';

/**
 * Loads and saves automation rules from/to configuration file store.
 * @param baseUrl Configuration store base URL.
 * @param configPath Configuration store path.
 */
export class RulesConfigClient {
  /**
   * @param baseUrl Configuration store base URL (e.g., http://localhost:8090/api/v1).
   * @param configPath Configuration store path for rules (e.g., automation/rules).
   */
  constructor(
    private readonly baseUrl: string,
    private readonly configPath: string,
  ) {}

  /**
   * Loads automation rules from the configuration file store.
   * Parses the external format and builds the rule tree structure.
   * Per SPEC-automation: rules are extracted from "rules" properties.
   * @returns {Promise<RulesLoadResult>} Promise resolving to load result with tree and rule count.
   */
  async loadRules(): Promise<RulesLoadResult> {
    try {
      const url = `${this.baseUrl}/${this.configPath}`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json, text/plain, */*',
        },
      });

      if (!response.ok) {
        const status = String(response.status);
        throw new Error(`HTTP ${status}: Failed to load rules from ${url}`);
      }

      const responseBodyText = await response.text();
      const parseResult = parseRulesPayload(responseBodyText);
      const data: unknown = parseResult.data;
      const rulesTree = this.parseRulesTree(data);
      const ruleCount = this.countRules(rulesTree);

      return {
        success: true,
        rulesTree,
        error: null,
        warning: parseResult.warning,
        ...(parseResult.recoveredRuleFieldHints ? { recoveredRuleFieldHints: parseResult.recoveredRuleFieldHints } : {}),
        ruleCount,
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      return {
        success: false,
        rulesTree: null,
        error: errorMessage,
        warning: null,
        ruleCount: 0,
      };
    }
  }

  /**
   * Saves automation rules to the configuration file store.
   * Converts the rule tree to external format and posts to file store.
   * @param rulesTree Rule tree to save.
   * @returns {Promise<{success: boolean; error: string | null}>} Promise resolving to save result.
   */
  async saveRules(rulesTree: RuleTreeNode): Promise<{ success: boolean; error: string | null }> {
    try {
      const externalFormat = this.treeToExternalFormat(rulesTree);
      const url = `${this.baseUrl}/${this.configPath}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(externalFormat),
      });

      if (!response.ok) {
        const status = String(response.status);
        throw new Error(`HTTP ${status}: Failed to save rules to ${url}`);
      }

      return { success: true, error: null };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Extracts a string message from an error object.
   * @param error Error object or unknown value.
   * @returns {string} Error message string.
   */
  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const messageProperty = (error as Record<string, unknown>).message;
      if (typeof messageProperty === 'string') {
        return messageProperty;
      }
    }
    return 'Unknown error';
  }

  /**
   * Parses external rules format into a rule tree structure.
   * Per SPEC-automation: recursively scans for "rules" properties.
   * The "rules" property contains an object of rule key-value pairs.
   * @param data Incoming external format data (root level).
   * @returns {RuleTreeNode} Built rule tree structure.
   */
  private parseRulesTree(data: unknown): RuleTreeNode {
    const root: RuleTreeNode = {};
    this.parseNode(data, root);
    return root;
  }

  /**
   * Recursively parses a node in the rules hierarchy.
   * Per SPEC-automation: any property named "rules" contains rule objects.
   * Other properties are treated as nested organizational containers.
   * @param data Node data to parse.
   * @param node Target node to populate.
   */
  private parseNode(data: unknown, node: RuleTreeNode): void {
    if (!isPlainObject(data)) {
      return;
    }

    node.childs ??= {};

    for (const [key, value] of Object.entries(data)) {
      if (key === 'rules') {
        this.extractRulesFromObject(value, node);
      } else if (isPlainObject(value)) {
        // Recurse: non-rules objects are organizational containers
        node.childs[key] = {};
        this.parseNode(value, node.childs[key]);
      }
    }
  }

  /**
   * Extracts rule objects from a rules container.
   * @param value The value to process as rules.
   * @param node Parent node to add rules to.
   */
  private extractRulesFromObject(value: unknown, node: RuleTreeNode): void {
    if (!isPlainObject(value)) {
      return;
    }

    node.childs ??= {};

    for (const [ruleName, ruleData] of Object.entries(value)) {
      if (isRule(ruleData)) {
        node.childs[ruleName] = { rule: ruleData };
      }
    }
  }

  /**
   * Converts a rule tree back to external format for file store.
   * Per SPEC-automation: reconstructs the nested structure with rules objects.
   * @param node Rule tree node.
   * @returns {RulesExternalFormat} External format object.
   */
  private treeToExternalFormat(node: RuleTreeNode): RulesExternalFormat {
    const result: RulesExternalFormat = {};

    if (!node.childs) {
      return result;
    }

    const rulesObj: Record<string, Rule> = {};
    const nestingObj: Record<string, unknown> = {};

    for (const [key, childNode] of Object.entries(node.childs)) {
      if (childNode.rule) {
        // Collect actual rules
        rulesObj[key] = childNode.rule;
      } else if (childNode.childs) {
        // Recurse for nested structures
        nestingObj[key] = this.treeToExternalFormat(childNode);
      }
    }

    // Add nested structures first
    for (const [key, nested] of Object.entries(nestingObj)) {
      result[key] = nested;
    }

    // Add rules object last if any rules exist
    if (Object.keys(rulesObj).length > 0) {
      result.rules = rulesObj;
    }

    return result;
  }

  /**
   * Counts total rules in the tree recursively.
   * A rule is counted when node.rule is defined.
   * @param node Root node to count from.
   * @returns {number} Total number of rules.
   */
  private countRules(node: RuleTreeNode): number {
    let count = 0;

    if (node.rule) {
      count = 1;
    }

    if (node.childs) {
      for (const child of Object.values(node.childs)) {
        count += this.countRules(child);
      }
    }

    return count;
  }
}

/**
 * Type guard: checks if value is a plain object (not array, null, or primitive).
 * @param value Value to check.
 * @returns {value is Record<string, unknown>} True if value is a plain object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard: checks if value is a valid Rule object.
 * Rules must have at least a "topic" property per SPEC-automation.
 * @param value Value to check.
 * @returns {value is Rule} True if value is a Rule.
 */
function isRule(value: unknown): value is Rule {
  if (!isPlainObject(value)) {
    return false;
  }

  const ruleObj = value;
  // Per SPEC: mandatory field is "topic"
  return 'topic' in ruleObj;
}

interface RulesPayloadParseResult {
  data: unknown;
  warning: string | null;
  recoveredRuleFieldHints?: Record<string, string[]>;
}

/**
 * Parses the rules payload with a targeted recovery for invalid control characters.
 * Uses only standard JSON.parse and a pre-sanitize step for malformed string literals.
 * @param rawPayload Raw HTTP response body.
 * @returns {RulesPayloadParseResult} Parsed payload and optional warning.
 */
function parseRulesPayload(rawPayload: string): RulesPayloadParseResult {
  try {
    return {
      data: JSON.parse(rawPayload) as unknown,
      warning: null,
    };
  } catch (strictError: unknown) {
    const strictErrorMessage = extractUnknownErrorMessage(strictError);
    if (!isControlCharacterParseError(strictErrorMessage)) {
      throw strictError;
    }

    const sanitizedPayload = escapeControlCharactersInsideJsonStrings(rawPayload);
    try {
      const parsedRecoveredPayload = JSON.parse(sanitizedPayload) as unknown;
      const recoveredRuleFieldHints = collectRecoveredRuleFieldHints(parsedRecoveredPayload);
      const affectedRuleNames = Object.keys(recoveredRuleFieldHints);
      const previewNames = affectedRuleNames.slice(0, 8);
      const truncatedSuffix = affectedRuleNames.length > previewNames.length ? ', ...' : '';

      return {
        data: parsedRecoveredPayload,
        warning: affectedRuleNames.length > 0
          ? `Rules-JSON enthielt unescaped Control-Characters in Strings. Betroffene Regeln: ${previewNames.join(', ')}${truncatedSuffix}. Oeffne die Regel und pruefe das Feld \"errors\".`
          : 'Rules-JSON enthielt unescaped Control-Characters in Strings und wurde beim Laden automatisch normalisiert. Bitte betroffene Regeltexte pruefen und erneut speichern.',
        recoveredRuleFieldHints,
      };
    } catch {
      throw strictError;
    }
  }
}

/**
 * Checks whether a parse error matches invalid control-character JSON payloads.
 * @param errorMessage Parser error message.
 * @returns {boolean} True when message indicates control-character JSON issues.
 */
function isControlCharacterParseError(errorMessage: string): boolean {
  const normalizedMessage = errorMessage.toLowerCase();
  return normalizedMessage.includes('bad control character') || normalizedMessage.includes('unexpected token');
}

/**
 * Escapes raw control characters found inside JSON string literals.
 * @param rawPayload Raw JSON text.
 * @returns {string} Sanitized JSON text.
 */
function escapeControlCharactersInsideJsonStrings(rawPayload: string): string {
  let result = '';
  let inString = false;
  let isEscaping = false;

  for (let index = 0; index < rawPayload.length; index += 1) {
    const currentCharacter = rawPayload.charAt(index);

    if (!inString) {
      if (currentCharacter === '"') {
        inString = true;
      }
      result += currentCharacter;
      continue;
    }

    if (isEscaping) {
      isEscaping = false;
      result += currentCharacter;
      continue;
    }

    if (currentCharacter === '\\') {
      isEscaping = true;
      result += currentCharacter;
      continue;
    }

    if (currentCharacter === '"') {
      inString = false;
      result += currentCharacter;
      continue;
    }

    const codePoint = currentCharacter.charCodeAt(0);
    if (codePoint <= 0x1f) {
      result += toJsonControlCharacterEscape(currentCharacter, codePoint);
      continue;
    }

    result += currentCharacter;
  }

  return result;
}

/**
 * Converts one control character to a JSON-safe escaped representation.
 * @param currentCharacter Current character.
 * @param codePoint Character code.
 * @returns {string} Escaped JSON representation.
 */
function toJsonControlCharacterEscape(currentCharacter: string, codePoint: number): string {
  if (currentCharacter === '\n') {
    return '\\n';
  }
  if (currentCharacter === '\r') {
    return '\\r';
  }
  if (currentCharacter === '\t') {
    return '\\t';
  }
  if (currentCharacter === '\b') {
    return '\\b';
  }
  if (currentCharacter === '\f') {
    return '\\f';
  }
  return `\\u${codePoint.toString(16).padStart(4, '0')}`;
}

/**
 * Extracts a safe message from unknown error values.
 * @param error Unknown error.
 * @returns {string} Human-readable message.
 */
function extractUnknownErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return String(error);
}

/**
 * Collects affected rule fields after control-character recovery.
 * @param root Root rules payload.
 * @returns {Record<string, string[]>} Map of rule name to affected fields.
 */
function collectRecoveredRuleFieldHints(root: unknown): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  collectRecoveredRuleFieldHintsRecursive(root, [], result);
  return result;
}

/**
 * Recursively scans nested rule containers and captures fields containing control characters.
 * @param node Current subtree node.
 * @param pathChunks Current nested path.
 * @param result Result accumulator.
 */
function collectRecoveredRuleFieldHintsRecursive(
  node: unknown,
  pathChunks: string[],
  result: Record<string, string[]>,
): void {
  if (!isPlainObject(node)) {
    return;
  }

  for (const [entryKey, entryValue] of Object.entries(node)) {
    if (entryKey === 'rules' && isPlainObject(entryValue)) {
      for (const [ruleKey, ruleValue] of Object.entries(entryValue)) {
        if (!isRule(ruleValue)) {
          continue;
        }

        const affectedFields = collectRuleStringFieldNamesWithControlCharacters(ruleValue);
        if (affectedFields.length === 0) {
          continue;
        }

        const ruleName = typeof ruleValue.name === 'string' && ruleValue.name.trim().length > 0
          ? ruleValue.name
          : [...pathChunks, ruleKey].join('/');
        result[ruleName] = affectedFields;
      }
      continue;
    }

    if (isPlainObject(entryValue)) {
      collectRecoveredRuleFieldHintsRecursive(entryValue, [...pathChunks, entryKey], result);
    }
  }
}

/**
 * Collects top-level rule field names that contain control characters.
 * @param ruleValue Rule object.
 * @returns {string[]} Field names.
 */
function collectRuleStringFieldNamesWithControlCharacters(ruleValue: Rule): string[] {
  const result: string[] = [];

  for (const [fieldName, fieldValue] of Object.entries(ruleValue)) {
    if (valueContainsControlCharacter(fieldValue)) {
      result.push(fieldName);
    }
  }

  return result;
}

/**
 * Checks whether a value contains any control character in nested string content.
 * @param value Unknown value.
 * @returns {boolean} True when control characters are found.
 */
function valueContainsControlCharacter(value: unknown): boolean {
  if (typeof value === 'string') {
    return /[\u0000-\u001f]/.test(value);
  }

  if (Array.isArray(value)) {
    return value.some((entry: unknown): boolean => valueContainsControlCharacter(entry));
  }

  if (!isPlainObject(value)) {
    return false;
  }

  return Object.values(value).some((entry: unknown): boolean => valueContainsControlCharacter(entry));
}
