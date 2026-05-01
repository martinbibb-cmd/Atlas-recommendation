// src/lib/simulator/mainsSupply.ts
//
// Canonical mains-supply shared object for the Atlas recommendation engine.
//
// Design rules:
//   - One canonical MainsSupply is extracted from survey data and shared
//     between current and proposed simulator cards — house mains are a
//     property fact and do not magically change because a different system
//     was chosen.
//   - Source tagging distinguishes measured readings from estimates and
//     invented defaults, so the UI can render provenance labels.
//   - The proposed side only diverges from measured supply when a
//     recommendation explicitly includes a supply-side upgrade (booster,
//     accumulator, break tank, etc.) or when removing a combi plate HEX
//     eliminates its inherent pressure-drop penalty.
//   - getEffectiveProposedMainsSupply is the single entry point for both
//     simulator and report/portal code so all surfaces agree on values.

import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Typical pressure drop across a combi boiler plate heat exchanger (bar).
 *
 * A combi's plate HEX sits in the DHW flow path and introduces a pressure loss
 * of ~0.3 bar at domestic flow rates.  When the mains flow test was carried out
 * against an existing combi, the measured flow rate reflects this restriction.
 * If the proposed system removes the combi (replacing it with a stored system),
 * the full mains pressure is available and the effective deliverable flow is
 * proportionally higher.
 */
export const COMBI_HEX_PRESSURE_DROP_BAR = 0.3

// ─── MainsSupply ──────────────────────────────────────────────────────────────

/**
 * Canonical representation of the house mains supply.
 *
 * This is a property fact, not a system fact. Both the current and proposed
 * simulator cards should be seeded from the same MainsSupply object unless
 * the recommendation explicitly includes a supply-side upgrade.
 *
 * source values:
 *   'measured'  — confirmed reading taken with a flow cup or calibrated gauge
 *                 (mainsDynamicFlowLpmKnown === true on the survey).
 *   'estimated' — a value is present on the survey but was not explicitly
 *                 confirmed as a measured reading. May be a surveyor estimate.
 *   'default'   — no survey data at all; comparator is using a safe generic
 *                 fallback. UI should render this clearly as an assumption.
 */
export type MainsSupply = {
  /** Static mains pressure (bar) — measured with no flow. */
  staticPressureBar?: number | null
  /** Dynamic mains pressure (bar) — measured under flow. */
  dynamicPressureBar?: number | null
  /** Dynamic flow rate (L/min) at the measured pressure. */
  dynamicFlowLpm?: number | null
  /** Provenance of the data point. */
  source: 'measured' | 'estimated' | 'default'
}

// ─── ProposedSupplyAdjustment ─────────────────────────────────────────────────

/**
 * Describes any supply-side infrastructure upgrade or physics correction that
 * is part of the proposed recommendation.
 *
 * When type is 'none', the proposed card should show identical supply values
 * to the measured supply — only the suitability interpretation changes by
 * system type, not the underlying house supply numbers.
 *
 * 'combi_hex_removal' represents the benefit of removing the combi plate HEX
 * when switching to a stored system.  The measured mains flow was taken against
 * the combi and therefore under-reports the achievable mains flow without the
 * HEX restriction.  This adjustment corrects the proposed-side flow upward
 * using Q ∝ √P scaling.
 *
 * adjustedDynamicPressureBar / adjustedDynamicFlowLpm are only populated
 * when type is not 'none', and represent the expected post-upgrade supply.
 */
export type ProposedSupplyAdjustment = {
  type: 'none' | 'booster' | 'accumulator' | 'break_tank_pump' | 'combi_hex_removal'
  /** Expected dynamic pressure after the upgrade (bar). */
  adjustedDynamicPressureBar?: number
  /** Expected dynamic flow rate after the upgrade (L/min). */
  adjustedDynamicFlowLpm?: number
  /** Human-readable note explaining the supply upgrade, e.g. "with booster set". */
  note?: string
}

// ─── Extraction ───────────────────────────────────────────────────────────────

/**
 * Extract a canonical MainsSupply from a completed FullSurveyModelV1.
 *
 * Source-tagging rules:
 *   - 'measured'  when mainsDynamicFlowLpmKnown === true
 *   - 'estimated' when a flow value is present but mainsDynamicFlowLpmKnown
 *                 is false or absent (surveyor estimate / legacy data)
 *   - 'default'   when neither a flow nor a pressure value is present
 *
 * Note: dynamic pressure is always drawn from the survey when provided —
 * it does not require a separate Known flag because the engine treats it
 * as a required field on EngineInputV2_3 with a meaningful default of 1.0.
 */
export function extractMainsSupplyFromSurvey(survey: FullSurveyModelV1): MainsSupply {
  const dynamicPressureBar = survey.dynamicMainsPressureBar ?? survey.dynamicMainsPressure
  // Note: the ?? operator is correct here — both 0 and null/undefined are treated
  // as "no pressure" throughout the engine, so using 0 for dynamicMainsPressureBar
  // correctly falls through to dynamicMainsPressure (which may also be 0 or absent).
  // The hasPressure check below filters out zero regardless.
  const staticPressureBar  = survey.staticMainsPressureBar ?? null

  const rawFlowLpm  = survey.mainsDynamicFlowLpm
  const flowKnown   = survey.mainsDynamicFlowLpmKnown === true
  const hasFlow     = rawFlowLpm != null && rawFlowLpm > 0
  const hasPressure = dynamicPressureBar != null && dynamicPressureBar > 0

  if (!hasFlow && !hasPressure) {
    return { source: 'default' }
  }

  const source: MainsSupply['source'] = hasFlow && flowKnown ? 'measured' : 'estimated'

  return {
    staticPressureBar,
    dynamicPressureBar: hasPressure ? dynamicPressureBar : null,
    dynamicFlowLpm:     hasFlow     ? rawFlowLpm         : null,
    source,
  }
}

// ─── Combi-to-stored supply correction ───────────────────────────────────────

/**
 * Build a ProposedSupplyAdjustment that corrects the mains flow for the
 * removal of a combi boiler's plate heat exchanger.
 *
 * When the mains flow test was performed against an existing combi, the
 * measured flow (e.g. 19 L/min at 1.5 bar) already includes the restriction
 * imposed by the combi HEX (~0.3 bar pressure drop).  When the proposed
 * system replaces the combi with a stored cylinder (system boiler + unvented,
 * regular boiler + vented, or heat pump), there is no HEX in the DHW flow
 * path, so the effective deliverable mains flow is higher.
 *
 * Correction uses Q ∝ √P:
 *   adjustedFlow = measuredFlow × √(P_mains / (P_mains − P_hex_drop))
 *
 * The mains pressure itself is unchanged — the cylinder charges at mains
 * pressure and delivers at mains pressure regardless.
 *
 * Returns { type: 'none' } when no valid measured flow or pressure are
 * available (nothing to correct).
 */
export function buildCombiHexRemovalAdjustment(
  measuredSupply: MainsSupply,
): ProposedSupplyAdjustment {
  const p = measuredSupply.dynamicPressureBar
  const q = measuredSupply.dynamicFlowLpm

  if (p == null || p <= COMBI_HEX_PRESSURE_DROP_BAR || q == null || q <= 0) {
    return { type: 'none' }
  }

  const adjustedFlowLpm = parseFloat(
    (q * Math.sqrt(p / (p - COMBI_HEX_PRESSURE_DROP_BAR))).toFixed(1),
  )

  return {
    type: 'combi_hex_removal',
    adjustedDynamicPressureBar: p,
    adjustedDynamicFlowLpm: adjustedFlowLpm,
    note: `Combi plate HEX removed — effective mains flow corrected from ${q} to ${adjustedFlowLpm} L/min (no 0.3 bar HEX restriction on proposed stored system).`,
  }
}

// ─── Effective-proposed helper ─────────────────────────────────────────────────

/**
 * Return the effective mains supply to use for the proposed-system card.
 *
 * Logic:
 *   - When no adjustment is present, or adjustment.type is 'none', the
 *     measured supply is returned unchanged. The house mains do not improve
 *     simply because a different system was chosen.
 *   - When an explicit supply-side upgrade is proposed (booster, accumulator,
 *     break tank / pump set), the adjusted pressure and/or flow overrides are
 *     applied. Source remains the same (the base measurement is still the
 *     reference; the upgrade is additive).
 *   - When type is 'combi_hex_removal', the corrected flow is applied to
 *     reflect the absence of the combi plate HEX pressure restriction.
 *
 * All simulator, report, and portal code should call this single function
 * instead of duplicating the override logic independently.
 */
export function getEffectiveProposedMainsSupply(
  measuredSupply: MainsSupply,
  adjustment?: ProposedSupplyAdjustment,
): MainsSupply {
  if (adjustment == null || adjustment.type === 'none') {
    return measuredSupply
  }

  return {
    ...measuredSupply,
    dynamicPressureBar:
      adjustment.adjustedDynamicPressureBar != null
        ? adjustment.adjustedDynamicPressureBar
        : measuredSupply.dynamicPressureBar,
    dynamicFlowLpm:
      adjustment.adjustedDynamicFlowLpm != null
        ? adjustment.adjustedDynamicFlowLpm
        : measuredSupply.dynamicFlowLpm,
  }
}
