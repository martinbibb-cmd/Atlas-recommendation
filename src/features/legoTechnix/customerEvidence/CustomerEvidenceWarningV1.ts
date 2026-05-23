export const CUSTOMER_EVIDENCE_WARNING_CATEGORIES_V1 = [
  'comfort',
  'hot_water',
  'efficiency',
  'uncertainty',
  'hydraulic_risk',
  'future_upgrade',
  'installation_complexity',
] as const;

export type CustomerEvidenceWarningCategoryV1 =
  (typeof CUSTOMER_EVIDENCE_WARNING_CATEGORIES_V1)[number];

export const CUSTOMER_EVIDENCE_WARNING_SEVERITIES_V1 = [
  'info',
  'attention',
  'important',
] as const;

export type CustomerEvidenceWarningSeverityV1 =
  (typeof CUSTOMER_EVIDENCE_WARNING_SEVERITIES_V1)[number];

export interface CustomerEvidenceWarningV1 {
  readonly category: CustomerEvidenceWarningCategoryV1;
  readonly severity: CustomerEvidenceWarningSeverityV1;
  readonly message: string;
}
