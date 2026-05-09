import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { ScenarioResult, ScenarioSystemType } from '../../contracts/ScenarioResult';
import type { EducationalAssetType, EducationalLoad } from '../contracts/EducationalAssetV1';

export type EducationalRoutingSectionTarget =
  | 'calm_summary'
  | 'why_this_fits'
  | 'living_with_the_system'
  | 'relevant_explainers'
  | 'technical_appendix'
  | 'next_steps';

export type EducationalRoutingAccessibilityProfile =
  | 'print_first'
  | 'reduced_motion'
  | 'dyslexia'
  | 'adhd'
  | 'technical_appendix_requested';

export interface EducationalRoutingRuleV1 {
  ruleId: string;
  label: string;
  description: string;
  triggerTags: string[];
  requiredConceptIds: string[];
  preferredAssetTypes: EducationalAssetType[];
  requiredEngineFacts: string[];
  appliesToScenarioTypes?: ScenarioSystemType[];
  appliesToConstraintTags?: string[];
  appliesToUserConcernTags?: string[];
  appliesToAccessibilityProfiles?: EducationalRoutingAccessibilityProfile[];
  includeReason: string;
  omitReason?: string;
  priority: number;
  maxAssets: number;
  printWeight: number;
  cognitiveLoadImpact: EducationalLoad;
  sectionTarget: EducationalRoutingSectionTarget;
}

export type EducationalRoutingPackMode = 'welcome' | 'portal' | 'print' | 'engineer';

export interface EducationalRoutingAccessibilityPreferencesV1 {
  prefersReducedMotion?: boolean;
  prefersPrint?: boolean;
  includeTechnicalAppendix?: boolean;
  profiles?: EducationalRoutingAccessibilityProfile[];
}

export interface EducationalRoutingTaxonomyValidationOptionsV1 {
  enabled?: boolean;
}

export interface EducationalAssetSelectionV1 {
  selected: Array<{
    assetId: string;
    ruleId: string;
    reason: string;
    sectionTarget: EducationalRoutingSectionTarget;
    priority: number;
    printWeight: number;
    cognitiveLoadImpact: EducationalLoad;
  }>;
  omitted: Array<{
    assetId: string;
    reason: string;
  }>;
  warnings: string[];
}

export interface SelectEducationalAssetsForContextInputV1 {
  customerSummary: CustomerSummaryV1;
  atlasDecision: AtlasDecisionV1;
  scenarios: ScenarioResult[];
  educationalAssets: import('../contracts/EducationalAssetV1').EducationalAssetV1[];
  taxonomyValidation?: EducationalRoutingTaxonomyValidationOptionsV1;
  accessibilityPreferences?: EducationalRoutingAccessibilityPreferencesV1;
  userConcernTags?: string[];
  propertyConstraintTags?: string[];
  packMode: EducationalRoutingPackMode;
}
