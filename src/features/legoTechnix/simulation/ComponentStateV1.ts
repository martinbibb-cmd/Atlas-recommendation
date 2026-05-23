import type {
  HeatSourceControlDemandStateV1,
  HeatSourceModulationStrategyV1,
} from '../types';
import type { LegoTechnixConfidence } from '../confidence';

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

export const STORED_WATER_STORAGE_MODELS_V1 = [
  'mixed',
  'stratified',
] as const;

export type StoredWaterStorageModelV1 = (typeof STORED_WATER_STORAGE_MODELS_V1)[number];

export const STORED_WATER_CHARGING_MODES_V1 = [
  'top_down',
  'bottom_coil',
  'mixed',
] as const;

export type StoredWaterChargingModeV1 = (typeof STORED_WATER_CHARGING_MODES_V1)[number];

export interface StratificationLayerStateV1 {
  readonly layerIndex: number;
  readonly volumeLitres: number;
  readonly temperatureC: number;
  readonly usableAtTargetTemperature: boolean;
  readonly confidence: LegoTechnixConfidence;
}

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
  readonly usableTopLayerHotWaterLitresAt40C?: number;
  readonly storageModel?: StoredWaterStorageModelV1;
  readonly chargingMode?: StoredWaterChargingModeV1;
  readonly stratificationLayers?: readonly StratificationLayerStateV1[];
  readonly lastTransferKw?: number;
  readonly lastPrimaryInletTemperatureC?: number;
  readonly lastPrimaryOutletTemperatureC?: number;
  readonly lastSecondaryGainKw?: number;
  readonly primaryCoilInletTemperatureC?: number;
  readonly primaryCoilOutletTemperatureC?: number;
  readonly lastRecoveryKw?: number;
  readonly radiatorPrimaryReturnTemperatureC?: number;
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
