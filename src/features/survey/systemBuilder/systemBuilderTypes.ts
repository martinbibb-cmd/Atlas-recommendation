/**
 * systemBuilderTypes.ts
 *
 * UI state model for the System Architecture step.
 * This captures the physical architecture of the existing heating and hot-water
 * system and normalises later into EngineInputV2_3 via systemBuilderNormalizer.
 */

// ─── Heat Source ─────────────────────────────────────────────────────────────

export type HeatSource = 'regular' | 'system' | 'combi' | 'storage_combi';

// ─── DHW Architecture ────────────────────────────────────────────────────────

/** All possible DHW types across all heat sources. */
export type DhwType =
  | 'open_vented'
  | 'unvented'
  | 'thermal_store'
  | 'plate_hex'
  | 'small_store';

// ─── Emitters ────────────────────────────────────────────────────────────────

export type EmitterType =
  | 'radiators_standard'
  | 'radiators_designer'
  | 'underfloor'
  | 'mixed';

// ─── Pipework ─────────────────────────────────────────────────────────────────

export type PrimaryPipeSize = 15 | 22 | 28 | 'unknown';
export type PipeLayout = 'two_pipe' | 'one_pipe' | 'manifold' | 'microbore' | 'unknown';

// ─── Controls ─────────────────────────────────────────────────────────────────

export type ControlFamily =
  | 'combi_integral'
  | 'y_plan'
  | 's_plan'
  | 's_plan_plus'
  | 'thermal_store'
  | 'unknown';

export type ThermostatStyle = 'basic' | 'programmable' | 'smart' | 'unknown';

export type ProgrammerType =
  | 'integral'          // built into the appliance (combi)
  | 'electromechanical' // basic dial/pin timer
  | 'digital'           // digital 7-day programmer
  | 'smart'             // internet-connected / app-linked
  | 'none'              // no programmer installed
  | 'unknown';

// ─── Regular-boiler system detail ─────────────────────────────────────────────
// Only relevant when heatSource === 'regular'.

/** Whether the heating circuit is open-vented or sealed. */
export type HeatingSystemType = 'open_vented' | 'sealed' | 'unknown';

/** Whether the primary pipework is accessible for inspection or replacement. */
export type PipeworkAccess = 'accessible' | 'buried' | 'unknown';

// ─── Shower ───────────────────────────────────────────────────────────────────

/**
 * Type of shower(s) currently installed in the property.
 *
 * Used to derive a shower compatibility warning whenever the hot water
 * system is changed — the surveyor should flag this to the customer.
 *
 *  - 'electric':      Electric shower with its own in-line element — completely
 *                     independent of the boiler hot-water supply.  A new boiler
 *                     does not affect it.
 *  - 'mixer':         Standard mixer bar shower — requires balanced hot/cold
 *                     supply pressure.  Mains-fed (unvented) systems work well
 *                     here; tank-fed gravity supplies may give low-pressure mixing.
 *  - 'pumped_mixer':  Gravity-fed system boosted by a dedicated shower pump.
 *                     Incompatible with mains-pressure (unvented) systems unless
 *                     the pump is removed or bypassed.
 *  - 'power_shower':  Pump-in-unit power shower — same tank-fed pump dependency
 *                     as 'pumped_mixer'.  Will not work with mains unvented.
 *  - 'thermostatic':  Thermostatic mixer valve (TMV) — requires balanced supply
 *                     pressures (hot and cold at comparable bar).  Works well
 *                     with unvented; may need a pressure-reducing valve on the
 *                     hot side if moving from gravity to mains.
 *  - 'multiple':      More than one shower type is installed in the property.
 *  - 'none':          No shower — baths only.
 *  - 'unknown':       Not yet assessed.
 */
export type CurrentShowerType =
  | 'electric'
  | 'mixer'
  | 'pumped_mixer'
  | 'power_shower'
  | 'thermostatic'
  | 'multiple'
  | 'none'
  | 'unknown';

// ─── Cylinder (current installation) ─────────────────────────────────────────
// Only relevant when heatSource is 'regular' or 'system' (i.e. a separate
// cylinder is physically present).

/** Age band of the existing hot-water cylinder. */
export type CylinderAgeBand =
  | 'under_5'
  | '5_to_10'
  | '10_to_15'
  | 'over_15'
  | 'unknown';

/** Construction / insulation category of the existing cylinder. */
export type CylinderInsulationType =
  | 'modern_factory'   // factory-insulated, well-lagged
  | 'foam_lagged'      // retro-fitted foam jacket
  | 'copper_bare'      // bare or poorly-lagged copper
  | 'mixergy'          // Mixergy smart cylinder
  | 'unknown';

/** Observed condition of the existing cylinder. */
export type CylinderCondition = 'good' | 'average' | 'poor' | 'unknown';

// ─── Asset health ─────────────────────────────────────────────────────────────

export type SedbukBand = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'unknown';
export type ServiceHistory = 'regular' | 'irregular' | 'unknown';

// ─── System condition signals ─────────────────────────────────────────────────
// Captured during the system-condition section of System Builder.
// These signals feed directly into condition grading and quick-win logic.

/** Colour of water observed when bleeding radiators. */
export type BleedWaterColour =
  | 'clear'
  | 'slightly_discoloured'
  | 'dark'
  | 'sludge'
  | 'unknown';

/** Radiator heat distribution across the system. */
export type RadiatorPerformance =
  | 'all_even'
  | 'some_cold_spots'
  | 'many_cold';

/** Noise or poor-flow issues on the heating circuit. */
export type CirculationIssues =
  | 'none'
  | 'occasional_noise'
  | 'frequent_noise_or_poor_flow';

/** Whether a magnetic system filter is fitted. */
export type MagneticFilter =
  | 'fitted'
  | 'not_fitted'
  | 'unknown';

/** System cleaning / power-flush history. */
export type CleaningHistory =
  | 'never_cleaned'
  | 'cleaned_over_5_years_ago'
  | 'recently_cleaned'
  | 'unknown';

// ─── Complete UI state ────────────────────────────────────────────────────────

/**
 * SystemBuilderState
 *
 * Lean UI model that captures the physical architecture of the existing
 * heating and hot-water system.  Deliberately minimal — later normalised
 * into EngineInputV2_3 by systemBuilderNormalizer.
 */
export type SystemBuilderState = {
  heatSource: HeatSource | null;
  dhwType: DhwType | null;
  emitters: EmitterType | null;
  primarySize: PrimaryPipeSize | null;
  layout: PipeLayout | null;
  controlFamily: ControlFamily | null;
  thermostatStyle: ThermostatStyle | null;
  programmerType: ProgrammerType | null;
  boilerAgeYears: number | null;
  sedbukBand: SedbukBand | null;
  serviceHistory: ServiceHistory | null;
  /** Only captured when heatSource === 'regular'. */
  heatingSystemType: HeatingSystemType | null;
  /** Only captured when heatSource === 'regular'. */
  pipeworkAccess: PipeworkAccess | null;
  // ── System condition signals ───────────────────────────────────────────────
  bleedWaterColour: BleedWaterColour | null;
  radiatorPerformance: RadiatorPerformance | null;
  circulationIssues: CirculationIssues | null;
  magneticFilter: MagneticFilter | null;
  cleaningHistory: CleaningHistory | null;
  // ── Current cylinder (only when heatSource is 'regular' or 'system') ───────
  /** Approximate age band of the existing hot-water cylinder. */
  cylinderAgeBand: CylinderAgeBand | null;
  /** Nominal volume of the existing cylinder in litres (leave null if unknown). */
  cylinderVolumeL: number | null;
  /** Construction / insulation type of the existing cylinder. */
  cylinderInsulationType: CylinderInsulationType | null;
  /** Observed condition of the existing cylinder. */
  cylinderCondition: CylinderCondition | null;
  /** Whether an immersion heater is fitted as backup. */
  cylinderHasImmersion: boolean | null;
  // ── Shower setup ─────────────────────────────────────────────────────────
  /** Primary shower type installed in the property. Drives compatibility warnings. */
  currentShowerType: CurrentShowerType | null;
  /** Whether an electric shower is installed (may coexist with other shower types). */
  electricShowerPresent: boolean | null;
  /** Whether a pumped/gravity shower is installed (shower pump or power shower unit). */
  pumpedShowerPresent: boolean | null;
};

export const INITIAL_SYSTEM_BUILDER_STATE: SystemBuilderState = {
  heatSource: null,
  dhwType: null,
  emitters: null,
  primarySize: null,
  layout: null,
  controlFamily: null,
  thermostatStyle: null,
  programmerType: null,
  boilerAgeYears: null,
  sedbukBand: null,
  serviceHistory: null,
  heatingSystemType: null,
  pipeworkAccess: null,
  bleedWaterColour: null,
  radiatorPerformance: null,
  circulationIssues: null,
  magneticFilter: null,
  cleaningHistory: null,
  cylinderAgeBand: null,
  cylinderVolumeL: null,
  cylinderInsulationType: null,
  cylinderCondition: null,
  cylinderHasImmersion: null,
  currentShowerType: null,
  electricShowerPresent: null,
  pumpedShowerPresent: null,
};
