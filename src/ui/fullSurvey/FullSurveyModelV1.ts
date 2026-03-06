import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';

/**
 * HeatingConditionDiagnosticsV1
 *
 * Survey-layer observations about the primary (closed) heating circuit.
 * These are site-visible symptoms captured by the surveyor.
 * They are not physics model inputs — they feed the diagnostic inference layer.
 */
export interface HeatingConditionDiagnosticsV1 {
  /** Whether the heating circuit is open vented or sealed. */
  systemCircuitType?: 'open_vented' | 'sealed' | 'unknown';
  /**
   * Pumping over observed: water rising up the open vent pipe under pump pressure.
   * This is a hydraulic circuit fault — separate from general sludge risk.
   * When true, raises a hard advisory about feed-and-vent connection blockage/restriction.
   */
  pumpingOverObserved?: boolean;
  /** Radiators cold at the bottom — typical sign of magnetite sludge settling. */
  radiatorsColdeAtBottom?: boolean;
  /** Radiators heating unevenly across the circuit. */
  radiatorsHeatingUnevenly?: boolean;
  /** Colour of water when a radiator was bled. Clear = good; brown/black = sludge present. */
  bleedWaterColour?: 'clear' | 'brown' | 'black' | 'unknown';
  /** Magnetic debris or sludge found in filter cartridge or on filter magnet. */
  magneticDebrisEvidence?: boolean;
  /** Circulation pump speed set to maximum — may indicate compensation for flow restriction. */
  pumpSpeedHigh?: boolean;
  /** History of repeated pump or valve replacements — suggests ongoing flow restriction or contamination. */
  repeatedPumpOrValveReplacements?: boolean;
  /** Boiler cavitation or noise on the primary circuit (banging, gurgling, kettling on boiler side). */
  boilerCavitationOrNoise?: boolean;
}

/**
 * DhwConditionDiagnosticsV1
 *
 * Survey-layer observations about the DHW (open secondary) circuit.
 * These are site-visible symptoms captured by the surveyor.
 * They are not physics model inputs — they feed the diagnostic inference layer.
 */
export interface DhwConditionDiagnosticsV1 {
  /** Approximate age of the combi plate heat exchanger in years, or 'unknown'. */
  plateHexAgeYears?: number | 'unknown';
  /** Age band estimate of the hot water cylinder. */
  cylinderAgeEstimate?: 'under_5' | '5_to_10' | '10_to_15' | 'over_15' | 'unknown';
  /** Cylinder construction type — informs coil condition and standing loss estimate. */
  cylinderMaterial?: 'copper_vented' | 'stainless_unvented' | 'unknown';
  /** History of immersion heater failure — indicator of scale or corrosion in the DHW circuit. */
  immersionFailureHistory?: boolean;
  /** Kettling or scale-related noise on the combi heat exchanger or cylinder coil. */
  kettlingOrScaleSymptoms?: boolean;
}

/**
 * FullSurveyModelV1
 *
 * Extends EngineInputV2_3 with survey-only extras that the UI collects but
 * the engine does not yet consume. The extras are kept in UI state only and
 * stripped before the EngineInputV2_3 subset is passed to the engine.
 */
export type FullSurveyModelV1 = EngineInputV2_3 & {
  /** UI-only ErP class field used to suggest a SEDBUK % baseline. */
  currentBoilerErpClass?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  fullSurvey?: {
    /** Manual annual consumption — entered by surveyor. */
    manualEvidence?: {
      annualGasKwh?: number;
      annualElecKwh?: number;
    };
    /** Cooling telemetry — manual proxy for thermal inertia. */
    telemetryPlaceholders?: {
      coolingTau?: number | null;
      confidence?: 'none' | 'low' | 'high';
    };
    /** Heating/primary circuit condition diagnostics — site observations from surveyor. */
    heatingCondition?: HeatingConditionDiagnosticsV1;
    /** DHW/secondary circuit condition diagnostics — site observations from surveyor. */
    dhwCondition?: DhwConditionDiagnosticsV1;
  };
};

/**
 * Extract only the EngineInputV2_3 fields from a FullSurveyModelV1 object.
 * Use this before passing survey state to the engine to ensure no fullSurvey
 * extras leak into the engine contract.
 */
export function toEngineInput(model: FullSurveyModelV1): EngineInputV2_3 {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fullSurvey: _fullSurvey, currentBoilerErpClass: _currentBoilerErpClass, ...engineInput } = model;
  return engineInput;
}
