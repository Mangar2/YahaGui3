import type { YahaEnvironmentConfig } from './environment.types';

export const ENVIRONMENT: YahaEnvironmentConfig = {
  apiBaseUrl: 'http://192.168.0.183:80',
  messageStorePath: '/store',
  publishPath: '/publish',
  publishTopicSetSuffix: '/set',
};
