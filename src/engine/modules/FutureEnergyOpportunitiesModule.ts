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
 * Roof orientation signal derived from the direction the front of the house faces.
 *
 *   'south_likely'  — front or rear pitch is likely south-facing (good PV candidate)
 *   'less_optimal'  — east/west-facing side pitches (lower annual yield)
 *   'unknown'       — no orientation data provided; survey required
 */
type RoofOrientationSignal = 'south_likely' | 'less_optimal' | 'unknown';

/**
 * Derives the roof orientation signal from survey input.
 * A north-facing front → south-facing rear; a south-facing front → south-facing front.
 * Both cases indicate a likely south-facing pitch suitable for PV.
 */
function deriveRoofOrientationSignal(input: EngineInputV2_3): RoofOrientationSignal {
  const facing = input.houseFrontFacing;
  if (!facing) return 'unknown';
  if (facing === 'north' || facing === 'south') return 'south_likely';
  return 'less_optimal';
}

/**
 * Returns a reason string describing the roof orientation for PV purposes.
 * Returns null when orientation is unknown (nothing to add).
 */
function roofOrientationReason(signal: RoofOrientationSignal): string | null {
  if (signal === 'south_likely') {
    return 'Likely south-facing roof available — a south-facing pitch supports good annual PV yield.';
  }
  if (signal === 'less_optimal') {
    return 'Roof orientation less optimal for PV — east/west-facing pitches generate less than a south-facing equivalent.';
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
    return 'Likely south-facing pitch available — needs roof survey to confirm obstruction and shading.';
  }
  if (signal === 'less_optimal') {
    return 'Roof orientation less optimal for PV — east/west-facing pitch survey recommended.';
  }
  return 'Roof orientation and obstruction survey required before specifying a system.';
}

/**
 * Returns the appropriate checksRequired entry for the expansion-headroom case
 * (alreadySolar path). Same orientation logic but phrased for expansion context.
 */
function roofExpansionCheckText(signal: RoofOrientationSignal): string {
  if (signal === 'south_likely') {
    return 'Likely south-facing pitch available — shading and headroom survey recommended for expansion.';
  }
  if (signal === 'less_optimal') {
    return 'East/west-facing pitch confirmed — expansion headroom and shading analysis recommended.';
  }
  return 'Roof orientation and shading survey to confirm expansion headroom.';
}

/**
 * Appends a non-null orientation reason to a reasons array, capping at
 * MAX_REASON_COUNT items. If the array is already at capacity the orientation
 * reason replaces the last entry to surface the orientation signal.
 */
const MAX_REASON_COUNT = 3;

function withOrientationReason(reasons: string[], signal: RoofOrientationSignal): string[] {
  const note = roofOrientationReason(signal);
  if (!note) return reasons;
  if (reasons.length < MAX_REASON_COUNT) return [...reasons, note];
  // Replace last reason to surface orientation signal
  return [...reasons.slice(0, MAX_REASON_COUNT - 1), note];
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

  // Already has a solar diverter/thermal path — suitable now with existing setup
  if (alreadySolar) {
    return {
      status: 'suitable_now',
      summary: 'Solar energy pathway already active — scope to optimise.',
      reasons: withOrientationReason([
        'Solar input is already configured for this home.',
        'Expanding PV capacity or adding a battery could improve self-consumption further.',
        stored
          ? 'Stored hot water continues to absorb surplus solar energy effectively.'
          : 'Adding stored hot water would significantly improve solar self-consumption.',
      ], orientation),
      checksRequired: [roofExpansionCheckText(orientation)],
    };
  }

  // Mixergy — best PV synergy: smart stratification absorbs surplus PV efficiently
  if (mixergy) {
    return {
      status: 'suitable_now',
      summary: 'Solar PV looks promising — stored hot water with smart stratification provides strong self-consumption potential.',
      reasons: withOrientationReason([
        'Stored hot water with top-down heating and active stratification is well-suited to absorbing surplus PV energy.',
        'Smart charging logic can prioritise solar heat input, reducing boiler demand during sunny periods.',
        heatPump
          ? 'Heat pump + PV is a proven whole-home electrification combination.'
          : 'Reduced boiler firing translates directly to lower gas consumption and running costs.',
      ], orientation),
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
      reasons: withOrientationReason([
        'Stored hot water enables surplus solar energy to be used as free cylinder top-up.',
        'Daytime household presence increases direct solar consumption.',
        futureReady
          ? 'Future-ready objective aligns well with a solar pathway.'
          : 'Running costs could be meaningfully reduced with a well-sized PV system.',
      ], orientation),
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
      reasons: withOrientationReason([
        'Stored hot water still allows surplus solar energy to charge the cylinder during the day.',
        'Professional household pattern means less direct consumption during peak solar hours.',
        'A battery or smart diverter would improve the economics for this occupancy profile.',
      ], orientation),
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
      reasons: withOrientationReason([
        'Future-ready objective signals intent to move toward electrified, renewable-integrated systems.',
        'Without stored hot water, surplus solar energy cannot be captured as cheaply.',
        heatPump
          ? 'Heat pump installation is a good moment to add PV — shared electrical infrastructure.'
          : 'Adding a cylinder alongside PV would significantly improve the business case.',
      ], orientation),
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
      reasons: withOrientationReason([
        'Heat pump + PV is a widely adopted whole-home electrification combination.',
        'PV output during the day can directly offset heat pump electricity consumption.',
        'Self-consumption will improve further with battery storage later.',
      ], orientation),
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
      reasons: withOrientationReason([
        'On-demand hot water system limits the ability to absorb surplus solar energy.',
        'Professional household pattern means low daytime electricity load during peak solar hours.',
        'Without battery storage, much of the PV output would be exported at low rates.',
      ], orientation),
      checksRequired: [],
    };
  }

  // Default — check required
  return {
    status: 'check_required',
    summary: 'Solar PV could be a useful addition — roof suitability and self-consumption potential still need confirming.',
    reasons: withOrientationReason([
      'Solar PV can reduce energy costs and carbon footprint for most homes.',
      futureReady
        ? 'Future-ready objective supports a solar pathway assessment.'
        : 'A self-consumption assessment would confirm whether the economics stack up.',
    ], orientation),
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
