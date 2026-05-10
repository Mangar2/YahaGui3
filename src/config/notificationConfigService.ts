export type SnackbarSeverity = 'info' | 'success' | 'warning' | 'error';

interface SnackbarDurationConfig {
  infoMs: number;
  successMs: number;
  warningMs: number;
  errorMs: number;
}

const DEFAULT_SNACKBAR_DURATION_CONFIG: SnackbarDurationConfig = {
  infoMs: 15000,
  successMs: 15000,
  warningMs: 20000,
  errorMs: 20000,
};

let durationOverrides: Partial<SnackbarDurationConfig> = {};

/**
 * Returns snackbar visibility duration for one severity.
 * @param severity Notification severity.
 * @returns {number} Duration in milliseconds.
 */
export function getSnackbarDurationMs(severity: SnackbarSeverity): number {
  const config = getSnackbarDurationConfig();
  if (severity === 'info') {
    return config.infoMs;
  }
  if (severity === 'success') {
    return config.successMs;
  }
  if (severity === 'warning') {
    return config.warningMs;
  }
  return config.errorMs;
}

/**
 * Returns effective snackbar duration config with overrides.
 * @returns {SnackbarDurationConfig} Effective configuration.
 */
export function getSnackbarDurationConfig(): SnackbarDurationConfig {
  return {
    infoMs: durationOverrides.infoMs ?? DEFAULT_SNACKBAR_DURATION_CONFIG.infoMs,
    successMs: durationOverrides.successMs ?? DEFAULT_SNACKBAR_DURATION_CONFIG.successMs,
    warningMs: durationOverrides.warningMs ?? DEFAULT_SNACKBAR_DURATION_CONFIG.warningMs,
    errorMs: durationOverrides.errorMs ?? DEFAULT_SNACKBAR_DURATION_CONFIG.errorMs,
  };
}

/**
 * Sets runtime overrides for snackbar durations.
 * This is the future extension point for a UI-based configuration screen.
 * @param overrides Partial duration overrides in milliseconds.
 */
export function setSnackbarDurationOverrides(overrides: Partial<SnackbarDurationConfig>): void {
  durationOverrides = {
    ...durationOverrides,
    ...sanitizeDurationOverrides(overrides),
  };
}

/**
 * Resets runtime overrides to default durations.
 */
export function resetSnackbarDurationOverrides(): void {
  durationOverrides = {};
}

/**
 * Validates and normalizes override values.
 * @param overrides Raw override values.
 * @returns {Partial<SnackbarDurationConfig>} Valid override values.
 */
function sanitizeDurationOverrides(overrides: Partial<SnackbarDurationConfig>): Partial<SnackbarDurationConfig> {
  const sanitized: Partial<SnackbarDurationConfig> = {};

  if (isPositiveDuration(overrides.infoMs)) {
    sanitized.infoMs = overrides.infoMs;
  }
  if (isPositiveDuration(overrides.successMs)) {
    sanitized.successMs = overrides.successMs;
  }
  if (isPositiveDuration(overrides.warningMs)) {
    sanitized.warningMs = overrides.warningMs;
  }
  if (isPositiveDuration(overrides.errorMs)) {
    sanitized.errorMs = overrides.errorMs;
  }

  return sanitized;
}

/**
 * Checks whether a duration value is valid.
 * @param value Candidate value.
 * @returns {value is number} True when value is a finite positive number.
 */
function isPositiveDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
