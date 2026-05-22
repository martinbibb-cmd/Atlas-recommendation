import type { LegoTechnixBehaviour } from './behaviours';
import type { LegoTechnixConfidence } from './confidence';
import type { LegoTechnixDomain } from './domains';
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

export interface HydraulicDomainV1 {
  id: string;
  pressureRegime: HydraulicPressureRegimeV1;
  openToAtmosphere: boolean;
  minStaticHeadM?: number;
  availableStaticHeadM?: number;
  nominalColdPressureBar?: number;
  maxSafePressureBar?: number;
  requiresExpansionAccommodation: boolean;
  manufacturerRequirementSource?: string;
  confidence: LegoTechnixConfidence;
}

export interface LegoTechnixGraphV1 {
  id: string;
  label: string;
  confidence: LegoTechnixConfidence;
  components: LegoTechnixComponentV1[];
  connections: LegoTechnixConnectionV1[];
  hydraulicDomains?: HydraulicDomainV1[];
}
