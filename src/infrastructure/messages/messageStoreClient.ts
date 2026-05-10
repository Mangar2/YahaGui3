import { encodeTopicForPath } from '../../domain/messages/topicPath';
import type { MessageStoreDirectRequest, MessageStoreQueryOptions, MessageTopicData } from '../../domain/messages/interfaces';

interface MessageStorePayloadWrapper {
  payload: unknown;
}

/**
 * Error thrown when message-store communication fails.
 */
export class MessageStoreClientError extends Error {
  public readonly endpoint: string;
  public readonly status: number;

  /**
   * Creates a typed client error.
   * @param message Human-readable error details.
   * @param endpoint Endpoint path that failed.
   * @param status HTTP status code or 0 for non-HTTP failures.
   */
  public constructor(message: string, endpoint: string, status: number) {
    super(message);
    this.name = 'MessageStoreClientError';
    this.endpoint = endpoint;
    this.status = status;
  }
}

/**
 * HTTP client for loading and updating message topics via the message-store API.
 */
export class MessageStoreClient {
  private readonly baseUrl: string;
  private readonly storePath: string;

  /**
   * Creates a message-store client.
   * @param baseUrl Absolute base URL to the YAHA backend host.
  * @param storePath Relative path for the message-store API.
   */
  public constructor(baseUrl: string, storePath: string) {
    this.baseUrl = baseUrl;
    this.storePath = normalizePath(storePath);
  }

  /**
   * Loads the current section for a topic path via GET /store/<topic>.
   * @param topic Topic prefix path.
   * @param options Query behavior flags.
    * @returns {Promise<MessageTopicData[]>} Normalized payload list.
   */
  public async loadTopicSection(topic: string, options: MessageStoreQueryOptions): Promise<MessageTopicData[]> {
    const endpoint = this.buildStoreEndpoint(topic);
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        levelamount: String(options.levelAmount),
        history: options.history ? 'true' : 'false',
        reason: options.reason ? 'true' : 'false',
      },
    });

    return this.readPayloadResponse(response, endpoint);
  }

  /**
   * Refreshes a topic path via direct POST /store.
   * @param request Direct query object for message-store.
    * @returns {Promise<MessageTopicData[]>} Normalized payload list.
   */
  public async refreshTopicSection(request: MessageStoreDirectRequest): Promise<MessageTopicData[]> {
    const endpoint = new URL(this.storePath, this.baseUrl).toString();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    return this.readPayloadResponse(response, endpoint);
  }

  /**
   * Builds the GET endpoint for a topic path.
   * @param topic Topic path.
    * @returns {string} Absolute endpoint URL.
   */
  private buildStoreEndpoint(topic: string): string {
    const encodedTopic = encodeTopicForPath(topic);
    const endpoint = encodedTopic.length > 0 ? `${this.storePath}/${encodedTopic}` : this.storePath;
    return new URL(endpoint, this.baseUrl).toString();
  }

  /**
   * Reads and validates message-store payloads from GET/POST responses.
   * @param response Fetch response.
   * @param endpoint Endpoint that produced the response.
   * @returns {Promise<MessageTopicData[]>} Normalized list of message topics.
   */
  private async readPayloadResponse(response: Response, endpoint: string): Promise<MessageTopicData[]> {
    if (!response.ok) {
      throw new MessageStoreClientError(
        `message-store request failed with status ${String(response.status)}`,
        endpoint,
        response.status,
      );
    }

    let rawBody: unknown;
    try {
      rawBody = (await response.json()) as unknown;
    } catch {
      throw new MessageStoreClientError('message-store response is not valid JSON', endpoint, response.status);
    }

    return parseTopicPayload(rawBody, endpoint, response.status);
  }
}

/**
 * Parses mixed response shapes used by message-store GET and POST routes.
 * @param rawBody Raw JSON body.
 * @param endpoint Endpoint that returned the body.
 * @param status HTTP status code.
 * @returns {MessageTopicData[]} List of validated topic nodes.
 */
function parseTopicPayload(rawBody: unknown, endpoint: string, status: number): MessageTopicData[] {
  const directPayload = parsePayloadWrapper(rawBody);
  if (directPayload) {
    return parseTopicDataList(directPayload.payload, endpoint, status);
  }

  return parseTopicDataList(rawBody, endpoint, status);
}

/**
 * Detects payload wrapper objects.
 * @param rawBody Raw JSON body.
 * @returns {MessageStorePayloadWrapper | null} Wrapper object or null.
 */
function parsePayloadWrapper(rawBody: unknown): MessageStorePayloadWrapper | null {
  if (!isRecord(rawBody)) {
    return null;
  }
  if (!('payload' in rawBody)) {
    return null;
  }
  return { payload: rawBody.payload };
}

/**
 * Parses and validates a topic list.
 * @param rawPayload Unknown payload.
 * @param endpoint Endpoint context for errors.
 * @param status HTTP status code.
 * @returns {MessageTopicData[]} Strictly validated list.
 */
function parseTopicDataList(rawPayload: unknown, endpoint: string, status: number): MessageTopicData[] {
  if (!Array.isArray(rawPayload)) {
    throw new MessageStoreClientError('message-store payload is not an array', endpoint, status);
  }

  const result: MessageTopicData[] = [];
  let firstNodeError: MessageStoreClientError | null = null;
  for (const rawNode of rawPayload) {
    try {
      result.push(parseTopicDataNode(rawNode, endpoint, status));
    } catch (error: unknown) {
      if (error instanceof MessageStoreClientError && firstNodeError === null) {
        firstNodeError = error;
      }
    }
  }

  if (result.length === 0 && rawPayload.length > 0 && firstNodeError !== null) {
    throw firstNodeError;
  }

  return result;
}

/**
 * Parses one topic node.
 * @param rawNode Unknown node data.
 * @param endpoint Endpoint context for errors.
 * @param status HTTP status code.
 * @returns {MessageTopicData} Validated topic node.
 */
function parseTopicDataNode(rawNode: unknown, endpoint: string, status: number): MessageTopicData {
  if (!isRecord(rawNode)) {
    throw new MessageStoreClientError('message-store node is not an object', endpoint, status);
  }

  const topicValue = rawNode.topic;
  if (typeof topicValue !== 'string' || topicValue.length === 0) {
    throw new MessageStoreClientError('message-store node has no valid topic', endpoint, status);
  }

  const node: MessageTopicData = {
    topic: topicValue,
  };

  if ('value' in rawNode && isMessageScalar(rawNode.value)) {
    node.value = rawNode.value;
  }

  if (typeof rawNode.time === 'string') {
    node.time = rawNode.time;
  }

  if ('reason' in rawNode) {
    node.reason = parseReasonList(rawNode.reason, endpoint, status);
  }

  if ('history' in rawNode) {
    node.history = parseHistoryList(rawNode.history, endpoint, status);
  }

  return node;
}

/**
 * Parses reason entries.
 * @param rawReason Unknown reason payload.
 * @param endpoint Endpoint context for errors.
 * @param status HTTP status code.
 * @returns {{ timestamp: string; message: string }[]} Valid reason array.
 */
function parseReasonList(rawReason: unknown, endpoint: string, status: number): { timestamp: string; message: string }[] {
  if (!Array.isArray(rawReason)) {
    throw new MessageStoreClientError('reason payload must be an array', endpoint, status);
  }

  const result: { timestamp: string; message: string }[] = [];
  for (const reasonEntry of rawReason) {
    if (!isRecord(reasonEntry) || typeof reasonEntry.timestamp !== 'string' || typeof reasonEntry.message !== 'string') {
      throw new MessageStoreClientError('reason entry has invalid shape', endpoint, status);
    }
    result.push({ timestamp: reasonEntry.timestamp, message: reasonEntry.message });
  }
  return result;
}

/**
 * Parses history entries.
 * @param rawHistory Unknown history payload.
 * @param endpoint Endpoint context for errors.
 * @param status HTTP status code.
 * @returns {{ time?: string; value?: string | number | boolean | null; reason?: { timestamp: string; message: string }[] }[]} Valid history array.
 */
function parseHistoryList(
  rawHistory: unknown,
  endpoint: string,
  status: number,
): { time?: string; value?: string | number | boolean | null; reason?: { timestamp: string; message: string }[] }[] {
  if (!Array.isArray(rawHistory)) {
    throw new MessageStoreClientError('history payload must be an array', endpoint, status);
  }

  const result: { time?: string; value?: string | number | boolean | null; reason?: { timestamp: string; message: string }[] }[] = [];
  for (const historyEntry of rawHistory) {
    if (!isRecord(historyEntry)) {
      throw new MessageStoreClientError('history entry has invalid shape', endpoint, status);
    }

    const parsedEntry: { time?: string; value?: string | number | boolean | null; reason?: { timestamp: string; message: string }[] } = {};
    if (typeof historyEntry.time === 'string') {
      parsedEntry.time = historyEntry.time;
    }
    if ('value' in historyEntry && isMessageScalar(historyEntry.value)) {
      parsedEntry.value = historyEntry.value;
    }
    if ('reason' in historyEntry) {
      parsedEntry.reason = parseReasonList(historyEntry.reason, endpoint, status);
    }
    result.push(parsedEntry);
  }

  return result;
}

/**
 * Checks whether a value is a plain record.
 * @param value Candidate value.
 * @returns {value is Record<string, unknown>} True when value is object-like.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Checks whether a value can be represented as message value.
 * @param value Candidate message value.
 * @returns {value is string | number | boolean | null} True when value is supported.
 */
function isMessageScalar(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
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
