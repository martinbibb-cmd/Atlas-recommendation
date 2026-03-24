/**
 * FitMapModel.ts — PR9: Canonical fit-map model types.
 *
 * Defines the machine-readable service-shape fit map that describes how well a
 * given appliance family serves a property's heating and DHW demands.
 *
 * The fit map is a downstream, evidence-driven layer.  It is NOT a
 * recommendation engine — it describes the derived shape from
 * real engine evidence (LimiterLedger, DerivedSystemEventSummary,
 * SystemStateTimeline, FamilyRunnerResult).
 *
 * Sequencing:
 *   PR4  fixed stored-water physical phases.
 *   PR5  fixed combi physical phases.
 *   PR6  introduced the canonical internal state timeline.
 *   PR7  derived readable events and counters from that timeline.
 *   PR8  introduced the limiter ledger — explains why a run struggled.
 *   PR9  (this file) derives the service-shape fit map from the above.
 *
 * Design rules:
 *   1. Fit shape must be derived from evidence, not hard-coded family labels alone.
 *   2. Combi naturally narrows on the DHW axis when service-switching exists.
 *   3. Stored systems widen when stored volume and recharge behaviour support concurrency.
 *   4. Heat pump contours reflect recovery latency and high-temp penalties.
 *   5. Evidence items must point back to real limiter IDs or event types.
 *   6. Fit map is descriptive only — no recommendation ranking.
 *   7. Output is deterministic: same inputs always produce same fit map.
 */

import type { ApplianceFamily } from '../topology/SystemTopology';

// ─── Evidence ─────────────────────────────────────────────────────────────────

/**
 * A single piece of evidence that contributed a boost or penalty to a fit-map axis.
 *
 * Every `FitEvidence` item must trace back to a real limiter ID (from
 * `LimiterLedger`), a derived event type (from `DerivedSystemEvent`), or a
 * named module output field.  Evidence must not be invented.
 */
export interface FitEvidence {
  /**
   * Machine-readable identifier for this evidence item.
   * For limiter-derived items this is the limiter ID (e.g. 'combi_service_switching').
   * For event-derived items this is the event type (e.g. 'heating_interrupted_by_dhw').
   * For physics-derived items this is the module output key
   * (e.g. 'heatPumpRegime.designFlowTempBand').
   */
  readonly id: string;

  /**
   * Where this evidence came from.
   *
   *   limiter       — sourced from a `LimiterLedgerEntry` (PR8)
   *   event_counter — sourced from `SystemEventCounters` (PR7)
   *   timeline_mode — sourced from `SystemStateTimeline` service mode analysis (PR6)
   *   physics       — sourced directly from a module output field
   */
  readonly sourceType: 'limiter' | 'event_counter' | 'timeline_mode' | 'physics';

  /**
   * Whether this item raises ('boost') or lowers ('penalty') the axis score.
   *
   * A boost increases the axis score toward 100.
   * A penalty decreases the axis score toward 0.
   *
   * Note: In the current scoring model, axes start at 100 and are only
   * decreased by penalties.  Boosts are reserved for future use when
   * positive evidence (e.g. fast recovery, healthy volume) should push
   * scores above a neutral baseline.
   */
  readonly effect: 'boost' | 'penalty';

  /**
   * Which axis this evidence primarily affects.
   *
   *   heating   — heating continuity / stability (vertical axis)
   *   dhw       — DHW strength / concurrency (horizontal axis)
   *   both      — affects both axes equally
   *   efficiency — contributes to the optional third dimension only
   */
  readonly axis: 'heating' | 'dhw' | 'both' | 'efficiency';

  /**
   * Absolute magnitude of the effect in score points (always a positive number).
   * A penalty of 20 reduces the axis score by 20 points.
   * A boost of 10 increases the axis score by 10 points.
   */
  readonly magnitude: number;

  /**
   * Human-readable description of why this evidence item affects the axis.
   * Written in plain English, suitable for downstream tooltip or explanation copy.
   */
  readonly description: string;
}

// ─── Axis score ───────────────────────────────────────────────────────────────

/**
 * A scored dimension of the service-shape fit map.
 *
 * Scores are in the range [0, 100] (clamped).  A score of 100 means no
 * evidence of constraint on this axis; a score of 0 means the axis is
 * severely constrained by evidence.
 */
export interface FitAxisScore {
  /**
   * Pre-clamp raw score (may exceed 100 if boosts are applied, or fall below 0).
   * Stored separately for auditability; do not use for rendering.
   */
  readonly raw: number;

  /**
   * Clamped score in [0, 100].  Use this for rendering and downstream comparisons.
   */
  readonly score: number;

  /**
   * Ordered list of evidence items that contributed to this axis score.
   * Penalties are listed before boosts.  Within each group, items are ordered
   * by magnitude descending, then by ID ascending for determinism.
   */
  readonly evidence: readonly FitEvidence[];
}

// ─── Contour profile ──────────────────────────────────────────────────────────

/**
 * Derived shape of the service contour for a family run.
 *
 * The contour describes the two-dimensional outline of how well the system
 * serves the property.  It is derived from axis scores and evidence — not
 * from hard-coded family labels, though family-specific defaults seed the
 * derivation before evidence modifies them.
 *
 * Terminology:
 *   vertical   = heating continuity / stability axis (Y)
 *   horizontal = DHW strength / concurrency axis (X)
 */
export interface FitContourProfile {
  /**
   * The appliance family this profile was derived for.
   * Stored for traceability — do not branch on this field in downstream rendering.
   */
  readonly family: ApplianceFamily;

  /**
   * Relative height of the contour on the vertical (heating) axis.
   *
   *   tall  — heatingScore ≥ 70; system provides strong, continuous space heating.
   *   mid   — heatingScore 45–69; some heating constraints or interruption risk.
   *   low   — heatingScore < 45; significant heating continuity constraints.
   */
  readonly verticalShape: 'tall' | 'mid' | 'low';

  /**
   * Relative width of the contour on the horizontal (DHW) axis.
   *
   *   broad  — dhwScore ≥ 70; system can handle concurrent or high-volume DHW.
   *   mid    — dhwScore 45–69; moderate DHW capacity with some concurrency limits.
   *   narrow — dhwScore < 45; DHW is constrained; concurrent demand is problematic.
   */
  readonly horizontalShape: 'narrow' | 'mid' | 'broad';

  /**
   * How rounded the corner of the contour is.
   *
   *   sharp    — direct-draw (combi) or no thermal decoupling; abrupt transitions.
   *   moderate — cylinder-backed system; some thermal buffering between generation and delivery.
   *   soft     — heat pump; large cylinder and slow recovery provide maximum buffering.
   */
  readonly cornerRounding: 'sharp' | 'moderate' | 'soft';

  /**
   * How soft the right edge of the DHW axis is.
   *
   * This represents whether the DHW delivery is hard-limited or gracefully
   * degrades as concurrent demand increases:
   *
   *   hard   — combi or stored with healthy volume; delivery is reliable up to capacity.
   *   medium — stored with some reduced-service evidence; concurrent draws may degrade.
   *   soft   — HP with slow recovery; consecutive draws may cause shortfalls.
   */
  readonly dhwEdgeSoftness: 'hard' | 'medium' | 'soft';

  /**
   * Human-readable notes explaining why this contour took its derived shape.
   * Each note traces back to a specific piece of evidence.
   */
  readonly evidenceNotes: readonly string[];
}

// ─── Fit map model ────────────────────────────────────────────────────────────

/**
 * Complete service-shape fit map for a single engine run.
 *
 * The fit map is a machine-readable description of how well the appliance
 * family matches the property's demands.  It is derived from structured engine
 * evidence (PR6–PR8) and is consumed by downstream rendering and comparison layers.
 *
 * Axes:
 *   heatingAxis  — vertical; heating continuity / stability
 *   dhwAxis      — horizontal; DHW strength / concurrency
 *   efficiencyScore — optional third dimension; thermodynamic quality
 *
 * The `contour` field provides the derived shape description for visual rendering.
 * The `evidence` field provides the complete ordered list of all evidence items
 * that affected any axis, suitable for explanation / tooltip copy.
 */
export interface FitMapModel {
  /**
   * The appliance family this fit map was derived for.
   */
  readonly family: ApplianceFamily;

  /**
   * Vertical axis — heating continuity and stability.
   *
   * High score (→ 100): uninterrupted CH, no cycling risk, good emitter fit.
   * Low score (→ 0): frequent CH interruptions, cycling, emitter mismatch.
   */
  readonly heatingAxis: FitAxisScore;

  /**
   * Horizontal axis — DHW strength and concurrency.
   *
   * High score (→ 100): healthy stored volume, fast recovery, no flow constraints.
   * Low score (→ 0): simultaneous demand limits, volume shortfall, slow HP recovery.
   */
  readonly dhwAxis: FitAxisScore;

  /**
   * Optional third dimension — thermodynamic operating quality.
   *
   * Scored [0, 100].  High score = efficient condensing operation, low cycling.
   * Absent if no efficiency evidence was available.
   */
  readonly efficiencyScore?: number;

  /**
   * Derived shape of the service contour.
   * Describes the two-dimensional outline of the system's service capability.
   */
  readonly contour: FitContourProfile;

  /**
   * Complete ordered list of all evidence items that affected any axis.
   *
   * Ordered: penalties before boosts; within each group by magnitude descending,
   * then by ID ascending for determinism.
   *
   * Every item in this list must have an `id` that corresponds to a real limiter
   * ID, event type, or module output key — no invented evidence.
   */
  readonly evidence: readonly FitEvidence[];
}
