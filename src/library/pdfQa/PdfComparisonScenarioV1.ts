/**
 * PdfComparisonScenarioV1
 *
 * Input type for the PDF comparison QA harness.
 *
 * A scenario describes a single unit of PDF text to audit.  The same type is
 * used for:
 *   - canonical library-pdf output
 *   - legacy framework-print output
 *   - legacy insight-pdf output
 *   - fixture text supplied directly in tests
 *
 * All fields are plain text (not rendered HTML) so the audit can apply simple
 * substring and pattern checks without a DOM.
 */

// ─── Comparison mode ──────────────────────────────────────────────────────────

export type PdfComparisonModeV1 =
  | 'canonical_library_pdf'
  | 'legacy_framework_print'
  | 'legacy_insight_pdf'
  | 'fixture';

// ─── Per-section text snapshot ────────────────────────────────────────────────

export interface PdfSectionSnapshotV1 {
  /** Stable section identifier, e.g. "cover", "what_changes", "system_protection". */
  readonly sectionId: string;
  /** Heading text as it appears in the rendered output. */
  readonly heading: string;
  /** All body text for the section joined as a single string. */
  readonly bodyText: string;
}

// ─── Scenario ─────────────────────────────────────────────────────────────────

export interface PdfComparisonScenarioV1 {
  /** Human-readable scenario label, e.g. "Open-vented to sealed — 3-bed semi". */
  readonly scenarioLabel: string;

  /** Which PDF surface this snapshot was taken from. */
  readonly mode: PdfComparisonModeV1;

  /**
   * The recommendation summary line as it appears on the PDF cover.
   * Used to validate that the canonical and legacy outputs agree on the
   * recommendation identity.
   */
  readonly recommendationSummary: string;

  /**
   * All visible section snapshots in render order.
   * Must include at minimum a cover section (sectionId = "cover").
   */
  readonly sections: readonly PdfSectionSnapshotV1[];

  /**
   * Optional survey condition present in the scenario.
   * When provided the audit checks that a system protection section exists.
   * Use `null` to explicitly signal no survey (no-survey graceful handling).
   */
  readonly surveyCondition?: 'present' | null;

  /**
   * Whether the scenario was produced with a twin-tank (vented hot storage)
   * configuration.  When true the audit allows surveyed CWS volume references.
   */
  readonly isTwinTankSurveyed?: boolean;
}
