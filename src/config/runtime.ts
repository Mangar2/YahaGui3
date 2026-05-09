/**
 * Returns the runtime base URL for message-store calls.
 * @returns Absolute base URL.
 */
export function getMessageStoreBaseUrl(): string {
  const envBaseUrl = import.meta.env.VITE_MESSAGE_STORE_BASE_URL;
  if (typeof envBaseUrl === 'string' && envBaseUrl.length > 0) {
    return envBaseUrl;
  }
  return window.location.origin;
}
