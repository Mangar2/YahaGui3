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
 * Default number of publish verification attempts.
 * Legacy detail behavior uses 15 polling attempts.
 */
export const PUBLISH_VERIFY_ATTEMPTS = 15;