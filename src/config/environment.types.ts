export interface YahaEnvironmentConfig {
  apiBaseUrl: string;
  messageStorePath: string;
  publishPath: string;
  publishTopicSetSuffix: string;
  configStorePath: string;
}

export type EnvironmentProfile = 'development' | 'test' | 'production';
