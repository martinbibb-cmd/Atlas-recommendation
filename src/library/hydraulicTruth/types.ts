import type { VisualTopologyId } from '../visualTopologies/visualTopologyRegistry';

export type HydraulicRuleCategory =
  | 'component_placement'
  | 'flow_return'
  | 'close_coupling'
  | 'pressure'
  | 'stratification'
  | 'potable_primary_separation'
  | 'g3_safety_routing'
  | 'pump_placement'
  | 'abv_placement'
  | 'magnetic_filter_placement'
  | 'filling_loop';

export type HydraulicQaFlag =
  | 'hydraulically_implausible'
  | 'visually_confusing'
  | 'regulation_violation'
  | 'stratification_error'
  | 'potable_primary_mixing_error'
  | 'decorative_pipework'
  | 'unsafe_component_position';

export type CanonicalHydraulicTemplateId =
  | 'open_vented'
  | 'sealed_unvented'
  | 'combi'
  | 'mixergy'
  | 'thermal_store'
  | 'abv_protected_loop'
  | 'magnetic_filter_protection'
  | 'powerflush_setup';

export type HydraulicSignalKey =
  | 'pumpInline'
  | 'flowReturnDistinguishable'
  | 'potablePrimarySeparated'
  | 'showsSharpThermocline'
  | 'showsUniformWarmCylinder'
  | 'showsTopHotZone'
  | 'showsLowerCoolZone'
  | 'hasTundish'
  | 'hasVisibleTundishAirGap'
  | 'hasD2ContinuousFall'
  | 'abvAfterPumpBeforeRestrictions'
  | 'abvDownstreamOfZoneValve'
  | 'magneticFilterOnReturnBeforeBoiler'
  | 'magneticFilterHasIsolationValves'
  | 'openVentCloseCoupledToColdFeed'
  | 'openVentHasValve'
  | 'coldFeedHasValve'
  | 'fillingLoopDisconnectedByDefault'
  | 'fillingLoopPermanentlyConnected'
  | 'radiatorsBottomFed'
  | 'decorativePipework'
  | 'simultaneousFullHeatingAndDhw'
  | 'storesPotableInMainThermalStoreBody'
  | 'mixergyRepresentedAsThermalStore'
  | 'powerflushMarkedTemporary'
  | 'systemPumpOperatingDuringPowerflush'
  | 'd2HiddenOrMissing'
  | 'dhwPriorityShown'
  | 'separatePotableAndPrimaryPathsShown';

export interface TopologyHydraulicSignals {
  topologyId: VisualTopologyId;
  templateId: CanonicalHydraulicTemplateId;
  summary: string;
  signals: Record<HydraulicSignalKey, boolean>;
  knownSimplifications: string[];
}

export interface HydraulicConstraint {
  id: string;
  description: string;
  appliesTo: CanonicalHydraulicTemplateId[];
  type: 'must_show' | 'must_not_show';
  signal: HydraulicSignalKey;
  failureFlag: HydraulicQaFlag;
}

export interface HydraulicQaIssue {
  constraintId: string;
  message: string;
  flag: HydraulicQaFlag;
}

export interface CanonicalHydraulicTemplate {
  id: CanonicalHydraulicTemplateId;
  title: string;
  hydraulicIntentSummary: string;
  safetyNotes: string[];
  regulatoryNotes: string[];
  nonNegotiableSimplifications: string[];
}

export interface InstallerHydraulicReview {
  topologyId: VisualTopologyId;
  templateId: CanonicalHydraulicTemplateId;
  hydraulicIntentSummary: string;
  safetyNotes: string[];
  regulatoryNotes: string[];
  knownSimplifications: string[];
  plausibilityScore: number;
  flags: Record<HydraulicQaFlag, boolean>;
  issues: HydraulicQaIssue[];
}
