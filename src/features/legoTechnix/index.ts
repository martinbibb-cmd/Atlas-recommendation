export { LEGO_TECHNIX_BEHAVIOURS } from './behaviours';
export type { LegoTechnixBehaviour } from './behaviours';

export { LEGO_TECHNIX_CONFIDENCE } from './confidence';
export type { LegoTechnixConfidence } from './confidence';

export { LEGO_TECHNIX_DOMAINS } from './domains';
export type { LegoTechnixDomain } from './domains';

export { LEGO_TECHNIX_COMPONENT_ROLES } from './roles';
export type { LegoTechnixComponentRole } from './roles';

export {
  HYDRAULIC_PRESSURE_REGIMES_V1,
  HYDRAULIC_PRE_FLIGHT_MARKERS_V1,
  LEGO_TECHNIX_PORT_DIRECTIONS,
} from './types';

export type {
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
} from './types';

export type {
  LegoTechnixValidationIssueV1,
  LegoTechnixValidationResultV1,
} from './validation';

export { validateLegoTechnixGraphV1 } from './validation';

export { simpleRegularBoilerGraph } from './fixtures/simpleRegularBoilerGraph';
