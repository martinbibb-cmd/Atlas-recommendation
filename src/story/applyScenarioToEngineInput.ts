/**
 * applyScenarioToEngineInput.ts
 *
 * Maps scenario-specific user inputs to a partial EngineInputV2_3 that can be
 * merged with scenario defaults before being passed to the engine.
 *
 * Physics engine is NOT modified here — this is purely data translation.
 */

import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';
import { ERP_TO_NOMINAL_PCT } from '../engine/utils/efficiency';
import type { CombiSwitchInputs, OldBoilerRealityInputs } from './scenarioRegistry';

// ── Conservative flow-rate derivation (when mains flow is unknown) ────────────

/**
 * Derive a conservative mains dynamic flow estimate from household demand
 * when the actual reading is not known.
 *
 * Conservative (i.e. lower) values are chosen so that the engine flags
 * simultaneous-demand risk rather than masking it.
 */
export function deriveConservativeFlowLpm(
  occupancyCount: number,
  hotWaterDemand: 'low' | 'medium' | 'high',
): number {
  const baseByDemand: Record<'low' | 'medium' | 'high', number> = {
    low:    8,
    medium: 12,
    high:   16,
  };
  const base = baseByDemand[hotWaterDemand];
  // For high occupancy, apply a further conservative cap — don't inflate
  if (occupancyCount >= 5) return Math.min(base, 10);
  return base;
}

// ── Penalty look-up for controls type ────────────────────────────────────────

/**
 * Map controls type to approximate cycling-penalty derate (percentage points).
 * This represents the efficiency loss attributable to control quality.
 */
export function controlsCyclingPenaltyPct(
  controlsType: OldBoilerRealityInputs['controlsType'],
): number {
  switch (controlsType) {
    case 'weather_comp':  return 0;
    case 'modulating':    return 1;
    case 'prog_stat':     return 3;
    case 'basic_stat':    return 5;
  }
}

// ── Sludge / contamination derate ─────────────────────────────────────────────

/**
 * Map system cleanliness to efficiency derate (percentage points).
 * 'unknown' is treated conservatively as 'some_contamination'.
 */
export function sludgeDerateByCleanlinessStatus(
  status: OldBoilerRealityInputs['systemCleanliness'],
): number {
  switch (status) {
    case 'clean':               return 0;
    case 'some_contamination':  return 4;
    case 'heavy_contamination': return 8;
    case 'unknown':             return 4; // conservative assumption
  }
}

// ── Confidence derivation ─────────────────────────────────────────────────────

/**
 * Derive confidence label for the old-boiler scenario based on what is known.
 */
export function deriveOldBoilerConfidence(
  inputs: OldBoilerRealityInputs,
): 'high' | 'medium' | 'low' {
  const knownCount =
    (inputs.boilerAgeYears > 0 ? 1 : 0) +
    (inputs.manufacturedSedbukPctKnown ? 1 : 0) +
    (inputs.systemCleanliness !== 'unknown' ? 1 : 0) +
    (inputs.filterPresent !== 'unknown' ? 1 : 0);

  if (knownCount >= 3) return 'high';
  if (knownCount >= 1) return 'medium';
  return 'low';
}

// ── Combi switch: scenario inputs → EngineInputV2_3 partial ──────────────────

const COMBI_SWITCH_BASE: Partial<EngineInputV2_3> = {
  postcode:           'SW1A 1AA',
  dynamicMainsPressure: 2,
  buildingMass:       'medium',
  primaryPipeDiameter: 22,
  heatLossWatts:      8000,
  radiatorCount:      10,
  hasLoftConversion:  false,
  returnWaterTemp:    45,
  occupancySignature: 'professional',
  highOccupancy:      false,
  preferCombi:        false,
  availableSpace:     'unknown',
  currentHeatSourceType: 'combi',
};

/**
 * Map CombiSwitchInputs to a full EngineInputV2_3 ready for the engine.
 *
 * When mainsFlowLpmKnown is false, a conservative flow estimate is derived from
 * hotWaterDemand and occupancyCount rather than using an arbitrary default.
 *
 * storedType maps to coldWaterSource for the System B compare context:
 *   'vented'   → coldWaterSource 'loft_tank'  (open-vented / gravity-fed)
 *   'unvented' → coldWaterSource 'mains_true' (mains-pressure unvented)
 *
 * User choice is the source of truth — storedType is never auto-inferred.
 */
export function applyCombiSwitchInputs(
  inputs: CombiSwitchInputs,
): EngineInputV2_3 {
  const flowLpm = inputs.mainsFlowLpmKnown
    ? inputs.mainsFlowLpm
    : deriveConservativeFlowLpm(inputs.occupancyCount, inputs.hotWaterDemand);

  const peakConcurrentOutlets =
    inputs.simultaneousUse === 'often' ? Math.min(inputs.bathroomCount, 2)
    : inputs.simultaneousUse === 'sometimes' && inputs.bathroomCount >= 2 ? 2
    : 1;

  const coldWaterSource: EngineInputV2_3['coldWaterSource'] =
    inputs.storedType === 'vented' ? 'loft_tank' : 'mains_true';

  return {
    ...(COMBI_SWITCH_BASE as EngineInputV2_3),
    occupancyCount:       inputs.occupancyCount,
    bathroomCount:        inputs.bathroomCount,
    mainsDynamicFlowLpm:  flowLpm,
    mainsPressureRecorded: inputs.mainsFlowLpmKnown,
    peakConcurrentOutlets,
    highOccupancy:        inputs.occupancyCount >= 5,
    coldWaterSource,
  };
}

// ── Old Boiler Reality: scenario inputs → EngineInputV2_3 partial ─────────────

const OLD_BOILER_BASE: Partial<EngineInputV2_3> = {
  postcode:            'SW1A 1AA',
  dynamicMainsPressure: 2,
  buildingMass:        'medium',
  primaryPipeDiameter: 22,
  heatLossWatts:       8000,
  radiatorCount:       10,
  hasLoftConversion:   false,
  returnWaterTemp:     45,
  bathroomCount:       1,
  occupancySignature:  'professional',
  highOccupancy:       false,
  preferCombi:         false,
  availableSpace:      'unknown',
  currentHeatSourceType: 'combi',
};

/**
 * Map OldBoilerRealityInputs to a full EngineInputV2_3 ready for the engine.
 * Nominal SEDBUK pct is taken from the band midpoint unless the surveyor has
 * provided a specific percentage.
 */
export function applyOldBoilerRealityInputs(
  inputs: OldBoilerRealityInputs,
): EngineInputV2_3 {
  const sedbukPct = inputs.manufacturedSedbukPctKnown
    ? inputs.manufacturedSedbukPct
    : ERP_TO_NOMINAL_PCT[inputs.manufacturedBand];

  return {
    ...(OLD_BOILER_BASE as EngineInputV2_3),
    currentBoilerAgeYears: inputs.boilerAgeYears,
    currentBoilerSedbukPct: sedbukPct,
    hasMagneticFilter:     inputs.filterPresent === 'yes',
    currentSystem: {
      boiler: {
        ageYears:    inputs.boilerAgeYears,
        type:        'combi',
        condensing:  sedbukPct >= 88 ? 'yes' : 'unknown',
      },
    },
  };
}
