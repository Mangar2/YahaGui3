import {
  ENVIRONMENT,
  type YahaEnvironmentConfig,
} from './environment';

interface YahaGuiRuntimeConfig {
  apiBaseUrl?: string;
  messageStorePath?: string;
  publishPath?: string;
  publishTopicSetSuffix?: string;
}

/**
 * Returns the shared YAHA API base URL used by GUI HTTP interfaces.
 * @returns {string} Absolute base URL.
 */
export function getGuiApiBaseUrl(): string {
  return getApiConfig().apiBaseUrl;
}

/**
 * Returns the configured message-store path.
 * @returns {string} Relative path that starts with '/'.
 */
export function getMessageStorePath(): string {
  return getApiConfig().messageStorePath;
}

/**
 * Returns the configured publish path.
 * @returns {string} Relative path that starts with '/'.
 */
export function getPublishPath(): string {
  return getApiConfig().publishPath;
}

/**
 * Returns the configured topic suffix used for publish writes.
 * @returns {string} Topic suffix for write-target topics.
 */
export function getPublishTopicSetSuffix(): string {
  return getApiConfig().publishTopicSetSuffix;
}

/**
 * Returns the runtime base URL for message-store calls.
 * @returns {string} Absolute base URL.
 */
export function getMessageStoreBaseUrl(): string {
  return getGuiApiBaseUrl();
}

/**
 * Returns the runtime base URL for publish interface calls.
 * @returns {string} Absolute base URL.
 */
export function getPublishBaseUrl(): string {
  return getGuiApiBaseUrl();
}

/**
 * Resolves the effective API configuration by merging selected profile with optional runtime overrides.
 * @returns {YahaEnvironmentConfig} Effective HTTP interface config.
 */
export function getApiConfig(): YahaEnvironmentConfig {
  const runtimeConfig = getRuntimeConfig();

  return {
    apiBaseUrl: runtimeConfig.apiBaseUrl ?? ENVIRONMENT.apiBaseUrl,
    messageStorePath: runtimeConfig.messageStorePath ?? ENVIRONMENT.messageStorePath,
    publishPath: runtimeConfig.publishPath ?? ENVIRONMENT.publishPath,
    publishTopicSetSuffix: runtimeConfig.publishTopicSetSuffix ?? ENVIRONMENT.publishTopicSetSuffix,
  };
}

/**
 * Reads and normalizes runtime configuration from the global browser scope.
 * Expected source: window.__YAHA_GUI_CONFIG__ = { apiBaseUrl, messageStorePath, publishPath, publishTopicSetSuffix }.
 * @returns {YahaGuiRuntimeConfig} Runtime config with validated URL strings.
 */
function getRuntimeConfig(): YahaGuiRuntimeConfig {
  const globalConfigValue = (window as Window & { __YAHA_GUI_CONFIG__?: unknown }).__YAHA_GUI_CONFIG__;
  if (!isRecord(globalConfigValue)) {
    return {};
  }

  const runtimeConfig: YahaGuiRuntimeConfig = {};

  const apiBaseUrl = normalizeConfigUrl(globalConfigValue.apiBaseUrl);
  if (apiBaseUrl) {
    runtimeConfig.apiBaseUrl = apiBaseUrl;
  }

  const messageStorePath = normalizeConfigPath(globalConfigValue.messageStorePath);
  if (messageStorePath) {
    runtimeConfig.messageStorePath = messageStorePath;
  }

  const publishPath = normalizeConfigPath(globalConfigValue.publishPath);
  if (publishPath) {
    runtimeConfig.publishPath = publishPath;
  }

  const publishTopicSetSuffix = normalizeTopicSuffix(globalConfigValue.publishTopicSetSuffix);
  if (publishTopicSetSuffix) {
    runtimeConfig.publishTopicSetSuffix = publishTopicSetSuffix;
  }

  return runtimeConfig;
}

/**
 * Checks whether a value is an object-like record.
 * @param value Candidate value.
 * @returns {value is Record<string, unknown>} True when value is an object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Normalizes URL-like runtime config values.
 * @param value Raw runtime config value.
 * @returns {string | undefined} Trimmed non-empty URL string.
 */
function normalizeConfigUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

/**
 * Normalizes path-like runtime config values.
 * @param value Raw runtime config value.
 * @returns {string | undefined} Normalized path starting with '/'.
 */
function normalizeConfigPath(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return undefined;
  }
  return trimmedValue.startsWith('/') ? trimmedValue : `/${trimmedValue}`;
}

/**
 * Normalizes topic suffix values used for publish target topics.
 * @param value Raw runtime config value.
 * @returns {string | undefined} Normalized topic suffix.
 */
function normalizeTopicSuffix(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return undefined;
  }
  if (trimmedValue === '/') {
    return undefined;
  }
  return trimmedValue.startsWith('/') ? trimmedValue : `/${trimmedValue}`;
}
