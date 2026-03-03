/**
 * Pure helpers for the pressure/flow gauge inputs in FullSurveyStepper.
 *
 * Extracted into their own module so they can be unit-tested without rendering
 * the full stepper component, and so the stepper file only exports the default
 * component (keeping react-refresh/only-export-components satisfied).
 */

/**
 * Computes the initial raw string for the dynamic-pressure input field from
 * an already-merged initial input object.
 *
 * Prefers `dynamicMainsPressureBar` (new alias) over the legacy
 * `dynamicMainsPressure` field so Story Mode / restored-model prefills that
 * only set the new field still render the correct value on first mount.
 */
export function deriveRawPressureStr(init: {
  dynamicMainsPressure: number;
  dynamicMainsPressureBar?: number;
}): string {
  return String(init.dynamicMainsPressureBar ?? init.dynamicMainsPressure);
}

/**
 * Computes the initial raw string for the dynamic-flow input field from an
 * already-merged initial input object.
 *
 * Returns an empty string when no flow measurement is present (the field is
 * optional — leave blank if not taken).
 */
export function deriveRawFlowStr(init: { mainsDynamicFlowLpm?: number }): string {
  return init.mainsDynamicFlowLpm != null ? String(init.mainsDynamicFlowLpm) : '';
}
