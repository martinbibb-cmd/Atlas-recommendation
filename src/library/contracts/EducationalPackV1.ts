import type { EducationalLoad } from './EducationalAssetV1';

export type EducationalPackSectionId =
  | 'calm_summary'
  | 'why_this_fits'
  | 'living_with_the_system'
  | 'relevant_explainers'
  | 'optional_technical_appendix'
  | 'next_steps';

export interface EducationalPackSectionV1 {
  id: EducationalPackSectionId;
  includedAssetIds: string[];
  notes: string[];
}

export interface EducationalPackOmissionV1 {
  assetId: string;
  reason: string;
}

export interface EducationalPackV1 {
  packId: string;
  recommendedScenarioId: string;
  sections: EducationalPackSectionV1[];
  selectedAssetIds: string[];
  selectedAssetReasons: Record<string, string[]>;
  omittedAssetIdsWithReason: EducationalPackOmissionV1[];
  printPageBudget: number;
  cognitiveLoadBudget: EducationalLoad;
  qrDestinations: string[];
}
