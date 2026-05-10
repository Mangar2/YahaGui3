import { ENVIRONMENT as DEVELOPMENT_ENVIRONMENT } from './environment.development';
import { ENVIRONMENT as PRODUCTION_ENVIRONMENT } from './environment.production';
import { ENVIRONMENT as TEST_ENVIRONMENT } from './environment.test';
import type { EnvironmentProfile, YahaEnvironmentConfig } from './environment.types';

export type { EnvironmentProfile, YahaEnvironmentConfig } from './environment.types';

const BUILD_MODE = normalizeBuildMode(import.meta.env.MODE);

/**
 * Build-time selected environment profile, controlled by Vite mode.
 */
export const ACTIVE_ENVIRONMENT_PROFILE: EnvironmentProfile = BUILD_MODE;

/**
 * Build-time selected environment configuration.
 */
export const ENVIRONMENT: YahaEnvironmentConfig = selectEnvironmentByProfile(BUILD_MODE);

/**
 * Normalizes Vite mode values to known profile names.
 * @param mode Current Vite mode string.
 * @returns {EnvironmentProfile} Normalized profile.
 */
function normalizeBuildMode(mode: string): EnvironmentProfile {
  if (mode === 'development' || mode === 'test' || mode === 'production') {
    return mode;
  }
  return 'production';
}

/**
 * Returns the environment configuration for one profile.
 * @param profile Normalized environment profile.
 * @returns {YahaEnvironmentConfig} Environment config for the profile.
 */
function selectEnvironmentByProfile(profile: EnvironmentProfile): YahaEnvironmentConfig {
  if (profile === 'development') {
    return DEVELOPMENT_ENVIRONMENT;
  }
  if (profile === 'test') {
    return TEST_ENVIRONMENT;
  }
  return PRODUCTION_ENVIRONMENT;
}
