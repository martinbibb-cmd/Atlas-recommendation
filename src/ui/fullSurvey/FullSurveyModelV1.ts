import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { SystemBuilderState } from '../../features/survey/systemBuilder/systemBuilderTypes';
import type { WaterQualityState } from '../../features/survey/services/waterQualityTypes';

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
  radiatorsColdAtBottom?: boolean;
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
 *
 * Preferred approach: ask about observed performance (hotWaterPerformanceBand,
 * cylinderRetentionBand) rather than specialist component age. Age fields are
 * retained as optional supporting inputs but are no longer the primary signal.
 */
export interface DhwConditionDiagnosticsV1 {
  /** Approximate age of the combi plate heat exchanger in years, or 'unknown'. Supporting input — prefer hotWaterPerformanceBand. */
  plateHexAgeYears?: number | 'unknown';
  /**
   * Observed combi hot-water performance — primary plate HEX condition signal.
   * Ask: "How is the hot water performing?"
   */
  hotWaterPerformanceBand?: 'good' | 'slightly_reduced' | 'fluctuating' | 'poor';
  /** Age band estimate of the hot water cylinder. Supporting input — prefer cylinderRetentionBand. */
  cylinderAgeEstimate?: 'under_5' | '5_to_10' | '10_to_15' | 'over_15' | 'unknown';
  /**
   * Cylinder construction / insulation type.
   * Ask: "What best describes the cylinder?"
   */
  cylinderType?: 'modern_factory' | 'foam_lagged' | 'copper' | 'mixergy' | 'unknown';
  /** Cylinder construction type (material) — informs coil condition and standing loss estimate. */
  cylinderMaterial?: 'copper_vented' | 'stainless_unvented' | 'unknown';
  /**
   * Observed hot-water retention / recovery performance.
   * Ask: "How well does the cylinder hold heat?"
   */
  cylinderRetentionBand?: 'good' | 'average' | 'poor';
  /** Whether a water softener is installed — reduces scale risk on plate HEX and coil. */
  softenerPresent?: boolean;
  /** History of immersion heater failure — indicator of scale or corrosion in the DHW circuit. */
  immersionFailureHistory?: boolean;
  /** Kettling or scale-related noise on the combi heat exchanger or cylinder coil. */
  kettlingOrScaleSymptoms?: boolean;

  // ── Current cylinder (pre-existing installation) ─────────────────────────
  /** Whether a hot water cylinder is currently installed. */
  currentCylinderPresent?: boolean;
  /** Type of the current cylinder. */
  currentCylinderType?: 'vented' | 'unvented' | 'mixergy' | 'unknown';
  /** Nominal volume of the current cylinder in litres, or 'unknown'. */
  currentCylinderVolumeLitres?: number | 'unknown';
  /** Approximate age band of the current cylinder. */
  currentCylinderAgeBand?: 'under_5' | '5_to_10' | '10_to_15' | 'over_15' | 'unknown';
  /** Observed condition of the current cylinder. */
  currentCylinderCondition?: 'good' | 'average' | 'poor' | 'unknown';
  /**
   * Available gravity head above the draw-off point (metres) — vented systems only.
   * Determines flow pressure for open-vented installations.
   */
  currentCwsHeadMetres?: number | 'unknown';
  /**
   * Surveyor's intent for the hot water system.
   * - 'keep'    — keep the existing system as-is
   * - 'replace' — intend to replace (new system to be selected)
   * - 'unsure'  — not yet decided
   */
  dhwUpgradeIntent?: 'keep' | 'replace' | 'unsure';
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
    /**
     * UI-only flag: show Mixergy comparison in results even when standard
     * cylinder is the selected proposed type.  Persisted in working_payload
     * so the choice survives step navigation and save/reload.
     */
    compareMixergy?: boolean;
    /**
     * System Architecture step — captures heat source, DHW type, emitters,
     * pipework, controls, and existing asset health.
     * Normalised into engine-friendly format by systemBuilderNormalizer before
     * being passed to the engine.
     */
    systemBuilder?: SystemBuilderState;
    /**
     * Services step — captures incoming supply properties, starting with
     * water quality (hardness, limescale risk, silicate scaffold risk).
     * Normalised by waterQualityNormalizer for later degradation / longevity
     * modelling.
     */
    waterQuality?: WaterQualityState;
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
