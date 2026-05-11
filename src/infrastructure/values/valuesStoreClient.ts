import type { ValueStorePayload, ValueStoreScalar } from '../../domain/values/interfaces';
import { FileStoreJsonClient, FileStoreJsonClientError } from '../filestore/fileStoreJsonClient';

/**
 * Error thrown when values-store communication fails.
 */
export class ValuesStoreClientError extends Error {
  public readonly endpoint: string;
  public readonly status: number;

  /**
   * Creates one typed values-store client error.
   * @param message Human-readable error details.
   * @param endpoint Endpoint URL that failed.
   * @param status HTTP status code or 0 for non-HTTP failures.
   */
  public constructor(message: string, endpoint: string, status: number) {
    super(message);
    this.name = 'ValuesStoreClientError';
    this.endpoint = endpoint;
    this.status = status;
  }
}

/**
 * HTTP client for loading and storing values-store key/value pairs.
 */
export class ValuesStoreClient {
  private readonly fileStoreClient: FileStoreJsonClient;
  private readonly valuesFilename: string;

  /**
   * Creates a values-store API client.
   * @param baseUrl Absolute backend base URL.
   * @param valuesFilename File-store filename for values payload.
   */
  public constructor(baseUrl: string, valuesFilename: string) {
    this.fileStoreClient = new FileStoreJsonClient(baseUrl);
    this.valuesFilename = valuesFilename;
  }

  /**
   * Reads values-store payload from backend.
   * @returns {Promise<ValueStorePayload>} Validated values payload.
   */
  public async readValues(): Promise<ValueStorePayload> {
    try {
      const rawBody = await this.fileStoreClient.readJsonFile(this.valuesFilename);
      return parseValuesStorePayload(rawBody);
    } catch (error: unknown) {
      throw toValuesStoreClientError(error, `cannot read values file '${this.valuesFilename}'`);
    }
  }

  /**
   * Stores values-store payload to backend.
   * @param payload Values payload to store.
   * @returns {Promise<void>} Resolves on success.
   */
  public async storeValues(payload: ValueStorePayload): Promise<void> {
    try {
      await this.fileStoreClient.storeJsonFile(this.valuesFilename, payload);
    } catch (error: unknown) {
      throw toValuesStoreClientError(error, `cannot store values file '${this.valuesFilename}'`);
    }
  }
}

/**
 * Parses one values-store payload from unknown JSON body.
 * @param rawBody Raw JSON payload.
 * @returns {ValueStorePayload} Validated values payload.
 */
function parseValuesStorePayload(rawBody: unknown): ValueStorePayload {
  if (!isRecord(rawBody)) {
    throw new ValuesStoreClientError('values payload must be an object', 'values-store-payload', 0);
  }

  const result: ValueStorePayload = {};
  for (const [topic, rawValue] of Object.entries(rawBody)) {
    if (topic.trim().length === 0) {
      throw new ValuesStoreClientError('values payload contains empty key', 'values-store-payload', 0);
    }

    if (!isValueStoreScalar(rawValue)) {
      throw new ValuesStoreClientError(
        `values payload key '${topic}' has invalid value type`,
        'values-store-payload',
        0,
      );
    }

    result[topic] = rawValue;
  }

  return result;
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
 * Checks whether a value is allowed in values-store payload.
 * @param value Candidate value.
 * @returns {value is ValueStoreScalar} True when scalar is valid.
 */
function isValueStoreScalar(value: unknown): value is ValueStoreScalar {
  if (typeof value === 'string') {
    return true;
  }

  if (typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  return value === null;
}

/**
 * Converts unknown errors into typed values-store errors.
 * @param error Unknown thrown value.
 * @param fallbackMessage Fallback message used for unknown errors.
 * @returns {ValuesStoreClientError} Typed values-store error.
 */
function toValuesStoreClientError(error: unknown, fallbackMessage: string): ValuesStoreClientError {
  if (error instanceof ValuesStoreClientError) {
    return error;
  }

  if (error instanceof FileStoreJsonClientError) {
    return new ValuesStoreClientError(error.message, error.endpoint, error.status);
  }

  if (error instanceof Error) {
    return new ValuesStoreClientError(error.message, 'values-store-client', 0);
  }

  return new ValuesStoreClientError(fallbackMessage, 'values-store-client', 0);
}
