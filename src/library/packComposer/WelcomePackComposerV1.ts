import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { EducationalDepth, EducationalLoad } from '../contracts/EducationalAssetV1';
import type { EducationalPackSectionV1 } from '../contracts/EducationalPackV1';

export type WelcomePackAccessibilityProfile = 'dyslexia' | 'adhd';

export interface WelcomePackAccessibilityPreferencesV1 {
  prefersReducedMotion?: boolean;
  prefersPrint?: boolean;
  requestedDepth?: EducationalDepth;
  includeTechnicalAppendix?: boolean;
  maxPages?: number;
  profiles?: WelcomePackAccessibilityProfile[];
}

export interface WelcomePackPlanV1 {
  packId: string;
  recommendedScenarioId: string;
  sections: EducationalPackSectionV1[];
  selectedAssetIds: string[];
  selectedAssetReasons: Record<string, string[]>;
  omittedAssetIdsWithReason: Array<{
    assetId: string;
    reason: string;
  }>;
  printPageBudget: number;
  cognitiveLoadBudget: EducationalLoad;
  qrDestinations: string[];
}

export interface WelcomePackComposerInputV1 {
  customerSummary: CustomerSummaryV1;
  atlasDecision: AtlasDecisionV1;
  scenarios: ScenarioResult[];
  accessibilityPreferences?: WelcomePackAccessibilityPreferencesV1;
  userConcernTags?: string[];
  propertyConstraintTags?: string[];
}

export interface WelcomePackComposerV1 {
  buildPlan(input: WelcomePackComposerInputV1): WelcomePackPlanV1;
}
