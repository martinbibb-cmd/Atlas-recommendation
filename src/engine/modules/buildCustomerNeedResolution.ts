/**
 * buildCustomerNeedResolution.ts
 *
 * Converts survey-observed signals into a personalised
 * "You told us → We're doing → So you get" block.
 *
 * Design rules:
 *  - Only emit items backed by survey evidence (no hallucination).
 *  - Maximum 4 items — 3 is optimal, 4 acceptable; 5+ dilutes the
 *    "I feel understood" moment.
 *  - Phrasing always uses "You told us…" (never "customer reported…").
 *  - No jargon in need/action/outcome strings.
 *  - Each string is one line — no paragraphs.
 *  - evidence is max 80 chars, uses "we've seen" / "this suggests" /
 *    "based on your home" — never raw metrics, never alarm language.
 *  - Returns null when no survey signal is present.
 */

import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import type {
  CustomerNeedResolutionBlock,
  CustomerNeedResolutionItem,
} from '../../contracts/VisualBlock';

/** Maximum number of items in the block. */
const MAX_ITEMS = 4;

// ─── Signal detectors ─────────────────────────────────────────────────────────

/**
 * Cold spots — radiator performance signals or confirmed heating unevenness.
 */
function detectColdSpots(input: EngineInputV2_3): boolean {
  const signals = input.currentSystem?.conditionSignals;
  if (
    signals?.radiatorPerformance === 'some_cold_spots' ||
    signals?.radiatorPerformance === 'many_cold'
  ) {
    return true;
  }
  // Bleed water colour indicating sludge strongly correlates with cold spots
  if (
    signals?.bleedWaterColour === 'dark' ||
    signals?.bleedWaterColour === 'sludge'
  ) {
    return true;
  }
  return false;
}

/**
 * Slow hot water — plate HEX condition directly observed as poor or severe.
 * Only fires on confirmed poor/severe condition bands (not 'moderate' which is
 * borderline and would be an assumption without direct survey evidence).
 */
function detectSlowHotWater(input: EngineInputV2_3): boolean {
  if (
    input.plateHexConditionBand === 'poor' ||
    input.plateHexConditionBand === 'severe'
  ) {
    return true;
  }
  return false;
}

/**
 * Runs out of hot water — simultaneous demand or high occupancy from survey,
 * or cylinder volume directly measured and insufficient for occupancy.
 * Cylinder coil transfer factor is engine-derived and excluded — we only use
 * directly surveyed values.
 */
function detectRunsOutOfHotWater(input: EngineInputV2_3): boolean {
  if (input.simultaneousDrawSeverity === 'high') return true;
  if (input.highOccupancy) return true;
  // Cylinder volume is a directly surveyed measurement
  if (
    input.cylinderVolumeLitres !== undefined &&
    input.occupancyCount !== undefined &&
    input.cylinderVolumeLitres < input.occupancyCount * 25
  ) {
    return true;
  }
  return false;
}

/**
 * Low pressure shower — gravity head too low, low mains pressure, or
 * gravity-fed delivery mode.
 */
function detectLowPressureShower(input: EngineInputV2_3): boolean {
  if (input.cwsHeadMetres !== undefined && input.cwsHeadMetres < 0.5) {
    return true;
  }
  if (input.dhwDeliveryMode === 'gravity') {
    return true;
  }
  // Low dynamic mains pressure (below 1 bar) for mains-fed systems
  const dynamicBar = input.dynamicMainsPressureBar ?? input.dynamicMainsPressure;
  if (dynamicBar !== undefined && dynamicBar < 1.0) {
    return true;
  }
  return false;
}

/**
 * High bills — poor or severe boiler condition band (directly graded from survey)
 * or high annual gas spend explicitly provided in the survey.
 * The age+non-condensing heuristic is retained as it is derived from direct
 * survey measurements (boiler age and condensing status), not an assumption.
 */
function detectHighBills(input: EngineInputV2_3): boolean {
  if (
    input.boilerConditionBand === 'poor' ||
    input.boilerConditionBand === 'severe'
  ) {
    return true;
  }
  // High annual gas spend threshold explicitly stated by the homeowner
  if (input.annualGasSpendGbp !== undefined && input.annualGasSpendGbp > 1500) {
    return true;
  }
  // Old, non-condensing boiler — both facts are direct survey observations
  const age = input.currentSystem?.boiler?.ageYears ?? input.currentBoilerAgeYears;
  if (
    age !== undefined &&
    age > 15 &&
    input.currentSystem?.boiler?.condensing === 'no'
  ) {
    return true;
  }
  return false;
}

/**
 * Noisy system — circulation issues, cavitation, or confirmed sludge.
 */
function detectNoisySystem(input: EngineInputV2_3): boolean {
  const signals = input.currentSystem?.conditionSignals;
  if (
    signals?.circulationIssues === 'frequent_noise_or_poor_flow' ||
    signals?.circulationIssues === 'occasional_noise'
  ) {
    return true;
  }
  if (
    signals?.bleedWaterColour === 'dark' ||
    signals?.bleedWaterColour === 'sludge'
  ) {
    return true;
  }
  return false;
}

/**
 * Future extension — loft conversion, additional bathroom, or expansion plans.
 */
function detectFutureExtension(input: EngineInputV2_3): boolean {
  return !!(input.futureLoftConversion || input.futureAddBathroom);
}

// ─── Item catalogue ───────────────────────────────────────────────────────────

type SignalItem = CustomerNeedResolutionItem & { confidence: 'direct' | 'inferred' };

function coldSpotsItem(): SignalItem {
  return {
    need: "Some rooms don't heat properly",
    action: "We'll clean the system and check radiators and pipework",
    outcome: 'Heat can circulate properly and reach every room',
    confidence: 'direct',
    evidence: "We've seen signs of restricted circulation in the system",
  };
}

function slowHotWaterItem(input: EngineInputV2_3): SignalItem {
  // Only fires on 'poor' or 'severe' — both are directly surveyed condition bands.
  const isSevere = input.plateHexConditionBand === 'severe';
  return {
    need: 'Hot water takes too long to arrive',
    action: 'System layout and pipework will be optimised',
    outcome: 'Faster hot water at taps and showers',
    confidence: 'direct',
    evidence: isSevere
      ? 'The plate heat exchanger is severely scaled — hot-water delivery is reduced'
      : 'The plate heat exchanger is in poor condition, slowing hot-water delivery',
  };
}

function runsOutOfHotWaterItem(scenario: ScenarioResult): SignalItem {
  const hasStoredHotWater = scenario.system.type === 'system' || scenario.system.type === 'regular';
  return {
    need: 'Hot water runs out during use',
    action: hasStoredHotWater
      ? "We're recommending stored hot water to match your household's demand"
      : "We're sizing the system to meet your household's peak demand",
    outcome: 'Hot water available even during busy times',
    confidence: 'direct',
    evidence: 'Based on your surveyed occupancy count and bathroom configuration',
  };
}

function lowPressureShowerItem(input: EngineInputV2_3): SignalItem {
  const isTankFed = input.dhwDeliveryMode === 'gravity' || (input.cwsHeadMetres !== undefined && input.cwsHeadMetres < 0.5);
  const evidenceDetail = input.dhwDeliveryMode === 'gravity'
    ? 'Your hot water is supplied via a gravity-fed tank arrangement'
    : input.cwsHeadMetres !== undefined && input.cwsHeadMetres < 0.5
      ? `We've measured the cold-water head at ${input.cwsHeadMetres.toFixed(1)} m — below the minimum needed`
      : 'Your surveyed mains pressure is below the minimum for shower performance';
  return {
    need: "Shower pressure isn't strong enough",
    action: isTankFed
      ? 'System designed to move away from tank-fed supply'
      : 'System designed to suit your water supply',
    outcome: 'More consistent shower performance',
    confidence: 'direct',
    evidence: evidenceDetail,
  };
}

function highBillsItem(input: EngineInputV2_3): SignalItem {
  let evidenceDetail = 'Your current system is running less efficiently than it could';
  if (input.boilerConditionBand === 'poor' || input.boilerConditionBand === 'severe') {
    evidenceDetail = "We've rated your boiler condition as poor — running costs are higher";
  } else if (input.annualGasSpendGbp !== undefined && input.annualGasSpendGbp > 1500) {
    evidenceDetail = `Your annual gas spend of £${Math.round(input.annualGasSpendGbp)} is above typical range for UK homes`;
  } else {
    const age = input.currentSystem?.boiler?.ageYears ?? input.currentBoilerAgeYears;
    if (age !== undefined && age > 15) {
      evidenceDetail = `Boiler is ${age} years old and non-condensing — less efficient than modern`;
    }
  }
  return {
    need: 'Energy costs are a concern',
    action: 'Improved controls and system efficiency',
    outcome: 'Less wasted energy and better control',
    confidence: 'direct',
    evidence: evidenceDetail,
  };
}

function noisySystemItem(): SignalItem {
  return {
    need: 'System is noisy or inconsistent',
    action: 'Cleaning and protection added',
    outcome: 'Quieter and more stable operation',
    confidence: 'direct',
    evidence: "We've identified signs of sludge or air in the system",
  };
}

function futureExtensionItem(): SignalItem {
  return {
    need: 'You may add rooms or bathrooms',
    action: 'System sized and designed for expansion',
    outcome: 'No need to replace everything later',
    confidence: 'direct',
    evidence: 'You mentioned possible future changes to the home',
  };
}

// ─── Public builder ───────────────────────────────────────────────────────────

/**
 * buildCustomerNeedResolution
 *
 * Produces a `CustomerNeedResolutionBlock` from the survey input, the
 * Atlas recommendation decision, and the recommended scenario.
 *
 * Returns null when no survey evidence is present — this block must never
 * contain generic filler content.
 *
 * @param decision  — AtlasDecisionV1 from the recommendation engine.
 * @param input     — EngineInputV2_3 (survey data passed to the engine).
 * @param scenario  — The recommended ScenarioResult.
 */
export function buildCustomerNeedResolution(
  _decision: AtlasDecisionV1,
  input: EngineInputV2_3,
  scenario: ScenarioResult,
): CustomerNeedResolutionBlock | null {
  const items: CustomerNeedResolutionItem[] = [];

  if (detectColdSpots(input)) {
    items.push(coldSpotsItem());
  }
  if (items.length < MAX_ITEMS && detectSlowHotWater(input)) {
    items.push(slowHotWaterItem(input));
  }
  if (items.length < MAX_ITEMS && detectRunsOutOfHotWater(input)) {
    items.push(runsOutOfHotWaterItem(scenario));
  }
  if (items.length < MAX_ITEMS && detectLowPressureShower(input)) {
    items.push(lowPressureShowerItem(input));
  }
  if (items.length < MAX_ITEMS && detectHighBills(input)) {
    items.push(highBillsItem(input));
  }
  if (items.length < MAX_ITEMS && detectNoisySystem(input)) {
    items.push(noisySystemItem());
  }
  if (items.length < MAX_ITEMS && detectFutureExtension(input)) {
    items.push(futureExtensionItem());
  }

  if (items.length === 0) return null;

  return {
    id: 'customer-need-resolution',
    type: 'customer_need_resolution',
    title: 'What matters to you',
    outcome: 'Your concerns are reflected in every decision we have made.',
    visualKey: 'customer_need_resolution',
    items,
  };
}
