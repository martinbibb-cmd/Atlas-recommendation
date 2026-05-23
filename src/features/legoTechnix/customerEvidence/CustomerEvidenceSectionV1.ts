import type { CustomerEvidenceCardV1 } from './CustomerEvidenceCardV1';
import type { CustomerEvidenceTimelineV1 } from './CustomerEvidenceTimelineV1';
import type { CustomerEvidenceWarningV1 } from './CustomerEvidenceWarningV1';

export const CUSTOMER_EVIDENCE_SECTION_IDS_V1 = [
  'home_understanding',
  'what_atlas_found',
  'heating_behaviour',
  'hot_water_behaviour',
  'comfort_expectations',
  'energy_efficiency',
  'confidence_and_assumptions',
  'engineer_confirmation',
  'future_flexibility',
  'safety_protection',
] as const;

export type CustomerEvidenceSectionIdV1 = (typeof CUSTOMER_EVIDENCE_SECTION_IDS_V1)[number];

export interface CustomerEvidenceSectionV1 {
  readonly id: CustomerEvidenceSectionIdV1;
  readonly heading: string;
  readonly summary: string;
  readonly cards: readonly CustomerEvidenceCardV1[];
  readonly warnings: readonly CustomerEvidenceWarningV1[];
  readonly timelineSummaries: readonly CustomerEvidenceTimelineV1[];
}
