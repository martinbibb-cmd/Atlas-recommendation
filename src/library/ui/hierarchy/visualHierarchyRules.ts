/**
 * Visual hierarchy layout rules for the Atlas educational system.
 *
 * These rules are the single source of truth for density and pacing
 * constraints. They are enforced by VisualNoiseAudit and should be
 * referenced by any renderer that applies educational visual priority.
 */

import type { VisualPriorityLevel } from './EducationalVisualPriorityV1';

// ─── Density limits ────────────────────────────────────────────────────────

/** Maximum number of primary-level concepts allowed in a single section. */
export const MAX_PRIMARY_PER_SECTION = 1;

/**
 * Maximum number of supporting-level cards that may appear adjacent to each
 * other (i.e., in the same visual group) without a rest break.
 */
export const MAX_SUPPORTING_ADJACENT = 2;

/**
 * Maximum number of diagrams allowed in a single section before the
 * VisualNoiseAudit raises a warning.
 */
export const MAX_DIAGRAMS_PER_SECTION = 2;

/**
 * Maximum total number of diagrams across the full pack before the audit
 * flags excessive diagram density.
 */
export const MAX_DIAGRAMS_TOTAL = 4;

/**
 * Maximum number of bold/highlighted phrases allowed in a single card body.
 * Exceeding this triggers an emphasis overload flag.
 */
export const MAX_EMPHASIS_PER_CARD = 3;

/**
 * Maximum number of callout elements (safety notices, misconception warnings,
 * analogies, key-point strips) that may appear in a single section without a
 * visual rest break.
 */
export const MAX_CALLOUTS_PER_SECTION = 3;

/**
 * Minimum number of whitespace / rest beats required after a section that
 * contains a diagram *and* two or more supporting cards.
 * In practice this means at least one visually empty separator or a
 * ConceptDivider must follow such a section.
 */
export const WHITESPACE_BEATS_AFTER_HEAVY_SECTION = 1;

// ─── Card-switching limits ─────────────────────────────────────────────────

/**
 * Maximum number of consecutive card-type changes (e.g. analogy → safety →
 * misconception → diagram) allowed before the audit flags excessive card
 * switching.
 */
export const MAX_CONSECUTIVE_CARD_TYPE_CHANGES = 4;

// ─── Section stacking limits ───────────────────────────────────────────────

/**
 * Maximum number of non-empty sections that may appear without an intervening
 * rest section (a section with zero or one card).
 */
export const MAX_DENSE_SECTIONS_BEFORE_REST = 3;

// ─── Priority rendering descriptors ───────────────────────────────────────

/**
 * Rendering descriptor for each priority level.
 * Used by renderers to apply consistent layout treatment.
 */
export interface PriorityRenderingDescriptorV1 {
  level: VisualPriorityLevel;
  /** Whether the card/element should span the full container width. */
  fullWidth: boolean;
  /**
   * Visual weight modifier.
   * 'strong'   → full border, accent background, prominent heading
   * 'normal'   → standard card styling
   * 'subdued'  → lighter border, muted text, reduced heading scale
   * 'hidden'   → not rendered inline; moved to QR/deep-dive
   */
  visualWeight: 'strong' | 'normal' | 'subdued' | 'hidden';
  /**
   * Whether optional-level cards should start in a collapsed/closed state,
   * requiring user interaction to expand.
   */
  collapsedByDefault: boolean;
  /** Short human-readable label used in dev previews and audit reports. */
  label: string;
}

export const PRIORITY_RENDERING_DESCRIPTORS: Record<
  VisualPriorityLevel,
  PriorityRenderingDescriptorV1
> = {
  primary: {
    level: 'primary',
    fullWidth: true,
    visualWeight: 'strong',
    collapsedByDefault: false,
    label: 'Primary',
  },
  supporting: {
    level: 'supporting',
    fullWidth: false,
    visualWeight: 'normal',
    collapsedByDefault: false,
    label: 'Supporting',
  },
  optional: {
    level: 'optional',
    fullWidth: false,
    visualWeight: 'subdued',
    collapsedByDefault: true,
    label: 'Optional',
  },
  deferred: {
    level: 'deferred',
    fullWidth: false,
    visualWeight: 'hidden',
    collapsedByDefault: true,
    label: 'Deferred (QR only)',
  },
} as const;

/**
 * Derive a visual priority level from a sequencing stage.
 * This provides a default mapping; individual renderers may override it.
 */
export function priorityFromSequenceStage(
  sequenceStage: string,
): VisualPriorityLevel {
  switch (sequenceStage) {
    case 'reassurance':
    case 'expectation':
      return 'primary';
    case 'lived_experience':
    case 'misconception':
      return 'supporting';
    case 'deeper_understanding':
      return 'optional';
    case 'technical_detail':
    case 'appendix_only':
      return 'deferred';
    default:
      return 'supporting';
  }
}
