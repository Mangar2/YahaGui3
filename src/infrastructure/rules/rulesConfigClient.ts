/**
 * HTTP/File-store client for loading and saving automation rules.
 * Rules are stored as JSON in the file store.
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
   * @returns {Promise<RulesLoadResult>} Promise resolving to load result with tree and rule count.
   */
  async loadRules(): Promise<RulesLoadResult> {
    try {
      const url = `${this.baseUrl}/${this.configPath}`;
      const response = await fetch(url);

      if (!response.ok) {
        const statusText = `HTTP ${response.status}`;
        throw new Error(`${statusText}: Failed to load rules from ${url}`);
      }

      const data: unknown = await response.json();
      const rulesTree = this.buildRuleTree(data);
      const ruleCount = this.countRules(rulesTree);

      return {
        success: true,
        rulesTree,
        error: null,
        ruleCount,
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      return {
        success: false,
        rulesTree: null,
        error: errorMessage,
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(externalFormat),
      });

      if (!response.ok) {
        const statusText = `HTTP ${response.status}`;
        throw new Error(`${statusText}: Failed to save rules to ${url}`);
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
   * Builds a rule tree from external format data.
   * Recursively processes the nested structure.
   * @param data External format data.
   * @param node Current tree node (leave undefined for initial call).
   * @returns {RuleTreeNode} Built rule tree.
   */
  private buildRuleTree(data: unknown, node: RuleTreeNode = {}): RuleTreeNode {
    if (!isRulesExternalFormat(data)) {
      return node;
    }

    const nodeWithChilds: RuleTreeNode = { ...node };
    nodeWithChilds.childs ??= {};

    for (const [key, value] of Object.entries(data)) {
      if (key === 'rules') {
        this.processRulesArray(value, nodeWithChilds);
      } else if (isRulesExternalFormat(value)) {
        if (!nodeWithChilds.childs) {
          nodeWithChilds.childs = {};
        }
        nodeWithChilds.childs[key] = {};
        this.buildRuleTree(value, nodeWithChilds.childs[key]);
      }
    }

    return nodeWithChilds;
  }

  /**
   * Processes an array of rules and adds them to the tree.
   * @param value Value from rules key.
   * @param node Parent tree node to add rules to.
   */
  private processRulesArray(value: unknown, node: RuleTreeNode): void {
    if (!Array.isArray(value)) {
      return;
    }

    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (isRule(item)) {
        const ruleName = String(i);
        if (!node.childs) {
          node.childs = {};
        }
        node.childs[ruleName] = { rule: item };
      }
    }
  }

  /**
   * Converts a rule tree to external format for file store storage.
   * @param node Rule tree node to convert.
   * @returns {RulesExternalFormat} External format representation.
   */
  private treeToExternalFormat(node: RuleTreeNode): RulesExternalFormat {
    const result: RulesExternalFormat = {};

    if (!node.childs) {
      return result;
    }

    const rulesArray: Record<string, unknown>[] = [];

    for (const [key, childNode] of Object.entries(node.childs)) {
      if (childNode.rule) {
        // Collect rules in array
        rulesArray.push(childNode.rule);
      } else if (childNode.childs) {
        // Recurse for nested structures
        result[key] = this.treeToExternalFormat(childNode);
      }
    }

    if (rulesArray.length > 0) {
      result.rules = rulesArray;
    }

    return result;
  }

  /**
   * Counts total rules in the tree.
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
 * Type guard: checks if value is a Rule object.
 * @param value Value to check.
 * @returns {value is Record<string, unknown>} True if value is a Rule.
 */
function isRule(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('topic' in value || 'name' in value || 'check' in value || 'value' in value)
  );
}

/**
 * Type guard: checks if value is external rules format.
 * @param value Value to check.
 * @returns {value is RulesExternalFormat} True if value is external format object.
 */
function isRulesExternalFormat(value: unknown): value is RulesExternalFormat {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
