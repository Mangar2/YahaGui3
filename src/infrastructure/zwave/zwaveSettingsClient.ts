import type { ZwaveDeviceMapping, ZwaveSettingsPayload } from '../../domain/zwave/interfaces';
import { FileStoreJsonClient, FileStoreJsonClientError } from '../filestore/fileStoreJsonClient';

/**
 * Error thrown when zwave-settings communication fails.
 */
export class ZwaveSettingsClientError extends Error {
  public readonly endpoint: string;
  public readonly status: number;

  /**
   * Creates one typed zwave-settings client error.
   * @param message Human-readable error details.
   * @param endpoint Endpoint URL that failed.
   * @param status HTTP status code or 0 for non-HTTP failures.
   */
  public constructor(message: string, endpoint: string, status: number) {
    super(message);
    this.name = 'ZwaveSettingsClientError';
    this.endpoint = endpoint;
    this.status = status;
  }
}

/**
 * HTTP client for loading and storing zwave device-topic mappings.
 */
export class ZwaveSettingsClient {
  private readonly fileStoreClient: FileStoreJsonClient;
  private readonly settingsFilename: string;

  /**
   * Creates a zwave-settings API client.
   * @param baseUrl Absolute backend base URL.
   * @param settingsFilename File-store filename for zwave settings payload.
   */
  public constructor(baseUrl: string, settingsFilename: string) {
    this.fileStoreClient = new FileStoreJsonClient(baseUrl);
    this.settingsFilename = settingsFilename;
  }

  /**
   * Reads zwave settings payload from backend.
   * @returns {Promise<ZwaveSettingsPayload>} Validated zwave settings payload.
   */
  public async readSettings(): Promise<ZwaveSettingsPayload> {
    try {
      const rawBody = await this.fileStoreClient.readJsonFile(this.settingsFilename);
      return parseZwaveSettingsPayload(rawBody);
    } catch (error: unknown) {
      throw toZwaveSettingsClientError(error, `cannot read zwave settings file '${this.settingsFilename}'`);
    }
  }

  /**
   * Stores zwave settings payload to backend.
   * @param payload Zwave settings payload to store.
   * @returns {Promise<void>} Resolves on success.
   */
  public async storeSettings(payload: ZwaveSettingsPayload): Promise<void> {
    try {
      await this.fileStoreClient.storeJsonFile(this.settingsFilename, payload);
    } catch (error: unknown) {
      throw toZwaveSettingsClientError(error, `cannot store zwave settings file '${this.settingsFilename}'`);
    }
  }
}

/**
 * Parses one zwave settings payload from unknown JSON body.
 * @param rawBody Raw JSON payload.
 * @returns {ZwaveSettingsPayload} Validated zwave settings payload.
 */
function parseZwaveSettingsPayload(rawBody: unknown): ZwaveSettingsPayload {
  if (!isRecord(rawBody)) {
    throw new ZwaveSettingsClientError('zwave settings payload must be an object', 'zwave-settings-payload', 0);
  }

  const rawDevices = rawBody.devices;
  if (!Array.isArray(rawDevices)) {
    throw new ZwaveSettingsClientError('zwave settings payload.devices must be an array', 'zwave-settings-payload', 0);
  }

  const devices = rawDevices.map((entry: unknown, index: number): ZwaveDeviceMapping => {
    return parseDeviceMapping(entry, index);
  });

  return { devices };
}

/**
 * Parses one device mapping entry.
 * @param entry Raw entry value.
 * @param index Device index for error context.
 * @returns {ZwaveDeviceMapping} Validated and normalized device mapping.
 */
function parseDeviceMapping(entry: unknown, index: number): ZwaveDeviceMapping {
  if (!isRecord(entry)) {
    throw new ZwaveSettingsClientError(
      `zwave devices[${String(index)}] must be an object`,
      'zwave-settings-payload',
      0,
    );
  }

  const topic = parseRequiredText(entry.topic, `zwave devices[${String(index)}].topic`);

  const parsed: ZwaveDeviceMapping = {
    topic,
  };

  const nodeId = parseOptionalInteger(entry.nodeId, `zwave devices[${String(index)}].nodeId`);
  if (typeof nodeId === 'number') {
    parsed.nodeId = nodeId;
  }

  const classId = parseOptionalInteger(entry.classId, `zwave devices[${String(index)}].classId`);
  if (typeof classId === 'number') {
    parsed.classId = classId;
  }

  const instance = parseOptionalInteger(entry.instance, `zwave devices[${String(index)}].instance`);
  if (typeof instance === 'number') {
    parsed.instance = instance;
  }

  const type = parseOptionalText(entry.type, `zwave devices[${String(index)}].type`);
  if (typeof type === 'string') {
    parsed.type = type;
  }

  return parsed;
}

/**
 * Parses one required text field.
 * @param value Raw field value.
 * @param fieldLabel Field label for error context.
 * @returns {string} Trimmed non-empty text.
 */
function parseRequiredText(value: unknown, fieldLabel: string): string {
  if (typeof value !== 'string') {
    throw new ZwaveSettingsClientError(`${fieldLabel} must be a string`, 'zwave-settings-payload', 0);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ZwaveSettingsClientError(`${fieldLabel} must not be empty`, 'zwave-settings-payload', 0);
  }

  return trimmed;
}

/**
 * Parses one optional text field.
 * @param value Raw field value.
 * @param fieldLabel Field label for error context.
 * @returns {string | undefined} Trimmed text or undefined when omitted/empty.
 */
function parseOptionalText(value: unknown, fieldLabel: string): string | undefined {
  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ZwaveSettingsClientError(`${fieldLabel} must be a string when provided`, 'zwave-settings-payload', 0);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Parses one optional integer field.
 * @param value Raw field value.
 * @param fieldLabel Field label for error context.
 * @returns {number | undefined} Integer value or undefined when omitted.
 */
function parseOptionalInteger(value: unknown, fieldLabel: string): number | undefined {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ZwaveSettingsClientError(`${fieldLabel} must be an integer when provided`, 'zwave-settings-payload', 0);
  }

  if (value < 0) {
    throw new ZwaveSettingsClientError(`${fieldLabel} must be >= 0`, 'zwave-settings-payload', 0);
  }

  return value;
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
 * Converts unknown errors into typed zwave-settings errors.
 * @param error Unknown thrown value.
 * @param fallbackMessage Fallback message used for unknown errors.
 * @returns {ZwaveSettingsClientError} Typed zwave-settings error.
 */
function toZwaveSettingsClientError(error: unknown, fallbackMessage: string): ZwaveSettingsClientError {
  if (error instanceof ZwaveSettingsClientError) {
    return error;
  }

  if (error instanceof FileStoreJsonClientError) {
    return new ZwaveSettingsClientError(error.message, error.endpoint, error.status);
  }

  if (error instanceof Error) {
    return new ZwaveSettingsClientError(error.message, 'zwave-settings-client', 0);
  }

  return new ZwaveSettingsClientError(fallbackMessage, 'zwave-settings-client', 0);
}
