/**
 * Domain models for automation rules.
 * Rules define conditions and actions for automation logic.
 */

/**
 * A flexible rule value that can be a number, string, or nested rule.
 */
export type RuleValue = number | string | RuleValue[];

/**
 * Represents a single automation rule with conditions and actions.
 * Based on the original yaha rules structure.
 */
export interface Rule {
  /** Name of the rule */
  name?: string;
  /** Enable debug logging for this rule */
  doLog?: boolean;
  /** Whether the rule is active */
  active?: boolean;
  /** Whether the rule is valid */
  isValid?: boolean;
  /** Duration without movement in minutes (for motion sensors) */
  durationWithoutMovementInMinutes?: number;
  /** Topic path: matches ALL conditions */
  allOf?: string | string[];
  /** Topic path: matches ANY condition */
  anyOf?: string | string[];
  /** Topic path: permission grant topics */
  allow?: string | string[];
  /** Topic path: none of these conditions must be true */
  noneOf?: string | string[];
  /** Target topic for the rule action */
  topic: string | Record<string, number | string>;
  /** Condition to check */
  check?: RuleValue;
  /** Value to set when rule triggers */
  value?: RuleValue;
  /** Time constraint for rule execution */
  time?: string | RuleValue;
  /** Weekdays when rule is active */
  weekdays?: string | string[];
  /** Duration in seconds */
  duration?: number | string;
  /** Cooldown period in seconds */
  cooldownInSeconds?: number;
  /** Delay before executing rule in seconds */
  delayInSeconds?: number;
  /** MQTT QoS level */
  qos?: number;
  /** Error messages if rule is invalid */
  errors?: string;
}

/**
 * A collection of rules.
 */
export type Rules = Rule[];

/**
 * Tree node for organizing rules hierarchically.
 */
export interface RuleTreeNode {
  rule?: Rule;
  childs?: Record<string, RuleTreeNode>;
}

/**
 * External format for rules (from file store).
 * Allows flexible structure for nested organization.
 * Rules are stored under a "rules" property as key-value pairs.
 */
export type RulesExternalFormat = Record<string, unknown>;

/**
 * Path to a rule in the tree structure.
 */
export class RulePath {
  chunks: string[];

  name: string | null;

  /**
   * @param chunks Folder chunks before the rule name.
   * @param name Optional selected rule name.
   */
  constructor(chunks: string[] = [], name: string | null = null) {
    this.chunks = [...chunks];
    this.name = name;
  }

  /**
   * Creates a clone of this path.
   * @returns {RulePath} Cloned path.
   */
  clone(): RulePath {
    return new RulePath(this.chunks, this.name);
  }

  /**
   * True when no folder and no rule are selected.
   * @returns {boolean} Empty state.
   */
  isEmpty(): boolean {
    return this.chunks.length === 0 && this.name === null;
  }

  /**
   * Appends one folder chunk.
   * @param chunk Folder segment.
   */
  push(chunk: string): void {
    this.chunks.push(chunk);
  }

  /**
   * Pops the selected rule name first, then last folder chunk.
   * @returns {string | undefined} Removed segment.
   */
  pop(): string | undefined {
    if (this.name !== null) {
      const removedName = this.name;
      this.name = null;
      return removedName;
    }

    return this.chunks.pop();
  }

  /**
   * Converts to slash-separated topic path.
   * @returns {string} Path topic.
   */
  toTopic(): string {
    const folderPath = this.chunks.join('/');
    if (this.name === null) {
      return folderPath;
    }

    if (folderPath.length === 0) {
      return this.name;
    }

    return `${folderPath}/${this.name}`;
  }

  /**
   * Parses one slash-separated topic path.
   * @param topic Input topic string.
   * @returns {RulePath} Parsed path.
   */
  static fromTopic(topic: string): RulePath {
    const trimmed = topic.trim();
    if (trimmed.length === 0) {
      return new RulePath();
    }

    const segments = trimmed
      .split('/')
      .map((segment: string): string => segment.trim())
      .filter((segment: string): boolean => segment.length > 0);

    if (segments.length === 0) {
      return new RulePath();
    }

    const name = segments.pop() ?? null;
    return new RulePath(segments, name);
  }
}

/**
 * Result of loading rules from configuration.
 */
export interface RulesLoadResult {
  /** Whether loading was successful */
  success: boolean;
  /** Loaded rules tree or null if failed */
  rulesTree: RuleTreeNode | null;
  /** Error message if loading failed */
  error: string | null;
  /** Count of rules loaded */
  ruleCount: number;
}
