import type { ScenarioSystemType } from '../../contracts/ScenarioResult';
import type { EducationalAssetType, EducationalAudience, EducationalDepth } from '../contracts/EducationalAssetV1';

export type EducationalConceptCategoryV1 =
  | 'whole_system'
  | 'boiler'
  | 'hot_water'
  | 'heat_pump'
  | 'hydronics'
  | 'emitters'
  | 'controls'
  | 'safety'
  | 'installation'
  | 'maintenance'
  | 'future_ready'
  | 'behaviour'
  | 'trust';

export type EducationalConceptConfidenceLevelV1 =
  | 'physical_law'
  | 'standards_based'
  | 'manufacturer_guidance'
  | 'best_practice'
  | 'operational_preference';

export type EducationalConceptPrintPriorityV1 = 'must_print' | 'should_print' | 'digital_ok';

export type EducationalConceptWelcomePackPriorityV1 =
  | 'must_have'
  | 'should_have'
  | 'situational'
  | 'appendix_only';

export type EducationalConceptSystemTypeV1 = ScenarioSystemType | 'all';

export interface EducationalConceptTaxonomyV1 {
  conceptId: string;
  parentConceptId?: string;
  category: EducationalConceptCategoryV1;
  title: string;
  plainEnglishDefinition: string;
  technicalDefinition?: string;
  appliesToSystemTypes: EducationalConceptSystemTypeV1[];
  requiredPriorConceptIds: string[];
  relatedConceptIds: string[];
  commonMisunderstandings: string[];
  dangerousOversimplifications: string[];
  confidenceLevel: EducationalConceptConfidenceLevelV1;
  preferredAssetTypes: EducationalAssetType[];
  defaultAudience: EducationalAudience;
  defaultDepth: EducationalDepth;
  printPriority: EducationalConceptPrintPriorityV1;
  welcomePackPriority: EducationalConceptWelcomePackPriorityV1;
}
