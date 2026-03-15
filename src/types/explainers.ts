/**
 * explainers.ts
 *
 * Shared type definitions for customer-facing physics explainer components.
 *
 * These types are used by DrivingStylePhysicsExplainer and its associated
 * row-descriptor generation module.  They are intentionally kept separate from
 * engine types so explainer logic can be tested and consumed independently.
 */

// ─── System focus ─────────────────────────────────────────────────────────────

/** Which heating system type a row represents. */
export type DrivetrainId = 'combi' | 'system' | 'mixergy' | 'heatpump';

/**
 * Which row(s) the component should highlight.
 * 'all' renders all four with equal prominence.
 */
export type SystemFocus = DrivetrainId | 'all';

// ─── Input context ────────────────────────────────────────────────────────────

/**
 * Occupancy usage signature — maps to OccupancySignature in the engine
 * but is kept as a standalone union here so the explainer has no hard
 * dependency on engine schema types.
 */
export type ExplainerOccupancySignature = 'professional' | 'steady' | 'shift';

/** Controls quality that influences the Mixergy / hyper-miler row. */
export type ExplainerControlsQuality = 'basic' | 'good' | 'excellent';

// ─── Static row descriptor ────────────────────────────────────────────────────

/**
 * Shape of the still path/track line rendered for each row.
 *   jagged-reverse — combi: backward notch near start, then spiky forward
 *   steady         — system: mostly straight with mild undulation
 *   smooth         — mixergy: clean smooth curve
 *   slow-smooth    — heat pump: smooth curve, finish marker shifted left
 */
export type PathVariant = 'jagged-reverse' | 'steady' | 'smooth' | 'slow-smooth';

/**
 * Relative energy-use rank.
 * 4 = highest energy use (combi), 1 = lowest (heat pump).
 */
export type EnergyRank = 1 | 2 | 3 | 4;

/**
 * Static descriptor for a single row in the DrivingStylePhysicsExplainer
 * infographic.  Generated once by buildDrivingStyleRows() and consumed
 * declaratively by the component — no animation or phase logic.
 */
export interface DrivingStyleRow {
  /** Drivetrain identifier used for keying and CSS modifiers. */
  id: DrivetrainId;
  /** Primary heading — the driving analogy label. */
  title: string;
  /** Secondary descriptor line. */
  subtitle: string;
  /** Short vehicle-analogy label (used in compact mode). */
  vehicleLabel: string;
  /** Heating system label shown alongside the title. */
  systemLabel: string;
  /** Shape of the fixed track/path glyph. */
  pathVariant: PathVariant;
  /** Energy-use rank: 4 = most energy consumed, 1 = least. */
  energyRank: EnergyRank;
  /** Short badge describing the power characteristic. */
  powerBadge: string;
  /** Optional informational chip (e.g. "Stored hot water buffer"). */
  eventChip?: string;
  /**
   * Optional warning chip shown on the combi row.
   * Present when peakConcurrentOutlets >= 2; absent otherwise.
   */
  warningChip?: string;
  /** One-line caption explaining this system's behaviour. */
  caption: string;
}

// ─── Explainer props ──────────────────────────────────────────────────────────

/** Props accepted by DrivingStylePhysicsExplainer. */
export interface DrivingStylePhysicsExplainerProps {
  /**
   * Which system to emphasise.  Defaults to 'all' — all four rows shown with
   * equal prominence.
   */
  systemFocus?: SystemFocus;
  /**
   * Number of concurrent hot-water outlets in the household.
   * When >= 2, the combi row shows a strengthened warning chip.
   */
  peakConcurrentOutlets?: number;
  /** Household occupancy pattern. */
  occupancySignature?: ExplainerOccupancySignature;
  /** Quality of heating controls — influences Mixergy row descriptor. */
  controlsQuality?: ExplainerControlsQuality;
  /** Whether a Mixergy cylinder is installed. */
  hasMixergy?: boolean;
  /**
   * Compact mode — collapses each row to label + small path glyph +
   * energy bar + short caption.  Suitable for PDF/report contexts.
   */
  compact?: boolean;
  /**
   * Enable the optional CSS animation layer on vehicle tokens.
   *
   * Defaults to `true` — tokens animate on mount, then settle into the
   * static diagram after ~4 seconds.
   *
   * Set to `false` for print/PDF contexts where animation is unwanted.
   * When `false` the component renders exactly as its static version.
   *
   * Animation only affects vehicle token position (CSS transform).
   * It never modifies the static data model or path tracks.
   */
  animate?: boolean;
}

// ─── Builder inputs ───────────────────────────────────────────────────────────

/**
 * Inputs consumed by buildDrivingStyleRows().
 * Mirrors DrivingStylePhysicsExplainerProps but with resolved defaults so
 * callers can use the function independently of the component.
 */
export interface DrivingStyleExplainerInput {
  peakConcurrentOutlets: number;
  occupancySignature: ExplainerOccupancySignature;
  controlsQuality: ExplainerControlsQuality;
  hasMixergy: boolean;
}
