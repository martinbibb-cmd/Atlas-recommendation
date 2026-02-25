import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';

/**
 * FullSurveyModelV1
 *
 * Extends EngineInputV2_3 with survey-only extras that the UI collects but
 * the engine does not yet consume. The extras are kept in UI state only and
 * stripped before the EngineInputV2_3 subset is passed to the engine.
 *
 * Placeholders signal future integration points (provider OAuth, Hive telemetry)
 * without blocking the V1 ship.
 */
export type FullSurveyModelV1 = EngineInputV2_3 & {
  /** UI-only ErP class field used to suggest a SEDBUK % baseline. */
  currentBoilerErpClass?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  fullSurvey?: {
    /** Future: provider OAuth / Hive OAuth connection status. */
    connectedEvidence?: {
      energyProvider?: 'placeholder' | 'connected';
      hive?: 'placeholder' | 'connected';
    };
    /** Manual annual consumption — entered by surveyor until provider sync is live. */
    manualEvidence?: {
      annualGasKwh?: number;
      annualElecKwh?: number;
    };
    /** Cooling telemetry placeholders — awaiting Hive or manual proxy. */
    telemetryPlaceholders?: {
      coolingTau?: number | null;
      confidence?: 'none' | 'low' | 'high';
    };
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
