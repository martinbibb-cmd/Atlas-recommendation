import type { CustomerEvidenceMetricV1 } from './CustomerEvidenceMetricV1';
import type { CustomerEvidenceWarningV1 } from './CustomerEvidenceWarningV1';

export const CUSTOMER_EVIDENCE_CARD_TYPES_V1 = [
  'thermal_story',
  'hot_water_story',
  'confidence_story',
  'warning_story',
  'efficiency_story',
  'comfort_story',
  'timeline_story',
  'assumption_story',
  'system_behaviour_story',
] as const;

export type CustomerEvidenceCardTypeV1 = (typeof CUSTOMER_EVIDENCE_CARD_TYPES_V1)[number];

export interface CustomerEvidenceCardV1 {
  readonly type: CustomerEvidenceCardTypeV1;
  readonly heading: string;
  readonly summary: string;
  readonly metrics: readonly CustomerEvidenceMetricV1[];
  readonly warnings: readonly CustomerEvidenceWarningV1[];
}
