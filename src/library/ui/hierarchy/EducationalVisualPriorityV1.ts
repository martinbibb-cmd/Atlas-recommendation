/**
 * Educational Visual Priority contract.
 *
 * Controls *how loudly* a concept or card is rendered — not which content to
 * show or when to show it, but how much visual weight it receives within the
 * section it occupies.
 *
 * These four levels map directly to the Atlas educational art-direction rules:
 *   primary   → one per section, full visual weight
 *   supporting → up to two adjacent, grouped visually
 *   optional  → visually softened or collapsed
 *   deferred  → QR / deep-dive only, not dominant on page
 */

/** The four visual-priority levels used by the Atlas educational art direction. */
export type VisualPriorityLevel = 'primary' | 'supporting' | 'optional' | 'deferred';

/**
 * A visual priority assignment for a single concept, card, or section element.
 * Multiple elements can share the same priority level within one section, subject
 * to the density constraints defined in `visualHierarchyRules`.
 */
export interface EducationalVisualPriorityV1 {
  /** Priority tier that governs rendering weight and layout style. */
  level: VisualPriorityLevel;
  /** The concept this priority applies to, if concept-scoped. */
  conceptId?: string;
  /** The section this priority applies to, if section-scoped. */
  sectionId?: string;
  /**
   * Human-readable reason the priority was assigned at this level.
   * Used in the visual-noise audit report.
   */
  reason?: string;
}

/**
 * A section-level summary of priority assignments, used by the
 * VisualNoiseAudit to enforce density rules across a full pack.
 */
export interface SectionVisualPrioritySummaryV1 {
  sectionId: string;
  primaryCount: number;
  supportingCount: number;
  optionalCount: number;
  deferredCount: number;
  diagramCount: number;
  calloutCount: number;
}
