import type { VisualTopologyId } from '../visualTopologies/visualTopologyRegistry';

export type CanonicalHydraulicTemplateId =
  | 'open_vented'
  | 'sealed_unvented'
  | 'combi'
  | 'mixergy'
  | 'thermal_store'
  | 'abv_protected_loop'
  | 'magnetic_filter_protection'
  | 'powerflush_setup';

export type HydraulicConstraintKind = 'must_show' | 'must_not_show';

export type HydraulicQaIssueCategory =
  | 'hydraulically_implausible'
  | 'visually_confusing'
  | 'regulation_violation'
  | 'stratification_error'
  | 'potable_primary_mixing_error'
  | 'decorative_pipework'
  | 'unsafe_component_position';

export interface HydraulicConstraint {
  id: string;
  kind: HydraulicConstraintKind;
  description: string;
  issueCategory: HydraulicQaIssueCategory;
  requiredFeatureFlag: string;
  templates: CanonicalHydraulicTemplateId[];
  topologyIds?: VisualTopologyId[];
}

export interface CanonicalHydraulicRuleSet {
  componentPlacementRules: string[];
  flowReturnRules: string[];
  closeCouplingRules: string[];
  pressureRules: string[];
  stratificationRules: string[];
  potablePrimarySeparationRules: string[];
  g3SafetyRoutingRules: string[];
  pumpPlacementRules: string[];
  abvPlacementRules: string[];
  magneticFilterPlacementRules: string[];
  fillingLoopRules: string[];
}

export interface DiagramSimplificationRules {
  intentionallySimplified: string[];
  cannotSimplifyWithoutMisleading: string[];
}

export interface TopologyHydraulicTruthModel {
  topologyId: VisualTopologyId;
  templateId: CanonicalHydraulicTemplateId;
  hydraulicIntentSummary: string;
  safetyNotes: string[];
  regulatoryNotes: string[];
  knownSimplifications: string[];
  simplificationRules: DiagramSimplificationRules;
  featureFlags: string[];
  accessibilityCompatibility: {
    noLabelMode: boolean;
    monochromePrintSafeMode: boolean;
    reducedMotionMode: boolean;
    analogyOverlays: boolean;
  };
}

export interface HydraulicQaIssue {
  category: HydraulicQaIssueCategory;
  severity: 'warn' | 'error';
  message: string;
  constraintId: string;
}

export interface HydraulicQaResult {
  topologyId: VisualTopologyId;
  templateId: CanonicalHydraulicTemplateId;
  passed: boolean;
  plausibilityScore: number;
  issues: HydraulicQaIssue[];
}
