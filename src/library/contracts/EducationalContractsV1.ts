export const EDUCATIONAL_LIBRARY_CONTRACT_VERSION = '1.0.0';

export type EducationalAssetKind =
  | 'animation'
  | 'diagram'
  | 'explainer'
  | 'simulation_visual'
  | 'comparison'
  | 'interactive_demo'
  | 'analogy'
  | 'topology_binding';

export type EducationalCategory =
  | 'water'
  | 'heat'
  | 'energy'
  | 'controls'
  | 'system_behaviour'
  | 'fabric'
  | 'comparison'
  | 'topology';

export type EducationalAudience = 'customer' | 'adviser' | 'engineer' | 'surveyor' | 'all';

export type AccessibilityMode =
  | 'default'
  | 'dyslexia'
  | 'adhd'
  | 'low_technical_literacy'
  | 'screen_reader_first'
  | 'reduced_motion'
  | 'high_contrast';

export type MotionLevel = 'none' | 'low' | 'medium' | 'high';

export type TextDensity = 'low' | 'medium' | 'high';

export type TechnicalDepth = 'basic' | 'guided' | 'intermediate' | 'advanced';

export type ExplanationStyle =
  | 'visual'
  | 'cause_effect'
  | 'analogy'
  | 'comparative'
  | 'technical'
  | 'step_by_step';

export type EducationalTruthSource = 'engine_output' | 'canonical_presentation' | 'simulation_output' | 'ui_context';

export type ReducedMotionFallback = 'static_frame' | 'manual_step' | 'text_only' | 'diagram_swap';

export interface CognitiveLoadBudgetV1 {
  score: 1 | 2 | 3 | 4 | 5;
  dominantIdeaCount: number;
  interactionCount: number;
  motionLevel: MotionLevel;
  textDensity: TextDensity;
  escalationPathAssetIds?: readonly string[];
}

export interface EducationalTruthBoundaryV1 {
  source: EducationalTruthSource;
  sourceFieldPaths: readonly string[];
  mustNotDeriveRecommendations: true;
  mustNotDerivePhysics: true;
}

export interface EducationalAssetV1 {
  id: string;
  version: '1';
  title: string;
  summary: string;
  kind: EducationalAssetKind;
  category: EducationalCategory;
  conceptIds: readonly string[];
  triggerIds: readonly string[];
  analogyIds?: readonly string[];
  audience: readonly EducationalAudience[];
  accessibilityModes: readonly AccessibilityMode[];
  motionLevel: MotionLevel;
  textDensity: TextDensity;
  technicalDepth: TechnicalDepth;
  explanationStyle: ExplanationStyle;
  supportsReducedMotion: boolean;
  reducedMotionFallback?: ReducedMotionFallback;
  cognitiveLoadBudget: CognitiveLoadBudgetV1;
  truthBoundary: EducationalTruthBoundaryV1;
  sourceFiles: readonly string[];
  currentRegistryIds?: readonly string[];
  tags?: readonly string[];
}

export interface EducationalConceptV1 {
  id: string;
  title: string;
  summary: string;
  category: EducationalCategory;
  canonicalTerms: readonly string[];
  assetIds?: readonly string[];
  triggerIds?: readonly string[];
}

export interface EducationalTriggerV1 {
  id: string;
  title: string;
  summary: string;
  source: EducationalTruthSource;
  sourceFieldPaths: readonly string[];
  severity: 'info' | 'warn' | 'fail';
  defaultAssetIds?: readonly string[];
  audience?: readonly EducationalAudience[];
}

export interface EducationalAnalogyV1 {
  id: string;
  title: string;
  summary: string;
  conceptIds: readonly string[];
  audience: readonly EducationalAudience[];
  accessibilityModes: readonly AccessibilityMode[];
  technicalDepth: TechnicalDepth;
  cautionNotes?: readonly string[];
  followUpAssetIds?: readonly string[];
}

export interface EducationalRegistryFoundationV1 {
  assets: readonly EducationalAssetV1[];
  concepts: readonly EducationalConceptV1[];
  triggers: readonly EducationalTriggerV1[];
  analogies: readonly EducationalAnalogyV1[];
}
