/**
 * Error thrown when file-store JSON communication fails.
 */
export class FileStoreJsonClientError extends Error {
  public readonly endpoint: string;
  public readonly status: number;

  /**
   * Creates one typed file-store client error.
   * @param message Human-readable error details.
   * @param endpoint Endpoint URL that failed.
   * @param status HTTP status code or 0 for non-HTTP failures.
   */
  public constructor(message: string, endpoint: string, status: number) {
    super(message);
    this.name = 'FileStoreJsonClientError';
    this.endpoint = endpoint;
    this.status = status;
  }
}

/**
 * Generic HTTP client for reading and storing JSON files via file-store endpoints.
 */
export class FileStoreJsonClient {
  private readonly baseUrl: string;

  /**
   * Creates one file-store JSON client.
   * @param baseUrl Absolute backend base URL.
   */
  public constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Reads one JSON file from file-store.
   * @param filename File name/path used by backend file-store.
   * @returns {Promise<unknown>} Parsed JSON payload.
   */
  public async readJsonFile(filename: string): Promise<unknown> {
    const endpoint = buildFileEndpoint(this.baseUrl, filename);
    const response = await fetch(endpoint, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new FileStoreJsonClientError(
        `file-store read failed with status ${String(response.status)}`,
        endpoint,
        response.status,
      );
    }

    let rawBody: unknown;
    try {
      rawBody = (await response.json()) as unknown;
    } catch {
      throw new FileStoreJsonClientError('file-store response is not valid JSON', endpoint, response.status);
    }

    return rawBody;
  }

  /**
   * Stores one JSON payload into file-store.
   * @param filename File name/path used by backend file-store.
   * @param payload JSON-serializable payload.
   * @returns {Promise<void>} Resolves on success.
   */
  public async storeJsonFile(filename: string, payload: unknown): Promise<void> {
    const endpoint = buildFileEndpoint(this.baseUrl, filename);
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
    throw new FileStoreJsonClientError(
      `file-store write failed with status ${String(response.status)}${details}`,
      endpoint,
      response.status,
    );
  }
}

/**
 * Builds one absolute endpoint URL for a file-store filename.
 * @param baseUrl Backend base URL.
 * @param filename File name/path handled by file-store.
 * @returns {string} Absolute endpoint URL.
 */
function buildFileEndpoint(baseUrl: string, filename: string): string {
  const normalizedFilename = normalizeFilename(filename);
  return new URL(normalizedFilename, baseUrl).toString();
}

/**
 * Normalizes filename-like route values.
 * @param filename Raw filename/path.
 * @returns {string} Normalized filename path.
 */
function normalizeFilename(filename: string): string {
  const trimmedFilename = filename.trim();
  if (trimmedFilename.length === 0) {
    throw new FileStoreJsonClientError('filename must not be empty', 'file-store-filename', 0);
  }

  const prefixedFilename = trimmedFilename.startsWith('/') ? trimmedFilename : `/${trimmedFilename}`;
  if (prefixedFilename.length > 1 && prefixedFilename.endsWith('/')) {
    return prefixedFilename.slice(0, -1);
  }

  return prefixedFilename;
}
