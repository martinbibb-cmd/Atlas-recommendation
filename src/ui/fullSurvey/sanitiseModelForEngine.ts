import type { FullSurveyModelV1 } from './FullSurveyModelV1';

/**
 * Cleans and validates a FullSurveyModelV1 before passing it to the engine.
 *
 * - Clamps out-of-range values (boiler age > 50, flow > 60 L/min, static pressure > 10 bar).
 * - Corrects dynamic pressure if it exceeds static pressure.
 * - Bridges flat survey fields (currentBoilerAgeYears, currentHeatSourceType,
 *   currentBoilerOutputKw) into the nested currentSystem.boiler structure that
 *   BoilerEfficiencyModelV1 expects. Existing nested values are never overwritten.
 */
export function sanitiseModelForEngine(model: FullSurveyModelV1): FullSurveyModelV1 {
  const sanitised: FullSurveyModelV1 = { ...model };
  if (sanitised.currentBoilerAgeYears !== undefined && sanitised.currentBoilerAgeYears > 50) {
    sanitised.currentBoilerAgeYears = undefined;
  }
  if (sanitised.mainsDynamicFlowLpm !== undefined && sanitised.mainsDynamicFlowLpm > 60) {
    sanitised.mainsDynamicFlowLpm = undefined;
  }
  if (sanitised.staticMainsPressureBar !== undefined && sanitised.staticMainsPressureBar > 10) {
    sanitised.staticMainsPressureBar = 10;
  }
  const dynamicPressure = sanitised.dynamicMainsPressureBar ?? sanitised.dynamicMainsPressure;
  if (
    sanitised.staticMainsPressureBar !== undefined
    && dynamicPressure !== undefined
    && dynamicPressure > sanitised.staticMainsPressureBar
  ) {
    sanitised.dynamicMainsPressureBar = undefined;
    sanitised.dynamicMainsPressure = sanitised.staticMainsPressureBar;
  }

  // Bridge flat survey fields into currentSystem.boiler so the engine's
  // BoilerEfficiencyModelV1 can apply age-decay and oversize calculations.
  // currentHeatSourceType only covers boiler-based systems (combi/system/regular).
  const boilerType = sanitised.currentHeatSourceType === 'combi'
    || sanitised.currentHeatSourceType === 'system'
    || sanitised.currentHeatSourceType === 'regular'
    ? sanitised.currentHeatSourceType as 'combi' | 'system' | 'regular'
    : undefined;

  if (boilerType !== undefined || sanitised.currentBoilerAgeYears !== undefined || sanitised.currentBoilerOutputKw !== undefined) {
    const existingBoiler = sanitised.currentSystem?.boiler ?? {};
    sanitised.currentSystem = {
      ...sanitised.currentSystem,
      boiler: {
        ...existingBoiler,
        type: existingBoiler.type ?? boilerType,
        ageYears: existingBoiler.ageYears ?? sanitised.currentBoilerAgeYears,
        nominalOutputKw: existingBoiler.nominalOutputKw ?? sanitised.currentBoilerOutputKw,
      },
    };
  }

  return sanitised;
}
