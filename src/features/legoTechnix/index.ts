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
  CONTROL_ACTUATOR_CHANNELS_V1,
  CONTROL_LOGIC_KINDS_V1,
  CONTROL_SENSOR_KINDS_V1,
  HEAT_SOURCE_CONTROL_DEMAND_STATES_V1,
  HEAT_SOURCE_MODULATION_STRATEGIES_V1,
  HYDRAULIC_PRESSURE_REGIMES_V1,
  HYDRAULIC_PRE_FLIGHT_MARKERS_V1,
  LEGO_TECHNIX_PORT_DIRECTIONS,
  SECONDARY_THERMAL_MEDIUMS_V1,
} from './types';

export type {
  ControlActuatorChannelV1,
  ControlActuatorV1,
  ControlLogicKindV1,
  ControlLogicV1,
  ControlSensorKindV1,
  ControlSensorV1,
  EnergyTransferResultV1,
  HeatTransferComponentFamilyV1,
  HeatTransferComponentV1,
  HeatSourceControlDemandStateV1,
  HeatSourceModelV1,
  HeatSourceModulationStrategyV1,
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

export {
  simpleRegularBoilerGraph,
  simpleRegularBoilerInitialStateV1,
} from './fixtures/simpleRegularBoilerGraph';

export { COMPONENT_OPERATING_MODES_V1 } from './simulation';
export type {
  ActivePathResolutionReasonV1,
  ActivePathResolutionV1,
  ComponentOperatingModeV1,
  ComponentStateV1,
  ControlEvaluationResultV1,
  DomesticDrawOffDemandV1,
  DomainStateV1,
  EdgeFlowEstimateV1,
  EdgeStateV1,
  FlowRiskBandV1,
  HeatTransferComponentTickStateV1,
  HeatTransferEvaluationResultV1,
  HeatSourceEvaluationResultV1,
  LegoTechnixSimulationEventV1,
  LegoTechnixSimulationStateV1,
  LegoTechnixSimulationWarningV1,
  LegoTechnixTickInputV1,
  LegoTechnixTickResultV1,
  ScenarioActiveBranchV1,
  ScenarioControlOverrideEventV1,
  ScenarioDhwDrawOffEventV1,
  ScenarioInputV1,
  ScenarioOutsideTemperatureChangeEventV1,
  ScenarioResultV1,
  ScenarioSampleSelectorsV1,
  ScenarioScheduledEventV1,
  ScenarioThermostatChangeEventV1,
  ScenarioTimelineSampleV1,
  MassFlowAllocationResultV1,
  PipeEdgeEvaluationResultV1,
  ResolvedActivePathV1,
  ThermalIntegrationResultV1,
} from './simulation';
export {
  ACTIVE_PATH_REASONS_V1,
  FLOW_RISK_BANDS_V1,
  allocateMassFlowV1,
  evaluateControlsV1,
  evaluatePipeEdgesV1,
  evaluateHeatTransfersV1,
  evaluateHeatSourcesV1,
  integrateThermalStateV1,
  resolveActivePathsV1,
  runLegoTechnixScenarioV1,
  runLegoTechnixTickV1,
} from './simulation';
