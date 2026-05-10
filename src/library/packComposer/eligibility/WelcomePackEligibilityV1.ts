import type { AccessibilityApprovalMode } from '../../audits/EducationalAssetAccessibilityAuditV1';

export type EligibilitySeverity = 'info' | 'warning' | 'error';

export type EligibilityDeliveryMode = AccessibilityApprovalMode;

export interface WelcomePackEligibilityV1 {
  assetId: string;
  conceptIds: string[];
  eligible: boolean;
  mode: EligibilityDeliveryMode;
  reasons: string[];
  severity: EligibilitySeverity;
  replacementHint?: string;
}
