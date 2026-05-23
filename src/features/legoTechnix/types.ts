import type { LegoTechnixBehaviour } from './behaviours';
import type { LegoTechnixConfidence } from './confidence';
import type { LegoTechnixDomain } from './domains';
import type { InsulationStateV1 } from './insulationState';
import type { LegoTechnixComponentRole } from './roles';

export const LEGO_TECHNIX_PORT_DIRECTIONS = [
  'in',
  'out',
  'bidirectional',
  'control_in',
  'control_out',
] as const;

export type LegoTechnixPortDirection = (typeof LEGO_TECHNIX_PORT_DIRECTIONS)[number];

export const HYDRAULIC_PRESSURE_REGIMES_V1 = [
  'open_vented_primary',
  'sealed_primary',
  'mains_pressure_dhw',
  'tank_fed_dhw',
  'thermal_store_primary',
  'separated_secondary_circuit',
] as const;

export type HydraulicPressureRegimeV1 = (typeof HYDRAULIC_PRESSURE_REGIMES_V1)[number];

export const HYDRAULIC_PRE_FLIGHT_MARKERS_V1 = [
  'combined_feed_vent',
  'separate_feed',
  'separate_vent',
  'pump_feed_vent_order_valid',
  'pump_feed_vent_order_invalid',
  'primary_pressure_relief_valve',
  'primary_pressure_gauge',
  'primary_filling_loop',
  'primary_filling_key',
  'primary_auto_fill',
  'g3_expansion_accommodation',
  'g3_pressure_relief_chain',
  'g3_tp_relief',
  'g3_d1_d2_discharge_route',
] as const;

export type HydraulicPreFlightMarkerV1 = (typeof HYDRAULIC_PRE_FLIGHT_MARKERS_V1)[number];

export interface LegoTechnixPortV1 {
  id: string;
  label: string;
  domain: LegoTechnixDomain;
  direction: LegoTechnixPortDirection;
  allowedConnectionDomains: LegoTechnixDomain[];
  required: boolean;
  description: string;
}

export interface LegoTechnixComponentV1 {
  id: string;
  label: string;
  domains?: LegoTechnixDomain[];
  role?: LegoTechnixComponentRole;
  behaviours?: LegoTechnixBehaviour[];
  ports: LegoTechnixPortV1[];
  confidence?: LegoTechnixConfidence;
  stateOwnerId?: string;
}

export interface LegoTechnixConnectionPhysicalV1 {
  lengthM?: number;
  nominalDiameterMm?: number;
  internalDiameterMm?: number;
  waterVolumeLitres?: number;
  estimatedResistanceIndex?: number;
  routingConfidence?: LegoTechnixConfidence;
  insulationState?: InsulationStateV1;
  /** Domain id of the ambient environment the pipe passes through (e.g. outside_environment, room_air). */
  ambientDomainId?: string;
  /** Steady-state heat loss per metre of pipe run at design conditions (W/m). */
  simpleHeatLossWPerM?: number;
}

export interface LegoTechnixConnectionV1 {
  id: string;
  sourceComponentId: string;
  sourcePortId: string;
  targetComponentId: string;
  targetPortId: string;
  domain: LegoTechnixDomain;
  circuitId: string;
  direction: LegoTechnixPortDirection;
  confidence: LegoTechnixConfidence;
  physical: LegoTechnixConnectionPhysicalV1;
}

export interface LegoTechnixCircuitDefinitionV1 {
  id: string;
  label: string;
  domain: LegoTechnixDomain;
  description: string;
  sourceRole?: LegoTechnixComponentRole;
  sinkRole?: LegoTechnixComponentRole;
}

export interface LegoTechnixActiveCircuitPathV1 {
  id: string;
  label: string;
  domain: LegoTechnixDomain;
  sourceComponentId: string;
  sinkComponentId: string;
  circuitIds: string[];
  forwardConnectionIds: string[];
  returnConnectionIds?: string[];
  description: string;
}

export interface HydraulicDomainV1 {
  id: string;
  pressureRegime: HydraulicPressureRegimeV1;
  preFlightMarkers?: HydraulicPreFlightMarkerV1[];
  openToAtmosphere: boolean;
  minStaticHeadM?: number;
  availableStaticHeadM?: number;
  nominalColdPressureBar?: number;
  maxSafePressureBar?: number;
  requiresExpansionAccommodation: boolean;
  manufacturerRequirementSource?: string;
  confidence: LegoTechnixConfidence;
}

export const HEAT_TRANSFER_COMPONENT_FAMILIES_V1 = [
  'radiator',
  'ufh',
  'towel_rail',
  'cylinder_coil',
  'plate_hex',
  'thermal_store_hex',
] as const;

export type HeatTransferComponentFamilyV1 = (typeof HEAT_TRANSFER_COMPONENT_FAMILIES_V1)[number];

export const SECONDARY_THERMAL_MEDIUMS_V1 = [
  'room_air',
  'stored_domestic_water',
  'moving_fluid',
  'thermal_store',
] as const;

export type SecondaryThermalMediumV1 = (typeof SECONDARY_THERMAL_MEDIUMS_V1)[number];

export interface PrimaryFluidStateV1 {
  domain: LegoTechnixDomain;
  isMovingFluid: boolean;
  inletTemperatureC?: number;
  outletTemperatureC?: number;
  massFlowKgPerS?: number;
}

export interface SecondaryThermalStateV1 {
  domain: LegoTechnixDomain;
  medium: SecondaryThermalMediumV1;
  isMovingFluid: boolean;
  inletTemperatureC?: number;
  outletTemperatureC?: number;
}

export interface EnergyTransferResultV1 {
  primaryEnergyRemovedKw: number;
  secondaryEnergyGainedKw: number;
  declaredLossesKw?: number;
}

export interface HeatTransferInputV1 {
  primary: PrimaryFluidStateV1;
  secondary: SecondaryThermalStateV1;
  timestepSeconds?: number;
}

export interface HeatTransferOutputV1 {
  energyTransfer: EnergyTransferResultV1;
}

export interface HeatTransferComponentV1 {
  id: string;
  componentId: string;
  family: HeatTransferComponentFamilyV1;
  primaryDomain: LegoTechnixDomain;
  secondaryDomain: LegoTechnixDomain;
  input: HeatTransferInputV1;
  output: HeatTransferOutputV1;
  notes?: string;
}

export const HEAT_SOURCE_MODULATION_STRATEGIES_V1 = [
  'load_tracking',
  'fixed_flow_target',
] as const;

export type HeatSourceModulationStrategyV1 = (typeof HEAT_SOURCE_MODULATION_STRATEGIES_V1)[number];

export const HEAT_SOURCE_CONTROL_DEMAND_STATES_V1 = [
  'none',
  'demanding',
] as const;

export type HeatSourceControlDemandStateV1 = (typeof HEAT_SOURCE_CONTROL_DEMAND_STATES_V1)[number];

export interface HeatSourceModelV1 {
  id: string;
  componentId: string;
  primaryDomain: LegoTechnixDomain;
  nominalOutputKw: number;
  minStableOutputKw: number;
  maxOutputKw: number;
  targetFlowTemperatureC: number;
  returnTemperatureC?: number;
  rampRateCPerSecond: number;
  modulationStrategy: HeatSourceModulationStrategyV1;
  controlDemandState?: HeatSourceControlDemandStateV1;
  condensingLikely?: boolean;
  cyclingRisk?: boolean;
}

export interface LegoTechnixGraphV1 {
  id: string;
  label: string;
  confidence: LegoTechnixConfidence;
  components: LegoTechnixComponentV1[];
  connections: LegoTechnixConnectionV1[];
  circuitRegistry?: LegoTechnixCircuitDefinitionV1[];
  activeCircuitPaths?: LegoTechnixActiveCircuitPathV1[];
  hydraulicDomains?: HydraulicDomainV1[];
  heatTransferComponents?: HeatTransferComponentV1[];
  heatSourceModels?: HeatSourceModelV1[];
}
