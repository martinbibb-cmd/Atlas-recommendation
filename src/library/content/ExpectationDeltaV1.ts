import type { LivingExperiencePatternV1 } from './LivingExperiencePatternV1';

export type ExpectationDeltaPerceivedSeverityV1 =
  | 'none'
  | 'minor'
  | 'moderate'
  | 'major';

export type ExpectationDeltaCategoryV1 =
  | 'hot_water'
  | 'radiators'
  | 'noise'
  | 'recovery'
  | 'controls'
  | 'daily_routine';

export interface ExpectationDeltaV1 {
  currentExperience: string;
  futureExperience: string;
  perceivedSeverity: ExpectationDeltaPerceivedSeverityV1;
  category: ExpectationDeltaCategoryV1;
  adaptationGuidance: string;
  reassurance: string;
  misconceptionRisk?: string;
}

export interface ExpectationDeltaPatternPairV1 {
  current?: LivingExperiencePatternV1;
  future?: LivingExperiencePatternV1;
}

export interface BuildExpectationDeltasInputV1 {
  currentSystem: string;
  recommendedSystem: string;
  livingExperiencePatterns: Partial<Record<ExpectationDeltaCategoryV1, ExpectationDeltaPatternPairV1>>;
}
