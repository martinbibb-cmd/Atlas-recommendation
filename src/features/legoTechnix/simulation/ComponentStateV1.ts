import type {
  HeatSourceControlDemandStateV1,
  HeatSourceModulationStrategyV1,
} from '../types';

export const COMPONENT_OPERATING_MODES_V1 = [
  'idle',
  'running',
  'fault',
  'bypassed',
  'standby',
] as const;

export type ComponentOperatingModeV1 = (typeof COMPONENT_OPERATING_MODES_V1)[number];

export const CONTROL_ACTUATOR_POSITIONS_V1 = [
  'open',
  'closed',
] as const;

export type ControlActuatorPositionV1 = (typeof CONTROL_ACTUATOR_POSITIONS_V1)[number];

export interface ComponentStateV1 {
  readonly componentId: string;
  readonly isActive: boolean;
  readonly operatingMode: ComponentOperatingModeV1;
  readonly measuredTemperatureC?: number;
  readonly setpointTemperatureC?: number;
  readonly currentTemperatureC?: number;
  readonly targetTemperatureC?: number;
  readonly thermalMassKwhPerK?: number;
  readonly heatLossKwPerK?: number;
  readonly heatGainKw?: number;
  readonly heatLossKw?: number;
  readonly netHeatKw?: number;
  readonly volumeLitres?: number;
  readonly storedEnergyKwh?: number;
  readonly standingLossKw?: number;
  readonly usableHotWaterLitresAt40C?: number;
  readonly lastTransferKw?: number;
  readonly lastPrimaryInletTemperatureC?: number;
  readonly lastPrimaryOutletTemperatureC?: number;
  readonly lastSecondaryGainKw?: number;
  readonly nominalOutputKw?: number;
  readonly minStableOutputKw?: number;
  readonly maxOutputKw?: number;
  readonly targetFlowTemperatureC?: number;
  readonly returnTemperatureC?: number;
  readonly rampRateCPerSecond?: number;
  readonly modulationStrategy?: HeatSourceModulationStrategyV1;
  readonly controlDemandState?: HeatSourceControlDemandStateV1;
  readonly actuatorPosition?: ControlActuatorPositionV1;
  readonly condensingLikely?: boolean;
  readonly cyclingRisk?: boolean;
}
