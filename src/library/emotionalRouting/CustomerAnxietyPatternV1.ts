export type CustomerAnxietyCategoryV1 =
  | 'disruption'
  | 'comfort'
  | 'financial'
  | 'trust'
  | 'safety'
  | 'competence'
  | 'regret';

export type CustomerAnxietyQrDepthPreferenceV1 = 'brief' | 'standard' | 'deep';

export interface CustomerAnxietySequencingBiasV1 {
  reassuranceStagePriorityBoost?: number;
  simultaneousConceptReduction?: number;
  preferWhatToExpectCard?: boolean;
  suppressTechnicalContent?: boolean;
  boostWhatStaysFamiliar?: boolean;
}

export interface CustomerAnxietyPatternV1 {
  anxietyId: string;
  category: CustomerAnxietyCategoryV1;
  triggers: readonly string[];
  reassuranceStrategies: readonly string[];
  preferredCardTypes: readonly string[];
  avoidConcepts: readonly string[];
  sequencingBias: CustomerAnxietySequencingBiasV1;
  qrDepthPreference: CustomerAnxietyQrDepthPreferenceV1;
  printPreferenceWeight: number;
}
