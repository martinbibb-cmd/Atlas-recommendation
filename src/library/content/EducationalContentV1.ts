import type { EducationalAnalogyFamily } from '../contracts/EducationalAnalogyV1';
import type { EducationalConceptConfidenceLevelV1 } from '../taxonomy/EducationalConceptTaxonomyV1';
import type { LivingExperiencePatternV1 } from './LivingExperiencePatternV1';

export type EducationalContentReadingLevelV1 = 'simple' | 'standard' | 'technical';

export interface EducationalContentAnalogyOptionV1 {
  analogyId: string;
  family: EducationalAnalogyFamily;
  title: string;
  explanation: string;
  whereItWorks: string;
  whereItBreaks: string;
}

export interface EducationalContentV1 {
  contentId: string;
  conceptId: string;
  title: string;
  plainEnglishSummary: string;
  customerExplanation: string;
  analogyOptions: EducationalContentAnalogyOptionV1[];
  commonMisunderstanding: string;
  dangerousOversimplification: string;
  livingWithSystemGuidance?: string;
  printSummary: string;
  technicalAppendixSummary?: string;
  safetyNotice?: string;
  qrDeepDiveTitle?: string;
  readingLevel: EducationalContentReadingLevelV1;
  accessibilityNotes: string[];
  requiredEvidenceFacts: string[];
  confidenceLevel: EducationalConceptConfidenceLevelV1;
  livingExperiencePattern?: LivingExperiencePatternV1;
}
