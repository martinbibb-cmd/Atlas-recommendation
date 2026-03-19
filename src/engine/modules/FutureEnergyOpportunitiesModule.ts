/**
 * FutureEnergyOpportunitiesModule.ts
 *
 * Lightweight opportunity assessment for solar PV and EV charging.
 *
 * This is NOT a full design or calculation module.
 * It produces structured opportunity guidance ("likely suitable", "needs checks",
 * "not currently favoured") based on known survey inputs.
 *
 * The module is intentionally kept separate from the core heating recommendation
 * logic. It augments the visit output rather than influencing the heating verdict.
 *
 * Rules
 * ──────
 * Solar PV
 *   suitable_now        — stored hot water present (strong self-consumption synergy),
 *                         especially Mixergy; with steady/shift daytime demand
 *   check_required      — default outcome; roof orientation always needs survey;
 *                         future-readiness intent present but roof unknown
 *   not_currently_favoured — combi-only (no stored water) + professional pattern
 *                            (away during peak solar) + no future-readiness intent
 *
 * EV Charging
 *   suitable_now        — commuter/high-occupancy profile AND future-readiness intent
 *   check_required      — default; parking and supply always need site confirmation
 *   not_currently_favoured — not emitted in this version (insufficient data to rule out)
 */

import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OpportunityStatus =
  | 'suitable_now'
  | 'check_required'
  | 'not_currently_favoured';

export interface OpportunityAssessment {
  /** Traffic-light status for this opportunity. */
  status: OpportunityStatus;
  /** One-line summary suitable for a card headline. */
  summary: string;
  /** Up to 3 reasons explaining the status. */
  reasons: string[];
  /** Specific checks needed before this opportunity can be confirmed. */
  checksRequired: string[];
}

export interface FutureEnergyOpportunities {
  solarPv: OpportunityAssessment;
  evCharging: OpportunityAssessment;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true when the input indicates stored hot water is part of the system
 * (i.e. a cylinder is expected, dhwTankType is set, and preferCombi is not forced).
 */
function hasStoredHotWater(input: EngineInputV2_3): boolean {
  if (input.preferCombi === true) return false;
  return input.dhwTankType != null;
}

/**
 * Returns true when the input indicates Mixergy-style smart stratification.
 */
function hasMixergy(input: EngineInputV2_3): boolean {
  return input.dhwTankType === 'mixergy';
}

/**
 * Returns true when the occupancy signature suggests sustained daytime presence.
 */
function hasDaytimeOccupancy(input: EngineInputV2_3): boolean {
  const sig = input.occupancySignature;
  return sig === 'steady_home' || sig === 'steady' || sig === 'shift_worker' || sig === 'shift';
}

/**
 * Returns true when the occupancy signature suggests the household is typically
 * absent during peak solar hours (09:00–15:00).
 */
function isProfessionalAbsence(input: EngineInputV2_3): boolean {
  return input.occupancySignature === 'professional';
}

/**
 * Returns true when future-readiness (heat-pump pathway) is flagged as a priority.
 * Sourced from expertAssumptions.futureReadinessPriority.
 */
function isFutureReady(input: EngineInputV2_3): boolean {
  return input.expertAssumptions?.futureReadinessPriority === 'high';
}

/**
 * Returns true when the primary recommended system is an air source heat pump.
 * Uses conservative substring matching against known ASHP recommendation labels.
 */
function isHeatPumpRecommended(primaryRecommendation?: string): boolean {
  if (!primaryRecommendation) return false;
  const lc = primaryRecommendation.toLowerCase();
  return lc.includes('air source heat pump') || lc.startsWith('ashp');
}

// ─── Roof orientation helpers ─────────────────────────────────────────────────

/**
 * Roof orientation signal — derived from the new `roofOrientation` field when
 * present, falling back to the legacy `houseFrontFacing` field for older records.
 *
 *   'south_likely'  — south / south_east / south_west / mixed pitch available
 *   'less_optimal'  — east / west facing (lower annual yield)
 *   'north_facing'  — north-facing roof (poor PV candidate)
 *   'unknown'       — no orientation data provided; survey required
 */
type RoofOrientationSignal = 'south_likely' | 'less_optimal' | 'north_facing' | 'unknown';

/**
 * Solar shading signal — derived from the `solarShading` field.
 *
 *   'none_or_low' — little or no shading; minimal yield impact
 *   'medium'      — some shading; moderate yield reduction
 *   'high'        — heavy shading; significant yield reduction
 *   'unknown'     — not assessed; treat as requiring a check
 */
type SolarShadingSignal = 'none_or_low' | 'medium' | 'high' | 'unknown';

/**
 * Derives the roof orientation signal from survey input.
 *
 * Preference order:
 *   1. `roofOrientation` (new field, direct roof measurement)
 *   2. `houseFrontFacing` (legacy field — inferred from house front direction)
 *      north-facing front → south-facing rear → south_likely
 *      south-facing front → south-facing front → south_likely
 *      east/west front    → side pitches → less_optimal
 */
function deriveRoofOrientationSignal(input: EngineInputV2_3): RoofOrientationSignal {
  // Prefer the direct roof orientation field when present
  if (input.roofOrientation && input.roofOrientation !== 'unknown') {
    const o = input.roofOrientation;
    if (o === 'south' || o === 'south_east' || o === 'south_west' || o === 'mixed') {
      return 'south_likely';
    }
    if (o === 'north') return 'north_facing';
    // east or west
    return 'less_optimal';
  }

  // Fall back to legacy houseFrontFacing for older records
  if (input.houseFrontFacing) {
    const facing = input.houseFrontFacing;
    if (facing === 'north' || facing === 'south') return 'south_likely';
    return 'less_optimal';
  }

  return 'unknown';
}

/**
 * Derives the solar shading signal from the `solarShading` field.
 */
function deriveShadingSignal(input: EngineInputV2_3): SolarShadingSignal {
  if (!input.solarShading || input.solarShading === 'unknown') return 'unknown';
  if (input.solarShading === 'low') return 'none_or_low';
  if (input.solarShading === 'medium') return 'medium';
  return 'high';
}

/**
 * Returns a reason string describing the roof orientation for PV purposes.
 * Returns null when orientation is unknown (nothing to add).
 */
function roofOrientationReason(signal: RoofOrientationSignal): string | null {
  if (signal === 'south_likely') {
    return 'Roof orientation is favourable for solar PV — a south-facing pitch supports good annual yield.';
  }
  if (signal === 'less_optimal') {
    return 'Roof orientation is less optimal for solar PV — east/west-facing pitches generate less than a south-facing equivalent.';
  }
  if (signal === 'north_facing') {
    return 'North-facing roof is a poor candidate for solar PV — yield would be significantly reduced.';
  }
  return null;
}

/**
 * Returns a reason string for shading impact.
 * Returns null when shading is unknown or low (nothing to flag).
 */
function shadingReason(signal: SolarShadingSignal): string | null {
  if (signal === 'medium') {
    return 'Solar suitability is reduced by shading — a shading analysis should be included in any roof survey.';
  }
  if (signal === 'high') {
    return 'Heavy shading significantly reduces solar PV viability — a detailed shading analysis is recommended before proceeding.';
  }
  return null;
}

/**
 * Returns the appropriate checksRequired entry for roof orientation.
 * When orientation is known, replaces the generic survey requirement with a
 * more specific note.
 */
function roofOrientationCheckText(signal: RoofOrientationSignal): string {
  if (signal === 'south_likely') {
    return 'Roof orientation is favourable — a roof survey should confirm shading and available area.';
  }
  if (signal === 'less_optimal') {
    return 'Roof orientation is less optimal for PV — east/west-facing pitch survey recommended.';
  }
  if (signal === 'north_facing') {
    return 'North-facing roof limits PV viability — alternative roof sections or ground-mount options should be assessed.';
  }
  return 'Roof orientation and obstruction survey required before specifying a system.';
}

/**
 * Returns the appropriate checksRequired entry for the expansion-headroom case
 * (alreadySolar path). Same orientation logic but phrased for expansion context.
 */
function roofExpansionCheckText(signal: RoofOrientationSignal): string {
  if (signal === 'south_likely') {
    return 'Roof orientation is favourable — shading and headroom survey recommended for expansion.';
  }
  if (signal === 'less_optimal') {
    return 'East/west-facing pitch confirmed — expansion headroom and shading analysis recommended.';
  }
  if (signal === 'north_facing') {
    return 'North-facing roof limits expansion potential — alternative roof sections recommended.';
  }
  return 'Roof orientation and shading survey to confirm expansion headroom.';
}

/**
 * Appends non-null orientation and shading reasons to a reasons array, capping
 * at MAX_REASON_COUNT items. If the array is at capacity the orientation
 * reason replaces the last entry to surface the most important signal.
 */
const MAX_REASON_COUNT = 3;

/** Appends a note to the reasons array, replacing the last entry when at capacity. */
function appendNote(reasons: string[], note: string): string[] {
  if (reasons.length < MAX_REASON_COUNT) return [...reasons, note];
  return [...reasons.slice(0, MAX_REASON_COUNT - 1), note];
}

function withRoofReasons(
  reasons: string[],
  orientation: RoofOrientationSignal,
  shading: SolarShadingSignal,
): string[] {
  const orientationNote = roofOrientationReason(orientation);
  const shadingNote = shadingReason(shading);

  let result = [...reasons];
  if (orientationNote) result = appendNote(result, orientationNote);
  if (shadingNote) result = appendNote(result, shadingNote);
  return result;
}

// ─── Solar PV opportunity ─────────────────────────────────────────────────────

function assessSolarPv(
  input: EngineInputV2_3,
  primaryRecommendation?: string,
): OpportunityAssessment {
  const stored = hasStoredHotWater(input);
  const mixergy = hasMixergy(input);
  const daytime = hasDaytimeOccupancy(input);
  const professional = isProfessionalAbsence(input);
  const futureReady = isFutureReady(input);
  const alreadySolar = input.solarBoost?.enabled === true;
  const heatPump = isHeatPumpRecommended(primaryRecommendation);
  const orientation = deriveRoofOrientationSignal(input);
  const shading = deriveShadingSignal(input);

  // Already has a solar diverter/thermal path — suitable now with existing setup
  if (alreadySolar) {
    return {
      status: 'suitable_now',
      summary: 'Solar energy pathway already active — scope to optimise.',
      reasons: withRoofReasons([
        'Solar input is already configured for this home.',
        'Expanding PV capacity or adding a battery could improve self-consumption further.',
        stored
          ? 'Stored hot water continues to absorb surplus solar energy effectively.'
          : 'Adding stored hot water would significantly improve solar self-consumption.',
      ], orientation, shading),
      checksRequired: [roofExpansionCheckText(orientation)],
    };
  }

  // Mixergy — best PV synergy: smart stratification absorbs surplus PV efficiently
  if (mixergy) {
    return {
      status: 'suitable_now',
      summary: 'Solar PV looks promising — stored hot water with smart stratification provides strong self-consumption potential.',
      reasons: withRoofReasons([
        'Stored hot water with top-down heating and active stratification is well-suited to absorbing surplus PV energy.',
        'Smart charging logic can prioritise solar heat input, reducing boiler demand during sunny periods.',
        heatPump
          ? 'Heat pump + PV is a proven whole-home electrification combination.'
          : 'Reduced boiler firing translates directly to lower gas consumption and running costs.',
      ], orientation, shading),
      checksRequired: [
        roofOrientationCheckText(orientation),
      ],
    };
  }

  // Standard stored hot water + daytime occupancy — good self-consumption opportunity
  if (stored && daytime) {
    return {
      status: 'suitable_now',
      summary: 'Solar PV looks promising — stored hot water and daytime occupancy support good self-consumption.',
      reasons: withRoofReasons([
        'Stored hot water enables surplus solar energy to be used as free cylinder top-up.',
        'Daytime household presence increases direct solar consumption.',
        futureReady
          ? 'Future-ready objective aligns well with a solar pathway.'
          : 'Running costs could be meaningfully reduced with a well-sized PV system.',
      ], orientation, shading),
      checksRequired: [
        roofOrientationCheckText(orientation),
        'Consider smart immersion or PV diverter to maximise cylinder charging from solar.',
      ],
    };
  }

  // Stored hot water but professional pattern — lower self-consumption, still viable
  if (stored && professional) {
    return {
      status: 'check_required',
      summary: 'Solar PV could work — stored hot water helps, but daytime absence reduces self-consumption.',
      reasons: withRoofReasons([
        'Stored hot water still allows surplus solar energy to charge the cylinder during the day.',
        'Professional household pattern means less direct consumption during peak solar hours.',
        'A battery or smart diverter would improve the economics for this occupancy profile.',
      ], orientation, shading),
      checksRequired: [
        roofOrientationCheckText(orientation),
        'Battery storage assessment recommended to compensate for low daytime use.',
      ],
    };
  }

  // Future-readiness intent but no stored water — promising intent, needs infrastructure
  if (futureReady && !stored) {
    return {
      status: 'check_required',
      summary: 'Solar PV aligns with your future-ready objective — stored hot water would unlock the full benefit.',
      reasons: withRoofReasons([
        'Future-ready objective signals intent to move toward electrified, renewable-integrated systems.',
        'Without stored hot water, surplus solar energy cannot be captured as cheaply.',
        heatPump
          ? 'Heat pump installation is a good moment to add PV — shared electrical infrastructure.'
          : 'Adding a cylinder alongside PV would significantly improve the business case.',
      ], orientation, shading),
      checksRequired: [
        roofOrientationCheckText(orientation),
        'Hot water storage upgrade would improve solar self-consumption potential.',
      ],
    };
  }

  // Heat pump recommendation — PV synergy is relevant even without explicit intent
  if (heatPump) {
    return {
      status: 'check_required',
      summary: 'Solar PV is worth assessing — heat pump and PV share electrical infrastructure effectively.',
      reasons: withRoofReasons([
        'Heat pump + PV is a widely adopted whole-home electrification combination.',
        'PV output during the day can directly offset heat pump electricity consumption.',
        'Self-consumption will improve further with battery storage later.',
      ], orientation, shading),
      checksRequired: [
        roofOrientationCheckText(orientation),
        'Electrical capacity review for combined heat pump + PV load recommended.',
      ],
    };
  }

  // No stored water, professional occupancy, no future-ready intent — not currently favoured
  if (!stored && professional && !futureReady) {
    return {
      status: 'not_currently_favoured',
      summary: 'Solar PV has limited near-term value based on current constraints.',
      reasons: withRoofReasons([
        'On-demand hot water system limits the ability to absorb surplus solar energy.',
        'Professional household pattern means low daytime electricity load during peak solar hours.',
        'Without battery storage, much of the PV output would be exported at low rates.',
      ], orientation, shading),
      checksRequired: [],
    };
  }

  // Default — check required
  return {
    status: 'check_required',
    summary: 'Solar PV could be a useful addition — roof suitability and self-consumption potential still need confirming.',
    reasons: withRoofReasons([
      'Solar PV can reduce energy costs and carbon footprint for most homes.',
      futureReady
        ? 'Future-ready objective supports a solar pathway assessment.'
        : 'A self-consumption assessment would confirm whether the economics stack up.',
    ], orientation, shading),
    checksRequired: [
      roofOrientationCheckText(orientation),
    ],
  };
}

// ─── EV Charging opportunity ──────────────────────────────────────────────────

function assessEvCharging(
  input: EngineInputV2_3,
  primaryRecommendation?: string,
): OpportunityAssessment {
  const professional = isProfessionalAbsence(input);
  const highOccupancy = input.highOccupancy === true;
  const futureReady = isFutureReady(input);
  const heatPump = isHeatPumpRecommended(primaryRecommendation);
  const occupancyCount = input.occupancyCount ?? 0;
  const multiPerson = occupancyCount >= 2 || highOccupancy;

  // Commuter profile + future-readiness intent → strongest signal
  if (professional && futureReady) {
    const capacityNote = heatPump
      ? 'Combined heat pump and EV load will likely require an electrical capacity review.'
      : 'Main fuse and consumer unit assessment recommended before charger installation.';
    return {
      status: 'suitable_now',
      summary: 'EV charging looks like a strong fit — commuter profile and future-ready objective align well.',
      reasons: [
        'Commuter household pattern suggests regular vehicle use and overnight charging opportunity.',
        'Future-ready objective confirms intent to transition to low-carbon transport.',
        heatPump
          ? 'Heat pump installation is a natural moment to plan EV charging infrastructure.'
          : 'Off-peak tariff optimisation could reduce charging costs significantly.',
      ],
      checksRequired: [
        'Off-street parking arrangement and supply route to be confirmed on site.',
        capacityNote,
      ],
    };
  }

  // High occupancy + future-readiness intent → strong multi-person signal
  if (multiPerson && futureReady) {
    return {
      status: 'suitable_now',
      summary: 'EV charging is worth prioritising — household size and future-ready objective both support it.',
      reasons: [
        'Higher occupancy increases the likelihood of vehicle ownership and charging demand.',
        'Future-ready objective confirms intent to plan ahead for EV infrastructure.',
        heatPump
          ? 'Heat pump installation is a good time to review total electrical demand including EV.'
          : 'A smart charger with tariff-aware scheduling can minimise running costs.',
      ],
      checksRequired: [
        'Off-street parking arrangement and supply route to be confirmed on site.',
        heatPump
          ? 'Electrical capacity review strongly recommended for combined heat pump + EV load.'
          : 'Main fuse and consumer unit assessment recommended before charger installation.',
      ],
    };
  }

  // Heat pump recommended — electrical capacity review is a must regardless
  if (heatPump && (professional || multiPerson || futureReady)) {
    return {
      status: 'check_required',
      summary: 'EV charging could be a strong fit — electrical capacity review for heat pump and EV combined is recommended.',
      reasons: [
        'Heat pump installation is a natural trigger to assess total electrical demand.',
        'EV charger and heat pump are the two largest electrical loads in a modern home.',
        futureReady
          ? 'Future-ready objective supports planning both technologies together.'
          : 'Planning for EV now avoids a second electrical upgrade later.',
      ],
      checksRequired: [
        'Off-street parking arrangement and supply route to be confirmed on site.',
        'Electrical capacity review required for combined heat pump and EV charger load.',
      ],
    };
  }

  // Commuter profile alone — likely car user, parking unknown
  if (professional) {
    return {
      status: 'check_required',
      summary: 'EV charging could be a good fit — commuter profile suggests regular vehicle use.',
      reasons: [
        'Commuter household pattern indicates likely vehicle ownership and regular travel.',
        'Overnight home charging is the most cost-effective EV charging method.',
        'Off-peak tariff scheduling could reduce charging costs further.',
      ],
      checksRequired: [
        'Off-street parking arrangement and supply route to be confirmed on site.',
        'Main fuse and consumer unit assessment recommended before charger installation.',
      ],
    };
  }

  // Future-readiness intent only — worth assessing
  if (futureReady) {
    return {
      status: 'check_required',
      summary: 'EV charging is worth assessing given the future-ready objective for this home.',
      reasons: [
        'Future-ready objective supports assessing the EV charging opportunity now.',
        'Planning cable routing and supply capacity early avoids costly retrospective work.',
        heatPump
          ? 'Heat pump electrical review is a good opportunity to plan EV capacity at the same time.'
          : 'A trunked cable route to the parking area can be prepared during any planned building work.',
      ],
      checksRequired: [
        'Off-street parking arrangement and supply route to be confirmed on site.',
        'Supply capacity and consumer unit assessment recommended.',
      ],
    };
  }

  // Default — check required for all other cases
  return {
    status: 'check_required',
    summary: 'EV charging could be a useful addition — parking arrangement and supply capacity need confirming.',
    reasons: [
      'Home EV charging is the most convenient and cost-effective way to charge an electric vehicle.',
      'Demand for EV charging is growing and pre-installing cable infrastructure is low cost when planned ahead.',
    ],
    checksRequired: [
      'Off-street parking arrangement and supply route to be confirmed on site.',
      'Main fuse and consumer unit assessment recommended before charger installation.',
    ],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Assess solar PV and EV charging suitability for a given survey input.
 *
 * @param input                - Engine input from the completed survey.
 * @param primaryRecommendation - Optional primary recommendation string from the engine
 *                               (used to detect heat pump recommendations).
 */
export function assessFutureEnergyOpportunities(
  input: EngineInputV2_3,
  primaryRecommendation?: string,
): FutureEnergyOpportunities {
  return {
    solarPv: assessSolarPv(input, primaryRecommendation),
    evCharging: assessEvCharging(input, primaryRecommendation),
  };
}
