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
 */
export type RulesExternalFormat = Record<string, RulesExternalFormat | Record<string, unknown>>;

/**
 * Path to a rule in the tree structure.
 */
export interface RulePath {
  chunks: string[];
  name: string | null;
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
