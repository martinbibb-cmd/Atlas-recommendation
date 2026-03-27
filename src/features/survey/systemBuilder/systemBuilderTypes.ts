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

// ─── Asset health ─────────────────────────────────────────────────────────────

export type SedbukBand = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'unknown';
export type ServiceHistory = 'regular' | 'irregular' | 'unknown';

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
};
