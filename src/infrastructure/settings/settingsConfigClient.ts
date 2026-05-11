import type { TopicNodeSettingsPayload, TopicSettingsPayload } from '../../domain/settings/interfaces';

/**
 * Error thrown when settings config API communication fails.
 */
export class SettingsConfigClientError extends Error {
  public readonly endpoint: string;
  public readonly status: number;

  /**
   * Creates one typed settings client error.
   * @param message Human-readable error details.
   * @param endpoint Endpoint URL that failed.
   * @param status HTTP status code or 0 for non-HTTP failures.
   */
  public constructor(message: string, endpoint: string, status: number) {
    super(message);
    this.name = 'SettingsConfigClientError';
    this.endpoint = endpoint;
    this.status = status;
  }
}

/**
 * HTTP client for loading and storing GUI settings configurations.
 */
export class SettingsConfigClient {
  private readonly baseUrl: string;
  private readonly configStorePath: string;

  /**
   * Creates a settings config API client.
   * @param baseUrl Absolute backend base URL.
   * @param configStorePath Relative path to settings config root.
   */
  public constructor(baseUrl: string, configStorePath: string) {
    this.baseUrl = baseUrl;
    this.configStorePath = normalizePath(configStorePath);
  }

  /**
   * Reads one named settings configuration.
   * @param configType Configuration type like General/Phone/Tablet/Computer.
   * @returns {Promise<TopicSettingsPayload>} Validated settings payload.
   */
  public async readConfig(configType: string): Promise<TopicSettingsPayload> {
    const endpoint = this.buildConfigEndpoint(configType);
    const response = await fetch(endpoint, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new SettingsConfigClientError(
        `settings read failed with status ${String(response.status)}`,
        endpoint,
        response.status,
      );
    }

    let rawBody: unknown;
    try {
      rawBody = (await response.json()) as unknown;
    } catch {
      throw new SettingsConfigClientError('settings response is not valid JSON', endpoint, response.status);
    }

    return parseTopicSettingsPayload(rawBody, endpoint, response.status);
  }

  /**
   * Stores one named settings configuration.
   * @param configType Configuration type like General/Phone/Tablet/Computer.
   * @param payload Settings payload to store.
   * @returns {Promise<void>} Resolves on success.
   */
  public async storeConfig(configType: string, payload: TopicSettingsPayload): Promise<void> {
    const endpoint = this.buildConfigEndpoint(configType);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return;
    }

    const responseText = await response.text();
    const trimmedResponseText = responseText.trim();
    const details = trimmedResponseText.length > 0 ? `: ${trimmedResponseText}` : '';
    throw new SettingsConfigClientError(
      `settings store failed with status ${String(response.status)}${details}`,
      endpoint,
      response.status,
    );
  }

  /**
   * Builds one endpoint URL for a concrete config type.
   * @param configType Configuration type.
   * @returns {string} Absolute endpoint URL.
   */
  private buildConfigEndpoint(configType: string): string {
    const normalizedType = normalizeConfigType(configType);
    return new URL(`${this.configStorePath}/${encodeURIComponent(normalizedType)}`, this.baseUrl).toString();
  }
}

/**
 * Parses settings payload from unknown JSON body.
 * @param rawBody Raw JSON payload.
 * @param endpoint Endpoint context for errors.
 * @param status HTTP status code.
 * @returns {TopicSettingsPayload} Validated payload.
 */
function parseTopicSettingsPayload(rawBody: unknown, endpoint: string, status: number): TopicSettingsPayload {
  if (!isRecord(rawBody)) {
    throw new SettingsConfigClientError('settings payload must be an object', endpoint, status);
  }

  const result: TopicSettingsPayload = {};
  for (const [topic, rawNodePayload] of Object.entries(rawBody)) {
    if (typeof topic !== 'string' || topic.length === 0) {
      continue;
    }

    if (!isRecord(rawNodePayload)) {
      throw new SettingsConfigClientError(`settings node '${topic}' is not an object`, endpoint, status);
    }

    result[topic] = parseTopicNodePayload(topic, rawNodePayload, endpoint, status);
  }

  return result;
}

/**
 * Parses one topic node payload.
 * @param topic Topic key for diagnostics.
 * @param rawPayload Raw node payload.
 * @param endpoint Endpoint context for errors.
 * @param status HTTP status code.
 * @returns {TopicNodeSettingsPayload} Validated node payload.
 */
function parseTopicNodePayload(
  topic: string,
  rawPayload: Record<string, unknown>,
  endpoint: string,
  status: number,
): TopicNodeSettingsPayload {
  const parsedPayload: TopicNodeSettingsPayload = {};

  if ('disabled' in rawPayload) {
    if (!Array.isArray(rawPayload.disabled)) {
      throw new SettingsConfigClientError(`settings node '${topic}' has invalid disabled list`, endpoint, status);
    }

    const disabled: string[] = [];
    for (const disabledEntry of rawPayload.disabled) {
      if (typeof disabledEntry !== 'string') {
        throw new SettingsConfigClientError(`settings node '${topic}' has non-string disabled entry`, endpoint, status);
      }
      disabled.push(disabledEntry);
    }
    parsedPayload.disabled = disabled;
  }

  if ('parameter' in rawPayload) {
    if (!isRecord(rawPayload.parameter)) {
      throw new SettingsConfigClientError(`settings node '${topic}' has invalid parameter object`, endpoint, status);
    }

    const parameter: Record<string, string> = {};
    for (const [parameterName, parameterValue] of Object.entries(rawPayload.parameter)) {
      if (typeof parameterValue !== 'string') {
        throw new SettingsConfigClientError(
          `settings node '${topic}' parameter '${parameterName}' must be a string`,
          endpoint,
          status,
        );
      }
      parameter[parameterName] = parameterValue;
    }

    parsedPayload.parameter = parameter;
  }

  return parsedPayload;
}

/**
 * Checks whether a value is an object-like record.
 * @param value Candidate value.
 * @returns {value is Record<string, unknown>} True when value is a record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Normalizes and validates one config type.
 * @param configType Raw config type.
 * @returns {string} Normalized non-empty config type.
 */
function normalizeConfigType(configType: string): string {
  const normalizedType = configType.trim();
  if (normalizedType.length === 0) {
    throw new SettingsConfigClientError('config type must not be empty', 'settings-config-type', 0);
  }
  return normalizedType;
}

/**
 * Normalizes path-like route config values.
 * @param path Raw route path.
 * @returns {string} Normalized route path.
 */
function normalizePath(path: string): string {
  const trimmedPath = path.trim();
  const prefixedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;
  if (prefixedPath.length > 1 && prefixedPath.endsWith('/')) {
    return prefixedPath.slice(0, -1);
  }
  return prefixedPath;
}
