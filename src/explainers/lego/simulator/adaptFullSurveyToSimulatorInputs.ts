// src/explainers/lego/simulator/adaptFullSurveyToSimulatorInputs.ts
//
// Full-survey → simulator input adapter.
//
// Maps a completed FullSurveyModelV1 into the subset of SystemInputs and a
// SimulatorSystemChoice that the simulator can use as an initial configuration.
//
// Design rules:
//   - Only populate fields where the survey provides meaningful signal.
//   - Never lock or override user choices — values are initial defaults only.
//   - The returned partial is merged over DEFAULT_SYSTEM_INPUTS in SimulatorDashboard.
//   - No mutation of the source survey object.
//   - No throwing — all missing / malformed fields produce clean fallbacks.
//
// Condition derivation priority:
//   1. sludged — any sludge indicator on the heating (primary) circuit.
//   2. scaled  — kettling / scale symptom on the DHW side.
//   3. clean   — no derogatory indicators found.

import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1'
import type { SystemInputs, CylinderType, PrimaryPipeSize, ControlStrategy } from './systemInputsTypes'
import type { SimulatorSystemChoice } from './useSystemDiagramPlayback'
import { CYLINDER_SIZES_BY_TYPE } from './systemInputsTypes'

// ─── Result type ──────────────────────────────────────────────────────────────

export type SurveySimulatorAdapterResult = {
  /** Best-fit simulator system choice derived from the survey. */
  systemChoice: SimulatorSystemChoice
  /**
   * Partial SystemInputs populated from survey data.
   * Merge over DEFAULT_SYSTEM_INPUTS — absent fields keep their defaults.
   */
  systemInputs: Partial<SystemInputs>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp a number to [min, max]. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** Map a numeric pipe diameter (mm) to the nearest valid PrimaryPipeSize. */
function pipeSizeFromDiameter(mm: number): PrimaryPipeSize | undefined {
  if (mm >= 25) return '28mm'
  if (mm >= 19) return '22mm'
  if (mm >= 14) return '15mm'
  return undefined
}

/**
 * Nearest valid cylinder size for the given type.
 * Picks the closest size in the valid list; falls back to the list's first
 * entry when the input is out of range.
 */
function nearestCylinderSize(litres: number, type: CylinderType): number {
  const sizes = CYLINDER_SIZES_BY_TYPE[type] as readonly number[]
  return sizes.reduce((best, s) =>
    Math.abs(s - litres) < Math.abs(best - litres) ? s : best,
    sizes[0],
  )
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

/**
 * Adapt a completed FullSurveyModelV1 into simulator initial configuration.
 *
 * Returns the best-fit systemChoice and a Partial<SystemInputs> that can be
 * merged over DEFAULT_SYSTEM_INPUTS before the simulator is opened.
 *
 * Any survey field that is absent, zero, or out of range is silently skipped
 * so that DEFAULT_SYSTEM_INPUTS values are preserved for those fields.
 */
export function adaptFullSurveyToSimulatorInputs(
  survey: FullSurveyModelV1,
): SurveySimulatorAdapterResult {
  const systemInputs: Partial<SystemInputs> = {}

  // ── Mains pressure ─────────────────────────────────────────────────────────
  // Prefer the explicit bar alias; fall back to the legacy field.
  const dynBar = survey.dynamicMainsPressureBar ?? survey.dynamicMainsPressure
  if (dynBar != null && dynBar > 0) {
    systemInputs.mainsPressureBar = clamp(dynBar, 1.5, 6.0)
  }

  // ── Mains flow — confirmed measurements only ────────────────────────────────
  // Unconfirmed estimates are discarded to avoid presenting a heuristic as
  // a measured value (mirrors the rule in sim/surveyAdapter.ts).
  if (
    survey.mainsDynamicFlowLpm != null &&
    survey.mainsDynamicFlowLpm > 0 &&
    survey.mainsDynamicFlowLpmKnown === true
  ) {
    systemInputs.mainsFlowLpm = clamp(survey.mainsDynamicFlowLpm, 10, 50)
  }

  // ── Primary pipe size ───────────────────────────────────────────────────────
  if (survey.primaryPipeDiameter != null && survey.primaryPipeDiameter > 0) {
    const pipeSize = pipeSizeFromDiameter(survey.primaryPipeDiameter)
    if (pipeSize != null) {
      systemInputs.primaryPipeSize = pipeSize
    }
  }

  // ── Combi boiler rated output ────────────────────────────────────────────────
  if (survey.currentBoilerOutputKw != null && survey.currentBoilerOutputKw > 0) {
    systemInputs.combiPowerKw = clamp(survey.currentBoilerOutputKw, 18, 42)
  }

  // ── System condition ────────────────────────────────────────────────────────
  // Sludge indicators take priority over scale indicators because magnetite
  // contamination is a whole-circuit risk and the simulator can only hold one
  // condition value.
  const hc = survey.fullSurvey?.heatingCondition
  const dc = survey.fullSurvey?.dhwCondition

  const hasSludgeSignal =
    hc?.bleedWaterColour === 'brown' ||
    hc?.bleedWaterColour === 'black' ||
    hc?.magneticDebrisEvidence === true ||
    hc?.radiatorsColdAtBottom === true

  const hasScaleSignal = dc?.kettlingOrScaleSymptoms === true

  if (hasSludgeSignal) {
    systemInputs.systemCondition = 'sludged'
  } else if (hasScaleSignal) {
    systemInputs.systemCondition = 'scaled'
  }
  // else: leave absent → DEFAULT_SYSTEM_INPUTS 'clean' is preserved

  // ── Cylinder type ───────────────────────────────────────────────────────────
  // Mixergy is identified by the named cylinder type field.
  // For conventional cylinders, the material/construction type is used.
  // This is derived before systemChoice so that the cylinder type can inform
  // the simulator system choice for system/regular boiler configurations.
  let derivedCylinderType: CylinderType | undefined

  if (dc?.cylinderType === 'mixergy') {
    derivedCylinderType = 'mixergy'
  } else if (dc?.cylinderMaterial === 'stainless_unvented') {
    derivedCylinderType = 'unvented'
  } else if (dc?.cylinderMaterial === 'copper_vented') {
    derivedCylinderType = 'open_vented'
  }

  // Fall back: infer cylinder type from heat-source type when not explicitly available
  const heatSourceType = survey.currentHeatSourceType

  if (derivedCylinderType == null) {
    if (heatSourceType === 'regular') {
      derivedCylinderType = 'open_vented'
    } else if (heatSourceType === 'system' || heatSourceType === 'ashp') {
      derivedCylinderType = 'unvented'
    }
    // combi / other / absent → leave undefined → DEFAULT preserved
  }

  if (derivedCylinderType != null) {
    systemInputs.cylinderType = derivedCylinderType
    // Snap cylinder size to the nearest valid size for this type.
    // We don't have a survey size field, so use the list default.
    const defaultSize = CYLINDER_SIZES_BY_TYPE[derivedCylinderType][0]
    systemInputs.cylinderSizeLitres = nearestCylinderSize(
      // If there's a future cylinderVolumeLitres field we'd use it here;
      // for now snap to the type's default opening size.
      defaultSize,
      derivedCylinderType,
    )
  }

  // ── System choice ───────────────────────────────────────────────────────────
  let systemChoice: SimulatorSystemChoice = 'combi' // safe default

  if (heatSourceType === 'combi') {
    systemChoice = 'combi'
  } else if (heatSourceType === 'system') {
    // System boiler always has a cylinder.
    // Use the derived cylinder type to pick open_vented vs unvented.
    systemChoice = derivedCylinderType === 'open_vented' ? 'open_vented' : 'unvented'
  } else if (heatSourceType === 'regular') {
    // Regular / heat-only boiler → open vented cylinder with CWS cistern.
    systemChoice = 'open_vented'
  } else if (heatSourceType === 'ashp') {
    systemChoice = 'heat_pump'
  }
  // 'other', undefined → keep 'combi' default

  // ── Control strategy ────────────────────────────────────────────────────────
  // Provide the most common default for the derived system choice.
  // This is a pre-fill only — users can change it in the stepper or inputs panel.
  // We do NOT silently lock it; it is exposed as an editable initial value.
  let controlStrategy: ControlStrategy
  switch (systemChoice) {
    case 'combi':       controlStrategy = 'combi';      break
    case 'unvented':    controlStrategy = 's_plan';     break
    case 'open_vented': controlStrategy = 'y_plan';     break
    case 'heat_pump':   controlStrategy = 'heat_pump';  break
  }
  systemInputs.controlStrategy = controlStrategy

  return { systemChoice, systemInputs }
}
