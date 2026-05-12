/**
 * SuggestedMaterialLineV1.ts — Non-priced suggested materials schedule line.
 *
 * Purpose:
 *   A single line in the suggested materials schedule, derived from accepted
 *   specification lines and scope packs.  Used by surveyors, office staff, and
 *   engineers to consider what to take / order before an installation — without
 *   pretending to be procurement or a final BOM.
 *
 * Explicit boundaries:
 *   - NOT priced
 *   - NOT linked to a supplier catalogue
 *   - NOT a stock order
 *   - NOT final design sign-off
 *
 * Output of: buildSuggestedMaterialsSchedule
 */

// ─── Category ─────────────────────────────────────────────────────────────────

/**
 * Broad material category used to group lines in the schedule.
 *
 *   heat_source     — boiler, heat pump, or primary heat appliance
 *   hot_water       — cylinder, vessel, safety controls
 *   pipework        — primary and secondary pipework, fittings, capping
 *   valves          — isolation, check, pressure relief, filling valves
 *   controls        — thermostats, programmers, TRVs, zone valves
 *   water_quality   — filter, inhibitor, flush chemicals, test kit
 *   safety          — discharge, tundish, PRV, T&P valve, ERV hardware
 *   consumables     — fixings, jointing compound, pipe clips, tape
 *   unknown         — category could not be determined from source data
 */
export type SuggestedMaterialCategory =
  | 'heat_source'
  | 'hot_water'
  | 'pipework'
  | 'valves'
  | 'controls'
  | 'water_quality'
  | 'safety'
  | 'consumables'
  | 'unknown';

// ─── Confidence ───────────────────────────────────────────────────────────────

/**
 * Confidence level for the material line.
 *
 *   confirmed     — material requirement is certain from available data
 *   inferred      — material likely required based on system type / strategy
 *   needs_survey  — material requirement depends on site confirmation
 */
export type SuggestedMaterialConfidence = 'confirmed' | 'inferred' | 'needs_survey';

// ─── Contract ─────────────────────────────────────────────────────────────────

/**
 * SuggestedMaterialLineV1
 *
 * A single non-priced material suggestion for surveyor/office/installer review.
 * Derived deterministically from specification lines and scope packs.
 *
 * NOT customer-facing for technical detail lines.
 * NOT a supplier catalogue entry.
 * NOT a stock order.
 * NOT final design sign-off.
 */
export interface SuggestedMaterialLineV1 {
  /** Machine-readable identifier for this material line, e.g. 'hot_water:cylinder:1'. */
  readonly materialId: string;

  /** Specification line IDs that gave rise to this material suggestion. */
  readonly sourceLineIds: readonly string[];

  /** Broad material category for grouping in the schedule. */
  readonly category: SuggestedMaterialCategory;

  /** Human-readable material label for surveyor and engineer use. */
  readonly label: string;

  /** Optional quantity (e.g. 2 for a pair of valves). Omit when indeterminate. */
  readonly quantity?: number;

  /** Optional unit string (e.g. 'nr', 'metres', 'litres'). Omit when not applicable. */
  readonly unit?: string;

  /**
   * Short narrative describing the sizing basis or selection rationale.
   * May reference cylinder litre capacity, pipe diameter, pressure rating, etc.
   * Omit if sizing is not relevant or not yet determined.
   */
  readonly sizingBasis?: string;

  /** Confidence level for this material requirement. */
  readonly confidence: SuggestedMaterialConfidence;

  /** True if this material must be present for the installation to proceed. */
  readonly requiredForInstall: boolean;

  /** True if this line may be shown to the customer (plain-language items only). */
  readonly customerVisible: boolean;

  /** True if this line is visible to the installing engineer. */
  readonly engineerVisible: boolean;

  /** True if this line is visible to the office / admin team. */
  readonly officeVisible: boolean;

  /**
   * Supplementary notes, e.g. installation considerations or compliance triggers.
   * Empty array if no notes apply.
   */
  readonly notes: readonly string[];

  /**
   * Checks that must be resolved before this material can be confirmed.
   * Empty array if no checks are outstanding.
   */
  readonly unresolvedChecks: readonly string[];
}
