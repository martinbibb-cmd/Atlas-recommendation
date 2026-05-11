/**
 * VisualNoiseAudit — Educational visual density checker.
 *
 * Analyses a pack's section and card structure against the Atlas visual
 * hierarchy rules and returns a structured audit report with flagged
 * violations and warnings.
 *
 * Non-goals:
 *   - Does not modify the pack or any view model.
 *   - Does not access the DOM or React tree.
 *   - Pure TypeScript; safe to call in tests and server-side code.
 */

import type { SectionVisualPrioritySummaryV1 } from './EducationalVisualPriorityV1';
import {
  MAX_PRIMARY_PER_SECTION,
  MAX_SUPPORTING_ADJACENT,
  MAX_DIAGRAMS_PER_SECTION,
  MAX_DIAGRAMS_TOTAL,
  MAX_CALLOUTS_PER_SECTION,
  MAX_DENSE_SECTIONS_BEFORE_REST,
  MAX_CONSECUTIVE_CARD_TYPE_CHANGES,
} from './visualHierarchyRules';

// ─── Audit flag types ──────────────────────────────────────────────────────

/** The category of a visual-noise flag. */
export type VisualNoiseFlagKind =
  | 'too_many_primary'
  | 'too_many_callouts'
  | 'too_many_diagrams_in_section'
  | 'too_many_diagrams_total'
  | 'excessive_emphasis'
  | 'dense_section_stacking'
  | 'excessive_card_switching'
  | 'optional_card_not_softened'
  | 'deferred_card_dominant';

/** Severity of a visual-noise flag. */
export type VisualNoiseSeverity = 'warning' | 'error';

/** A single flagged visual-noise issue in the pack. */
export interface VisualNoiseFlagV1 {
  kind: VisualNoiseFlagKind;
  severity: VisualNoiseSeverity;
  sectionId?: string;
  detail: string;
}

/** The full audit report returned by runVisualNoiseAudit. */
export interface VisualNoiseAuditReportV1 {
  /** All flagged issues, in order of severity (errors first). */
  flags: VisualNoiseFlagV1[];
  /** True when no error-severity flags are present. */
  passed: boolean;
  /** Human-readable summary for dev preview panels. */
  summary: string;
}

// ─── Input type ────────────────────────────────────────────────────────────

/** Input to the visual noise audit. One entry per section in the pack. */
export interface VisualNoiseAuditInputV1 {
  sections: SectionVisualPrioritySummaryV1[];
  /** Total count of inline card-type changes across the full pack. */
  totalCardTypeChanges?: number;
  /** True when any optional card has been rendered without visual softening. */
  hasUnsoftenedOptionalCards?: boolean;
  /** True when any deferred card is rendered inline (not QR-only). */
  hasDominantDeferredCards?: boolean;
}

// ─── Audit runner ──────────────────────────────────────────────────────────

/**
 * Run the visual noise audit against a pack's section summary data.
 *
 * @param input - Section summaries and pack-level counters.
 * @returns A structured audit report with all flags and a pass/fail result.
 */
export function runVisualNoiseAudit(
  input: VisualNoiseAuditInputV1,
): VisualNoiseAuditReportV1 {
  const flags: VisualNoiseFlagV1[] = [];

  let totalDiagrams = 0;
  let consecutiveDenseSections = 0;

  for (const section of input.sections) {
    totalDiagrams += section.diagramCount;

    const totalCards =
      section.primaryCount +
      section.supportingCount +
      section.optionalCount;

    // ── Primary overload ────────────────────────────────────────────────
    if (section.primaryCount > MAX_PRIMARY_PER_SECTION) {
      flags.push({
        kind: 'too_many_primary',
        severity: 'error',
        sectionId: section.sectionId,
        detail:
          `Section "${section.sectionId}" has ${section.primaryCount} primary cards ` +
          `(max ${MAX_PRIMARY_PER_SECTION}).`,
      });
    }

    // ── Adjacent supporting overload ────────────────────────────────────
    if (section.supportingCount > MAX_SUPPORTING_ADJACENT) {
      flags.push({
        kind: 'dense_section_stacking',
        severity: 'warning',
        sectionId: section.sectionId,
        detail:
          `Section "${section.sectionId}" has ${section.supportingCount} adjacent supporting cards ` +
          `(soft max ${MAX_SUPPORTING_ADJACENT}).`,
      });
    }

    // ── Callout overload ────────────────────────────────────────────────
    if (section.calloutCount > MAX_CALLOUTS_PER_SECTION) {
      flags.push({
        kind: 'too_many_callouts',
        severity: 'warning',
        sectionId: section.sectionId,
        detail:
          `Section "${section.sectionId}" has ${section.calloutCount} callout elements ` +
          `(max ${MAX_CALLOUTS_PER_SECTION}).`,
      });
    }

    // ── Diagram overload per section ────────────────────────────────────
    if (section.diagramCount > MAX_DIAGRAMS_PER_SECTION) {
      flags.push({
        kind: 'too_many_diagrams_in_section',
        severity: 'warning',
        sectionId: section.sectionId,
        detail:
          `Section "${section.sectionId}" has ${section.diagramCount} diagrams ` +
          `(max ${MAX_DIAGRAMS_PER_SECTION} per section).`,
      });
    }

    // ── Dense-section stacking counter ──────────────────────────────────
    if (totalCards > 1) {
      consecutiveDenseSections += 1;
    } else {
      consecutiveDenseSections = 0;
    }

    if (consecutiveDenseSections > MAX_DENSE_SECTIONS_BEFORE_REST) {
      flags.push({
        kind: 'dense_section_stacking',
        severity: 'warning',
        sectionId: section.sectionId,
        detail:
          `More than ${MAX_DENSE_SECTIONS_BEFORE_REST} consecutive dense sections ` +
          `without a rest break (reached at "${section.sectionId}").`,
      });
      // Reset counter to avoid flooding the report with the same flag.
      consecutiveDenseSections = 0;
    }
  }

  // ── Total diagram overload ──────────────────────────────────────────────
  if (totalDiagrams > MAX_DIAGRAMS_TOTAL) {
    flags.push({
      kind: 'too_many_diagrams_total',
      severity: 'warning',
      detail:
        `Pack contains ${totalDiagrams} diagrams in total (max ${MAX_DIAGRAMS_TOTAL}).`,
    });
  }

  // ── Card-type switching overload ────────────────────────────────────────
  if (
    input.totalCardTypeChanges !== undefined &&
    input.totalCardTypeChanges > MAX_CONSECUTIVE_CARD_TYPE_CHANGES
  ) {
    flags.push({
      kind: 'excessive_card_switching',
      severity: 'warning',
      detail:
        `${input.totalCardTypeChanges} card-type changes detected across the pack ` +
        `(max ${MAX_CONSECUTIVE_CARD_TYPE_CHANGES}).`,
    });
  }

  // ── Optional cards not visually softened ────────────────────────────────
  if (input.hasUnsoftenedOptionalCards) {
    flags.push({
      kind: 'optional_card_not_softened',
      severity: 'warning',
      detail:
        'One or more optional cards are rendered without visual softening (subdued style or collapsed state).',
    });
  }

  // ── Deferred cards rendered inline ─────────────────────────────────────
  if (input.hasDominantDeferredCards) {
    flags.push({
      kind: 'deferred_card_dominant',
      severity: 'error',
      detail:
        'One or more deferred cards are rendered inline in the pack body. Deferred content must be QR-only.',
    });
  }

  // ── Sort: errors first ──────────────────────────────────────────────────
  flags.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'error' ? -1 : 1;
  });

  const errorCount = flags.filter((f) => f.severity === 'error').length;
  const warningCount = flags.filter((f) => f.severity === 'warning').length;
  const passed = errorCount === 0;

  const summary =
    flags.length === 0
      ? 'Visual noise audit passed — no density violations found.'
      : `Visual noise audit: ${errorCount} error${errorCount === 1 ? '' : 's'}, ` +
        `${warningCount} warning${warningCount === 1 ? '' : 's'}.`;

  return { flags, passed, summary };
}

// ─── Convenience helpers ───────────────────────────────────────────────────

/**
 * Build a SectionVisualPrioritySummaryV1 from raw counts.
 * Useful in tests and dev tooling.
 */
export function makeSectionSummary(
  sectionId: string,
  counts: {
    primaryCount?: number;
    supportingCount?: number;
    optionalCount?: number;
    deferredCount?: number;
    diagramCount?: number;
    calloutCount?: number;
  },
): SectionVisualPrioritySummaryV1 {
  return {
    sectionId,
    primaryCount: counts.primaryCount ?? 0,
    supportingCount: counts.supportingCount ?? 0,
    optionalCount: counts.optionalCount ?? 0,
    deferredCount: counts.deferredCount ?? 0,
    diagramCount: counts.diagramCount ?? 0,
    calloutCount: counts.calloutCount ?? 0,
  };
}
