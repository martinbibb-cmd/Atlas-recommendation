/**
 * PdfComparisonAuditV1
 *
 * Output type produced by buildPdfComparisonAudit.
 *
 * Findings are grouped by category so the panel can render each band
 * independently without re-parsing the audit result.
 */

import type { PdfComparisonModeV1 } from './PdfComparisonScenarioV1';

// ─── Finding severity ─────────────────────────────────────────────────────────

export type PdfAuditSeverityV1 = 'pass' | 'warn' | 'fail';

// ─── Individual finding ───────────────────────────────────────────────────────

export interface PdfAuditFindingV1 {
  /** Short machine-readable key, e.g. "guessed_capacity", "forbidden_bs7593". */
  readonly ruleId: string;
  /** Human-readable description of what was detected. */
  readonly description: string;
  /** Severity level for this finding. */
  readonly severity: PdfAuditSeverityV1;
  /** Exact text excerpt that triggered the finding (empty string if not applicable). */
  readonly excerpt: string;
  /** Section ID where the finding was detected (empty string if not applicable). */
  readonly sectionId: string;
}

// ─── Positive check ───────────────────────────────────────────────────────────

export interface PdfPositiveCheckV1 {
  /** Short machine-readable key, e.g. "system_protection_present". */
  readonly checkId: string;
  /** Human-readable description of what was verified. */
  readonly description: string;
  /** Whether the check passed. */
  readonly passed: boolean;
}

// ─── Legacy diff summary ──────────────────────────────────────────────────────

export interface PdfLegacyDiffSummaryV1 {
  /** IDs of sections present in canonical but absent in legacy. */
  readonly sectionsOnlyInCanonical: readonly string[];
  /** IDs of sections present in legacy but absent in canonical. */
  readonly sectionsOnlyInLegacy: readonly string[];
  /** IDs of sections present in both. */
  readonly commonSectionIds: readonly string[];
  /** Whether the recommendation summaries match across canonical and legacy. */
  readonly recommendationSummaryMatch: boolean;
}

// ─── Top-level audit ──────────────────────────────────────────────────────────

export interface PdfComparisonAuditV1 {
  readonly schemaVersion: '1.0';
  readonly generatedAt: string;

  /** Label copied from the input scenario. */
  readonly scenarioLabel: string;

  /** Mode copied from the input scenario. */
  readonly mode: PdfComparisonModeV1;

  /** Overall pass/warn/fail status.  fail if any finding has severity=fail. */
  readonly overallStatus: PdfAuditSeverityV1;

  // ── Detection findings ────────────────────────────────────────────────────

  /** Findings for guessed CWS/tank capacity ranges (e.g. "100–150 L"). */
  readonly guessedCapacityFindings: readonly PdfAuditFindingV1[];

  /** Findings for forbidden technical terminology leakage. */
  readonly forbiddenTermFindings: readonly PdfAuditFindingV1[];

  /** Findings for legacy report heading presence. */
  readonly legacyHeadingFindings: readonly PdfAuditFindingV1[];

  /** Findings for misleading "system unchanged" / "existing system untouched" phrasing. */
  readonly misleadingPhrasingFindings: readonly PdfAuditFindingV1[];

  // ── Positive checks ───────────────────────────────────────────────────────

  /** All positive verification checks and whether they passed. */
  readonly positiveChecks: readonly PdfPositiveCheckV1[];

  // ── Legacy diff ───────────────────────────────────────────────────────────

  /**
   * Present only when the audit was run with a companion canonical scenario
   * for direct section-level comparison.
   */
  readonly legacyDiffSummary?: PdfLegacyDiffSummaryV1;

  // ── Roll-up counts ────────────────────────────────────────────────────────

  /** Total number of fail-severity findings. */
  readonly failCount: number;
  /** Total number of warn-severity findings. */
  readonly warnCount: number;
  /** Number of positive checks that passed. */
  readonly positivePassCount: number;
  /** Total number of positive checks. */
  readonly positiveTotalCount: number;
}
