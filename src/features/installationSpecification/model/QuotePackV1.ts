/**
 * QuotePackV1.ts
 *
 * Quote pack types for the Atlas Quote Pack Composer.
 *
 * A quote pack is an evidence-derived set of items that represents a
 * sensible starting point for an installation quote.  Packs are derived
 * from the canonical survey, engine output, and site conditions — not from
 * a blank list of additionals.
 *
 * Design rules:
 *   - Packs are always derived from evidence (survey + engine + scan).
 *   - Every pack has a `kind` that identifies its archetype.
 *   - Every pack item has a `reason` string explaining why it is included.
 *   - Packs are read-only suggestions — the surveyor edits them before finalising.
 *   - No customer-facing copy lives here — this is surveyor/engineer data only.
 */

import type { UiProposedHeatSourceLabel, UiProposedHotWaterLabel } from '../ui/installationSpecificationUiTypes';
import type { EvidenceProofLinkV1 } from '../../../features/scanEvidence/EvidenceProofLinkV1';

// ─── Pack kind ────────────────────────────────────────────────────────────────

/**
 * The archetype of a quote pack.
 *
 * best_advice       — Auto-selected from engine recommendation (Atlas top pick).
 * like_for_like     — Closest replacement of what is already installed.
 * low_disruption    — Minimum sensible install with least change to layout.
 * hot_water_priority — Optimised for stored hot-water performance.
 * future_ready      — Designed not to block later heat pump / solar upgrades.
 */
export type QuotePackKindV1 =
  | 'best_advice'
  | 'like_for_like'
  | 'low_disruption'
  | 'hot_water_priority'
  | 'future_ready';

// ─── Disruption level ─────────────────────────────────────────────────────────

export type QuotePackDisruptionLevel = 'low' | 'medium' | 'high';

// ─── Pack card ────────────────────────────────────────────────────────────────

/**
 * A single selectable pack card shown in the Pack Showroom.
 *
 * Each card represents a pre-configured installation pack derived from
 * evidence.  The surveyor selects one pack as the starting point, then
 * edits it in the Pack Editor.
 */
export interface QuotePackCardV1 {
  /** Archetype identifier for this pack. */
  kind: QuotePackKindV1;

  /** Short human-readable title for this pack. */
  title: string;

  /** One line: who/what this pack is best for. */
  bestFor: string;

  /**
   * Why Atlas suggests this pack for this specific home.
   * Sourced from evidence (survey + engine + site conditions).
   */
  whySuggested: string;

  /**
   * Proposed heat source for this pack.
   * Pre-populates the proposed system step when the surveyor selects the pack.
   */
  proposedHeatSource: UiProposedHeatSourceLabel;

  /**
   * Proposed hot-water arrangement for this pack.
   * Null for combi packs where hot water is integral.
   */
  proposedHotWater: UiProposedHotWaterLabel | null;

  /**
   * Short list of key items included in this pack.
   * These are highlights only — not the full scope.
   */
  includedHighlights: string[];

  /**
   * Items that need on-site verification or have caveats.
   * Empty when all items are confirmed.
   */
  warningsOrVerification: string[];

  /**
   * Estimated disruption level for this pack relative to the current installation.
   */
  disruptionLevel: QuotePackDisruptionLevel;

  /**
   * Whether this pack is the Atlas-recommended starting point.
   * At most one pack card per showroom should carry this flag.
   */
  isRecommended?: boolean;

  /**
   * Evidence proof links from the scan session that support this pack.
   * Derived from the spatial evidence graph via buildEvidenceProofLinks().
   * Absent when no scan evidence is available.
   *
   * Rules:
   *   - Links are filtered to sections relevant to this pack's proposed system.
   *   - Evidence supports the engine decision — it does not change it.
   *   - Unresolved links must only be shown in engineer mode.
   */
  evidenceProofLinks?: EvidenceProofLinkV1[];
}

// ─── Showroom context ─────────────────────────────────────────────────────────

/**
 * Evidence context shown at the top of the Pack Showroom.
 *
 * Summarises what Atlas knows before presenting the packs.
 * This replaces the "what system do you have?" survey question.
 */
export interface QuotePackShowroomContextV1 {
  /** Plain-English summary of the existing system. */
  existingSystemSummary: string;

  /** Key site conditions that affect the recommendation. */
  siteConditions: string[];

  /** The recommendation reason from the engine output. */
  recommendationReason: string | null;

  /** The recommended pack kind (pre-selects that card). */
  recommendedPackKind: QuotePackKindV1;
}
