/**
 * Polling interval for the overview/main topic path refresh loop.
 * Used by useMessagePathController for periodic reloads.
 */
export const MAIN_REFRESH_INTERVAL_MS = 2000;

/**
 * Polling interval for the detail-topic refresh loop.
 * Used by useDetailTopicController for periodic detail reloads.
 */
export const DETAIL_REFRESH_INTERVAL_MS = 2000;

/**
 * Delay between two publish verification attempts.
 * Used by MessagePublishClient while polling message-store for the new value.
 */
export const PUBLISH_VERIFY_INTERVAL_MS = 700;

/**
 * Maximum total wait time for publish verification before timeout error.
 * Effective attempt count is derived from timeout / interval.
 */
export const PUBLISH_VERIFY_TIMEOUT_MS = 25 * 700;