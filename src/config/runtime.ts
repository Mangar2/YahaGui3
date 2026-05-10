/**
 * Returns the runtime base URL for message-store calls.
 * @returns {string} Absolute base URL.
 */
export function getMessageStoreBaseUrl(): string {
  const envMap: Record<string, unknown> = import.meta.env;
  const envBaseUrl = envMap.VITE_MESSAGE_STORE_BASE_URL;
  if (typeof envBaseUrl === 'string' && envBaseUrl.length > 0) {
    return envBaseUrl;
  }
  return window.location.origin;
}
