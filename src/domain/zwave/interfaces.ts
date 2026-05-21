export interface ZwaveDeviceMapping {
  topic: string;
  nodeId?: number;
  classId?: number;
  instance?: number;
  type?: string;
}

export interface ZwaveSettingsPayload {
  devices: ZwaveDeviceMapping[];
}
