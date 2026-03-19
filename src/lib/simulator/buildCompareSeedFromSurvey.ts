// src/lib/simulator/buildCompareSeedFromSurvey.ts
//
// Canonical compare seed builder for the Simulator Dashboard.
//
// Given a completed FullSurveyModelV1 and the EngineOutputV1 produced from it,
// returns a CompareSeed that pre-populates both simulator columns:
//
//   left  — Current system, truthfully seeded from surveyed state.
//   right — Proposed system, seeded from the engine's first viable recommendation.
//
// Design rules:
//   - Reuses adaptFullSurveyToSimulatorInputs for the current-system (left) side.
//   - The proposed (right) side inherits mains / occupancy truth from the survey
//     but applies "new installation" defaults for system condition and controls.
//   - Never duplicates occupancy, DHW or heating logic — delegates to the
//     canonical builders already used elsewhere in the stack.
//   - No throwing — all missing / malformed fields produce clean fallbacks.

import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1'
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1'
import type { SystemInputs, ControlStrategy, CylinderType } from '../../explainers/lego/simulator/systemInputsTypes'
import { DEFAULT_SYSTEM_INPUTS, CYLINDER_SIZES_BY_TYPE } from '../../explainers/lego/simulator/systemInputsTypes'
import type { SimulatorSystemChoice } from '../../explainers/lego/simulator/useSystemDiagramPlayback'
import { adaptFullSurveyToSimulatorInputs } from '../../explainers/lego/simulator/adaptFullSurveyToSimulatorInputs'
import type { MainsSupply, ProposedSupplyAdjustment } from './mainsSupply'
import { extractMainsSupplyFromSurvey, getEffectiveProposedMainsSupply } from './mainsSupply'

// ─── Public types ─────────────────────────────────────────────────────────────

/** One side of a compare seed — system choice + initial inputs. */
export type CompareSeedSide = {
  systemChoice: SimulatorSystemChoice
  systemInputs: Partial<SystemInputs>
}

// Re-export supply types so consumers can import from one place.
export type { MainsSupply, ProposedSupplyAdjustment } from './mainsSupply'
export { extractMainsSupplyFromSurvey, getEffectiveProposedMainsSupply } from './mainsSupply'

/**
 * Compare mode — describes the relationship between the two sides.
 *
 * current_vs_proposed   — left = surveyed current system, right = atlas recommendation
 * proposed_vs_cheapest  — reserved for future use
 * proposed_vs_future    — reserved for future use
 */
export type CompareMode =
  | 'current_vs_proposed'
  | 'proposed_vs_cheapest'
  | 'proposed_vs_future'

/** Output of buildCompareSeedFromSurvey. */
export type CompareSeed = {
  /** Left column — current (surveyed) system. */
  left: CompareSeedSide
  /** Right column — proposed/recommended system. */
  right: CompareSeedSide
  /** Relationship between the two sides. */
  compareMode: CompareMode
  /** Human-readable comparison label, e.g. "Current system vs Proposed system". */
  comparisonLabel: string
  /**
   * Canonical measured mains supply extracted from the survey.
   *
   * Both simulator cards are seeded from this value — house mains are a
   * property fact and do not change based on which system is chosen.
   * Only present when survey data was available (not populated for the
   * generic default compare seed).
   */
  measuredMainsSupply?: MainsSupply
  /**
   * Any supply-side infrastructure upgrade that is part of the recommendation.
   *
   * When absent or type === 'none', both cards show the same measured supply.
   * When a booster/accumulator/break-tank is proposed, the proposed card
   * shows adjusted values via getEffectiveProposedMainsSupply().
   */
  proposedSupplyAdjustment?: ProposedSupplyAdjustment
}

// ─── Option ID → SimulatorSystemChoice mapping ───────────────────────────────

/** Maps EngineOutputV1 option IDs to the corresponding SimulatorSystemChoice. */
const OPTION_ID_TO_SYSTEM_CHOICE: Record<
  'combi' | 'stored_vented' | 'stored_unvented' | 'ashp' | 'regular_vented' | 'system_unvented',
  SimulatorSystemChoice
> = {
  combi:            'combi',
  stored_vented:    'open_vented',
  stored_unvented:  'unvented',
  ashp:             'heat_pump',
  regular_vented:   'open_vented',
  system_unvented:  'unvented',
}

/** Maps a SimulatorSystemChoice to its default ControlStrategy for a new installation. */
function controlStrategyForChoice(choice: SimulatorSystemChoice): ControlStrategy {
  switch (choice) {
    case 'combi':       return 'combi'
    case 'unvented':    return 's_plan'
    case 'open_vented': return 'y_plan'
    case 'heat_pump':   return 'heat_pump'
    case 'mixergy':     return 's_plan'
  }
}

/** Maps a SimulatorSystemChoice to its default CylinderType for a new installation. */
function cylinderTypeForChoice(choice: SimulatorSystemChoice): CylinderType | undefined {
  switch (choice) {
    case 'unvented':    return 'unvented'
    case 'open_vented': return 'open_vented'
    case 'heat_pump':   return 'unvented'
    case 'mixergy':     return 'mixergy'
    case 'combi':       return undefined
  }
}

// ─── New-installation defaults ───────────────────────────────────────────────

/**
 * Emitter capacity factor applied to the proposed (right) column in compare mode
 * for a new installation.
 *
 * A value of 1.2 represents moderately oversized emitters (20% above standard
 * sizing), which is achievable by specifying slightly larger radiators during
 * a system upgrade without requiring a full UFH or low-temp emitter replacement.
 * This improves condensing margin on the proposed system without being unrealistic.
 *
 * Note: the SimulatorDashboard generic improved preset uses 1.3 (a more aggressive
 * improvement for the non-survey generic compare path). Survey-backed proposed
 * systems use 1.2 because we are modelling a realistic upgrade, not an ideal.
 */
const PROPOSED_SYSTEM_EMITTER_CAPACITY_FACTOR = 1.2

// ─── Simulator-accepted ranges for mains supply inputs ───────────────────────
// These mirror the constraints in adaptFullSurveyToSimulatorInputs and the
// SystemInputsPanel slider bounds.  Centralised here so both places agree.

/** Minimum mains pressure the simulator accepts (bar). Below this is out of domestic range. */
const MIN_SIMULATOR_PRESSURE_BAR = 0.5
/** Maximum mains pressure the simulator accepts (bar). Domestic supply rarely exceeds 6 bar. */
const MAX_SIMULATOR_PRESSURE_BAR = 6.0
/** Minimum mains flow rate the simulator accepts (L/min). Allows very low-flow scenarios. */
const MIN_SIMULATOR_FLOW_LPM = 3
/** Maximum mains flow rate the simulator accepts (L/min). Covers high-flow boosted supplies. */
const MAX_SIMULATOR_FLOW_LPM = 50

/**
 * Build a compare seed from a completed full survey and its engine output.
 *
 * The left side is the surveyed current system (via adaptFullSurveyToSimulatorInputs).
 * The right side is the first viable recommendation from the engine output,
 * with improved operating assumptions applied (new installation defaults).
 *
 * Falls back gracefully:
 *   - If no viable option exists, picks the first caution option.
 *   - If no options at all, defaults to `combi` (safe generic proposed state).
 */
export function buildCompareSeedFromSurvey(
  survey: FullSurveyModelV1,
  engineOutput: EngineOutputV1,
): CompareSeed {
  // ── Left (current) side ────────────────────────────────────────────────────
  const left = adaptFullSurveyToSimulatorInputs(survey)

  // ── Canonical measured supply — property fact, not system fact ─────────────
  // Extract from the survey directly so that both sides are seeded from the
  // same house data regardless of the mainsDynamicFlowLpmKnown guard applied
  // by adaptFullSurveyToSimulatorInputs (which is intentionally strict for the
  // simulation engine but too restrictive for supply provenance tracking).
  const measuredMainsSupply = extractMainsSupplyFromSurvey(survey)

  // No supply-side upgrade is encoded in the recommendation at this stage.
  // This field is reserved for future use when a booster/accumulator/break-tank
  // is explicitly included in the recommendation output.
  const proposedSupplyAdjustment: ProposedSupplyAdjustment = { type: 'none' }

  // Effective supply for the proposed system (same as measured when no upgrade).
  const effectiveProposedSupply = getEffectiveProposedMainsSupply(
    measuredMainsSupply,
    proposedSupplyAdjustment,
  )

  // ── Right (proposed) side ──────────────────────────────────────────────────
  // Pick the first viable option; fall back to first caution; then first of any.
  const options = engineOutput.options ?? []
  const proposedOption =
    options.find(o => o.status === 'viable') ??
    options.find(o => o.status === 'caution') ??
    options[0]

  let proposedSystemChoice: SimulatorSystemChoice = 'combi'
  if (proposedOption != null) {
    proposedSystemChoice =
      OPTION_ID_TO_SYSTEM_CHOICE[proposedOption.id] ?? 'combi'
  }

  // Inherit survey mains and occupancy truth (these are property facts, not
  // system facts — both current and proposed system operate in the same house).
  // Mains supply is now sourced from the canonical effectiveProposedSupply so
  // that estimated values (mainsDynamicFlowLpmKnown not set) are still carried
  // through instead of silently falling back to DEFAULT_SYSTEM_INPUTS values.
  const proposedSystemInputs: Partial<SystemInputs> = {}

  // ── Mains supply from canonical supply object ───────────────────────────────
  // Populate pressure and flow from the effective proposed supply, which is
  // the same as the measured supply unless a booster/accumulator is proposed.
  // This supersedes the previous approach of copying from left.systemInputs
  // which dropped estimated values when mainsDynamicFlowLpmKnown was not set.
  if (
    effectiveProposedSupply.dynamicPressureBar != null &&
    effectiveProposedSupply.dynamicPressureBar > 0
  ) {
    // Clamp to the simulator's accepted range.
    proposedSystemInputs.mainsPressureBar = Math.max(
      MIN_SIMULATOR_PRESSURE_BAR,
      Math.min(MAX_SIMULATOR_PRESSURE_BAR, effectiveProposedSupply.dynamicPressureBar),
    )
  } else if (left.systemInputs.mainsPressureBar != null) {
    // Fall back to the left-side value (from adaptFullSurveyToSimulatorInputs)
    // for backward compatibility when no pressure is in the supply object.
    proposedSystemInputs.mainsPressureBar = left.systemInputs.mainsPressureBar
  }

  if (
    effectiveProposedSupply.dynamicFlowLpm != null &&
    effectiveProposedSupply.dynamicFlowLpm > 0
  ) {
    // Clamp to the simulator's accepted range.
    proposedSystemInputs.mainsFlowLpm = Math.max(
      MIN_SIMULATOR_FLOW_LPM,
      Math.min(MAX_SIMULATOR_FLOW_LPM, effectiveProposedSupply.dynamicFlowLpm),
    )
  } else if (left.systemInputs.mainsFlowLpm != null) {
    proposedSystemInputs.mainsFlowLpm = left.systemInputs.mainsFlowLpm
  }

  if (left.systemInputs.heatLossKw != null) {
    proposedSystemInputs.heatLossKw = left.systemInputs.heatLossKw
  }
  if (left.systemInputs.occupancyProfile != null) {
    proposedSystemInputs.occupancyProfile = left.systemInputs.occupancyProfile
  }
  if (left.systemInputs.demandPreset != null) {
    proposedSystemInputs.demandPreset = left.systemInputs.demandPreset
  }

  // Apply "new installation" defaults for the proposed system:
  // - Clean system (no sludge/scale on a new install)
  // - Weather and load compensation enabled (modern best practice)
  // - Slightly oversized emitters to improve condensing margin
  // - 22mm primary pipe (minimum recommended for modern systems)
  proposedSystemInputs.systemCondition = 'clean'
  proposedSystemInputs.weatherCompensation = true
  proposedSystemInputs.loadCompensation = true
  proposedSystemInputs.emitterCapacityFactor = PROPOSED_SYSTEM_EMITTER_CAPACITY_FACTOR
  proposedSystemInputs.primaryPipeSize = '22mm'
  proposedSystemInputs.controlStrategy = controlStrategyForChoice(proposedSystemChoice)

  // Cylinder type and size for stored systems
  const proposedCylinderType = cylinderTypeForChoice(proposedSystemChoice)
  if (proposedCylinderType != null) {
    proposedSystemInputs.cylinderType = proposedCylinderType
    // Default to a mid-range cylinder size for the derived type
    const sizes = CYLINDER_SIZES_BY_TYPE[proposedCylinderType] as readonly number[]
    const midIndex = Math.floor(sizes.length / 2)
    proposedSystemInputs.cylinderSizeLitres =
      left.systemInputs.cylinderSizeLitres != null && proposedCylinderType === left.systemInputs.cylinderType
        ? left.systemInputs.cylinderSizeLitres
        : sizes[midIndex] ?? sizes[0]
  }

  // Inherit boiler output sizing from survey when available
  if (left.systemInputs.boilerOutputKw != null) {
    proposedSystemInputs.boilerOutputKw = left.systemInputs.boilerOutputKw
  }

  // For combi proposals, inherit combi power rating
  if (proposedSystemChoice === 'combi' && left.systemInputs.combiPowerKw != null) {
    proposedSystemInputs.combiPowerKw = left.systemInputs.combiPowerKw
  }

  return {
    left: {
      systemChoice: left.systemChoice,
      systemInputs: left.systemInputs,
    },
    right: {
      systemChoice: proposedSystemChoice,
      systemInputs: proposedSystemInputs,
    },
    compareMode: 'current_vs_proposed',
    comparisonLabel: 'Current system vs Proposed system',
    measuredMainsSupply,
    proposedSupplyAdjustment,
  }
}

/**
 * Default compare seed used when no survey data is available.
 * Provides a clean generic state so compare mode never opens empty.
 */
export function buildDefaultCompareSeed(): CompareSeed {
  return {
    left: {
      systemChoice: 'combi',
      systemInputs: {},
    },
    right: {
      systemChoice: 'unvented',
      systemInputs: {
        ...DEFAULT_SYSTEM_INPUTS,
        weatherCompensation: true,
        loadCompensation: true,
        emitterCapacityFactor: 1.2,
        primaryPipeSize: '22mm',
        systemCondition: 'clean',
        controlStrategy: 's_plan',
      },
    },
    compareMode: 'current_vs_proposed',
    comparisonLabel: 'Current system vs Proposed system',
  }
}
