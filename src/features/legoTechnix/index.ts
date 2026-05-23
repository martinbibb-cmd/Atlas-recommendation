export { LEGO_TECHNIX_BEHAVIOURS } from './behaviours';
export type { LegoTechnixBehaviour } from './behaviours';

export { LEGO_TECHNIX_CONFIDENCE } from './confidence';
export type { LegoTechnixConfidence } from './confidence';

export { LEGO_TECHNIX_DOMAINS } from './domains';
export type { LegoTechnixDomain } from './domains';

export { INSULATION_STATES_V1 } from './insulationState';
export type { InsulationStateV1 } from './insulationState';

export {
  deriveWaterVolumeLitres,
  isWaterCarryingDomain,
  sumHydraulicDomainEdgeVolumes,
} from './hydraulicConnectionEdge';

export { LEGO_TECHNIX_COMPONENT_ROLES } from './roles';
export type { LegoTechnixComponentRole } from './roles';

export {
  HEAT_TRANSFER_COMPONENT_FAMILIES_V1,
  HYDRAULIC_PRESSURE_REGIMES_V1,
  HYDRAULIC_PRE_FLIGHT_MARKERS_V1,
  LEGO_TECHNIX_PORT_DIRECTIONS,
  SECONDARY_THERMAL_MEDIUMS_V1,
} from './types';

export type {
  EnergyTransferResultV1,
  HeatTransferComponentFamilyV1,
  HeatTransferComponentV1,
  HeatTransferInputV1,
  HeatTransferOutputV1,
  LegoTechnixActiveCircuitPathV1,
  LegoTechnixCircuitDefinitionV1,
  HydraulicDomainV1,
  HydraulicPreFlightMarkerV1,
  HydraulicPressureRegimeV1,
  LegoTechnixComponentV1,
  LegoTechnixConnectionPhysicalV1,
  LegoTechnixConnectionV1,
  LegoTechnixGraphV1,
  LegoTechnixPortDirection,
  LegoTechnixPortV1,
  PrimaryFluidStateV1,
  SecondaryThermalMediumV1,
  SecondaryThermalStateV1,
} from './types';

export type {
  LegoTechnixValidationIssueV1,
  LegoTechnixValidationResultV1,
} from './validation';

export { validateLegoTechnixGraphV1 } from './validation';

export { simpleRegularBoilerGraph } from './fixtures/simpleRegularBoilerGraph';
