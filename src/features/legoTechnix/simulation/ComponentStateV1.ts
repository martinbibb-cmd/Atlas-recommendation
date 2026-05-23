export const COMPONENT_OPERATING_MODES_V1 = [
  'idle',
  'running',
  'fault',
  'bypassed',
  'standby',
] as const;

export type ComponentOperatingModeV1 = (typeof COMPONENT_OPERATING_MODES_V1)[number];

export interface ComponentStateV1 {
  readonly componentId: string;
  readonly isActive: boolean;
  readonly operatingMode: ComponentOperatingModeV1;
  readonly measuredTemperatureC?: number;
  readonly setpointTemperatureC?: number;
}
