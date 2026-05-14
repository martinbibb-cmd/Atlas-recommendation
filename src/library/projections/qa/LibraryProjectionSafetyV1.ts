/**
 * LibraryProjectionSafetyV1
 *
 * Result type produced by assessLibraryProjectionSafety.
 * Carries the full evidence set so callers can render diagnostics or audit
 * traces without re-running the assessment.
 */
export interface LibraryProjectionSafetyV1 {
  /** True only when no blocking rules fired and the projection is safe to show customers. */
  readonly safeForCustomer: boolean;
  /** Hard blockers — customer output MUST NOT be rendered while any of these are present. */
  readonly blockingReasons: readonly string[];
  /** Non-blocking issues that should be addressed before shipping. */
  readonly warnings: readonly string[];
  /** Exact forbidden terms that were found in visible card content. */
  readonly leakageTerms: readonly string[];
  /**
   * Required content categories that were absent from the customer projection.
   * Each entry is a short identifier such as 'diagrams', 'calm_summary', or
   * 'what_you_may_notice'.
   */
  readonly missingRequiredContent: readonly string[];
}
