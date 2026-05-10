import type { MessageStoreQueryOptions, MessageTopicData } from '../../domain/messages/interfaces';
import { MessageStoreClient } from './messageStoreClient';

const VERIFY_MAX_ATTEMPTS = 10;
const VERIFY_INTERVAL_MS = 700;
const VERIFY_QUERY_OPTIONS: MessageStoreQueryOptions = {
  time: false,
  history: false,
  reason: false,
  levelAmount: 0,
};

/**
 * Error thrown when publish communication fails.
 */
export class MessagePublishClientError extends Error {
  public readonly endpoint: string;
  public readonly status: number;

  /**
   * Creates a typed publish error.
   * @param message Human-readable error details.
   * @param endpoint Endpoint that failed.
   * @param status HTTP status code or 0 for non-HTTP failures.
   */
  public constructor(message: string, endpoint: string, status: number) {
    super(message);
    this.name = 'MessagePublishClientError';
    this.endpoint = endpoint;
    this.status = status;
  }
}

/**
 * HTTP client for publishing value changes and waiting for backend confirmation.
 */
export class MessagePublishClient {
  private readonly baseUrl: string;
  private readonly publishPath: string;
  private readonly storePath: string;
  private readonly topicSetSuffix: string;
  private readonly storeClient: MessageStoreClient;

  /**
   * Creates a publish client.
   * @param baseUrl Absolute base URL to the YAHA backend host.
   * @param publishPath Relative route path for publish calls.
   * @param storePath Relative route path for message-store calls.
   * @param topicSetSuffix Topic suffix used to publish write targets.
   */
  public constructor(baseUrl: string, publishPath: string, storePath: string, topicSetSuffix: string) {
    this.baseUrl = baseUrl;
    this.publishPath = normalizePath(publishPath);
    this.storePath = normalizePath(storePath);
    this.topicSetSuffix = normalizeTopicSuffix(topicSetSuffix);
    this.storeClient = new MessageStoreClient(baseUrl, this.storePath);
  }

  /**
  * Publishes a new value to the configured write-target topic and waits until the value is observable via message-store.
  * @param topic Topic path without write-target suffix.
   * @param value Value that should be published.
   * @returns {Promise<void>} Resolves after publish acknowledgement and value confirmation.
   */
  public async publishChange(topic: string, value: string): Promise<void> {
    if (topic.trim().length === 0) {
      throw new MessagePublishClientError('publish topic must not be empty', 'publish', 0);
    }

    const endpoint = new URL(this.publishPath, this.baseUrl).toString();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: `${topic}${this.topicSetSuffix}`,
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

    if (!isPublishSuccessStatus(response.status)) {
      const responseText = await response.text();
      const parsedError = parsePublishError(responseText);
      throw new MessagePublishClientError(parsedError, endpoint, response.status);
    }

    await this.waitForValue(topic, value);
  }

  /**
   * Polls message-store until the published value is visible or timeout is reached.
   * @param topic Topic path.
   * @param expectedValue Expected value representation.
   * @returns {Promise<void>} Resolves when value is visible.
   */
  private async waitForValue(topic: string, expectedValue: string): Promise<void> {
    for (let attempt = 0; attempt < VERIFY_MAX_ATTEMPTS; attempt += 1) {
      const payload = await this.storeClient.loadTopicSection(topic, VERIFY_QUERY_OPTIONS);
      if (hasMatchingValue(payload, topic, expectedValue)) {
        return;
      }
      await delayMilliseconds(VERIFY_INTERVAL_MS);
    }

    throw new MessagePublishClientError(
      `published value for topic '${topic}' could not be verified`,
      new URL(this.storePath, this.baseUrl).toString(),
      0,
    );
  }
}

/**
 * Checks whether a publish response status is accepted by the GUI contract.
 * @param status HTTP status code.
 * @returns {boolean} True when status means publish success.
 */
function isPublishSuccessStatus(status: number): boolean {
  return status === 204 || status === 200;
}

/**
 * Parses a publish error response body.
 * @param rawText Raw response body text.
 * @returns {string} Human-readable error details.
 */
function parsePublishError(rawText: string): string {
  const trimmedText = rawText.trim();
  if (trimmedText.length === 0) {
    return 'publish endpoint returned an empty error response';
  }

  try {
    const parsedJson: unknown = JSON.parse(trimmedText);
    if (isPublishErrorResponse(parsedJson)) {
      return `publish failed: ${parsedJson.error}`;
    }
  } catch {
    return `publish failed: ${trimmedText}`;
  }

  return `publish failed: ${trimmedText}`;
}

/**
 * Checks whether an unknown JSON payload matches the publish error schema.
 * @param value Parsed JSON payload.
 * @returns {value is { error: string }} True when payload contains an error string.
 */
function isPublishErrorResponse(value: unknown): value is { error: string } {
  return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string';
}

/**
 * Checks whether payload contains topic with expected value.
 * @param payload Message-store payload list.
 * @param topic Topic path to match.
 * @param expectedValue Expected value representation.
 * @returns {boolean} True when the expected value is visible.
 */
function hasMatchingValue(payload: MessageTopicData[], topic: string, expectedValue: string): boolean {
  for (const node of payload) {
    if (node.topic !== topic || node.value === undefined) {
      continue;
    }
    return String(node.value) === expectedValue;
  }
  return false;
}

/**
 * Wait helper used for deterministic polling intervals.
 * @param delayInMilliseconds Milliseconds to wait.
 * @returns {Promise<void>} Resolves after timeout.
 */
function delayMilliseconds(delayInMilliseconds: number): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    window.setTimeout((): void => {
      resolve();
    }, delayInMilliseconds);
  });
}

/**
 * Normalizes path-like API route values.
 * @param path Relative route path.
 * @returns {string} Normalized route path with leading slash and no trailing slash.
 */
function normalizePath(path: string): string {
  const normalizedPath = path.trim();
  const prefixedPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  if (prefixedPath.length > 1 && prefixedPath.endsWith('/')) {
    return prefixedPath.slice(0, -1);
  }
  return prefixedPath;
}

/**
 * Normalizes topic suffix values for publish target topics.
 * @param suffix Topic suffix.
 * @returns {string} Normalized suffix with leading slash.
 */
function normalizeTopicSuffix(suffix: string): string {
  const trimmedSuffix = suffix.trim();
  if (trimmedSuffix.length === 0 || trimmedSuffix === '/') {
    throw new MessagePublishClientError('publish topic suffix config must not be empty', 'publishTopicSetSuffix', 0);
  }
  return trimmedSuffix.startsWith('/') ? trimmedSuffix : `/${trimmedSuffix}`;
}
