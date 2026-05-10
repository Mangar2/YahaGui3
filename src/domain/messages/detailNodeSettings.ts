export interface DetailNodeSettings {
  topicType: string;
  valueType: string;
  enumList: string[];
}

interface RawSettingsNode {
  parameter?: Record<string, unknown>;
}

type RawSettingsStore = Record<string, RawSettingsNode>;

const SETTINGS_STORE_KEY = 'yaha_configuration';

/**
 * Loads persisted node settings for a single topic from the legacy-compatible settings store.
 * @param topic Full topic path.
 * @returns {DetailNodeSettings} Sanitized settings with deterministic defaults.
 */
export function loadDetailNodeSettings(topic: string): DetailNodeSettings {
  const parsedStore = loadRawSettingsStore();
  const rawNode = parsedStore[topic];
  if (!rawNode || !isRecord(rawNode.parameter)) {
    return createDefaultSettings();
  }

  const topicType = readStringOrDefault(rawNode.parameter.topicType, 'Automatic');
  const valueType = readStringOrDefault(rawNode.parameter.valueType, 'Automatic');
  const enumList = readEnumList(rawNode.parameter.enumList);

  return {
    topicType,
    valueType,
    enumList,
  };
}

/**
 * Returns deterministic fallback settings.
 * @returns {DetailNodeSettings} Default settings.
 */
function createDefaultSettings(): DetailNodeSettings {
  return {
    topicType: 'Automatic',
    valueType: 'Automatic',
    enumList: [],
  };
}

/**
 * Loads and validates the persisted settings store from localStorage.
 * @returns {RawSettingsStore} Parsed store or empty store when parsing fails.
 */
function loadRawSettingsStore(): RawSettingsStore {
  const rawStore = window.localStorage.getItem(SETTINGS_STORE_KEY);
  if (typeof rawStore !== 'string' || rawStore.trim().length === 0) {
    return {};
  }

  try {
    const parsedValue: unknown = JSON.parse(rawStore);
    if (!isRecord(parsedValue)) {
      return {};
    }
    return parsedValue as RawSettingsStore;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'unknown parsing error';
    console.warn(`Invalid '${SETTINGS_STORE_KEY}' data ignored: ${errorMessage}`);
    return {};
  }
}

/**
 * Reads one string setting or returns a fallback value.
 * @param value Unknown source value.
 * @param fallback Fallback used when source is invalid.
 * @returns {string} Sanitized string.
 */
function readStringOrDefault(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    return fallback;
  }
  return value;
}

/**
 * Parses the legacy enum list value that is stored as JSON string.
 * @param rawEnumList Unknown persisted enum list value.
 * @returns {string[]} Sanitized enum entries.
 */
function readEnumList(rawEnumList: unknown): string[] {
  if (typeof rawEnumList !== 'string' || rawEnumList.trim().length === 0) {
    return [];
  }

  try {
    const parsedList: unknown = JSON.parse(rawEnumList);
    if (!Array.isArray(parsedList)) {
      return [];
    }

    const result: string[] = [];
    for (const entry of parsedList) {
      if (typeof entry === 'string' && entry.length > 0) {
        result.push(entry);
      }
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * Type guard for object-like values.
 * @param value Candidate value.
 * @returns {value is Record<string, unknown>} True when value is a record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
