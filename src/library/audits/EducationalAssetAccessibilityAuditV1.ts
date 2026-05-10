export type AccessibilityAuditStatus = 'draft' | 'passed' | 'failed' | 'needs_changes';

export type AccessibilityApprovalMode =
  | 'digital'
  | 'print'
  | 'reduced_motion'
  | 'customer_pack'
  | 'technical_appendix';

export interface AccessibilityAuditChecks {
  /** Asset uses semantic heading structure and landmark roles */
  semanticStructure: boolean;
  /** All interactive elements are keyboard operable */
  keyboardSafe: boolean;
  /** Asset respects prefers-reduced-motion or has a static equivalent */
  reducedMotionSafe: boolean;
  /** A non-animated static fallback is available */
  staticFallbackAvailable: boolean;
  /** A print-optimised equivalent is available */
  printEquivalentAvailable: boolean;
  /** Colour alone is not used as the sole indicator of meaning */
  colourNotSoleIndicator: boolean;
  /** A screen-reader summary or aria-label is present */
  screenReaderSummaryAvailable: boolean;
  /** Cognitive load has been assessed as acceptable for the target audience */
  cognitiveLoadAcceptable: boolean;
  /** No decorative motion is present that cannot be suppressed */
  noDecorativeMotion: boolean;
  /** All factual claims are grounded in engine output or authored content; no unsupported assertions */
  noUnsupportedClaims: boolean;
}

export interface EducationalAssetAccessibilityAuditV1 {
  auditId: string;
  assetId: string;
  auditedAt: string;
  auditedBy: string;
  status: AccessibilityAuditStatus;
  checks: AccessibilityAuditChecks;
  notes: string[];
  requiredChanges: string[];
  approvedFor: AccessibilityApprovalMode[];
}
