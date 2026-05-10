import type { ScenarioSystemType } from '../../../contracts/ScenarioResult';
import type { EducationalAssetType } from '../../contracts/EducationalAssetV1';
import type { EducationalPackSectionId } from '../../contracts/EducationalPackV1';

export type WelcomePackPrintStrategyV1 =
  | 'compact'
  | 'balanced'
  | 'reference_binder'
  | 'digital_first';

export type WelcomePackQrStrategyV1 = 'minimal' | 'standard' | 'deep_dive';

export interface WelcomePackArchetypeV1 {
  archetypeId: string;
  /** Optional link to an authored golden-journey demonstrator. Used only for preview/navigation metadata — no recommendation influence. */
  goldenJourneyId?: string;
  label: string;
  description: string;
  appliesToScenarioTypes: string[];
  appliesToSystemTypes: ScenarioSystemType[];
  requiredConceptIds: string[];
  recommendedConceptIds: string[];
  optionalConceptIds: string[];
  excludedByDefaultConceptIds: string[];
  defaultSections: EducationalPackSectionId[];
  maxPrintPages: number;
  maxCoreConcepts: number;
  maxAppendixConcepts: number;
  cognitiveLoadBudget: number;
  preferredAssetTypes: EducationalAssetType[];
  printStrategy: WelcomePackPrintStrategyV1;
  qrStrategy: WelcomePackQrStrategyV1;
  calmFramingNotes: string[];
  trustRecoveryConceptIds: string[];
  livingWithSystemConceptIds: string[];
}
