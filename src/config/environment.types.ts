export interface YahaEnvironmentConfig {
  apiBaseUrl: string;
  messageStorePath: string;
  publishPath: string;
  publishTopicSetSuffix: string;
}

export type EnvironmentProfile = 'development' | 'test' | 'production';
