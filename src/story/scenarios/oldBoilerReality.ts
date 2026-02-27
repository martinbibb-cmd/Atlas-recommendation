/**
 * oldBoilerReality.ts
 *
 * Scenario spec for the "Boiler is old (Reality Check)" (old_boiler_reality)
 * story scenario.
 *
 * Extracted from scenarioRegistry so each scenario lives in its own file.
 * scenarioRegistry imports and re-exports this definition.
 *
 * localControls describes the scenario-specific quick-selectors
 * that are rendered by ScenarioShell above the two-column layout.
 */

import type { ErpClass } from '../../engine/utils/efficiency';
import { ERP_TO_NOMINAL_PCT } from '../../engine/utils/efficiency';
import type { StoryScenario, OldBoilerRealityInputs } from '../scenarioRegistry';

// ── Local controls ────────────────────────────────────────────────────────────

/**
 * Scenario-specific local controls state for old_boiler_reality.
 * These are header-area quick-selectors; they mirror the relevant fields
 * inside OldBoilerRealityInputs for use in the ScenarioShell header slot.
 */
export interface OldBoilerRealityLocalControls {
  /** As-manufactured rating: an ErP band label (A–G) or a known numeric %. */
  asManufacturedRating: ErpClass | number;
  /** Boiler age in complete years. */
  boilerAgeYears: number;
  /** Controls sophistication class. */
  controlsClass: 'basic' | 'programmer' | 'modulating' | 'weather';
  /** Observed system condition. */
  systemCondition: 'clean' | 'some' | 'heavy' | 'unknown';
  /** Whether a magnetic filter is fitted. */
  filterPresent: 'yes' | 'no' | 'unknown';
}

/** Default values for the local controls. */
export const OLD_BOILER_REALITY_LOCAL_CONTROLS_DEFAULT: OldBoilerRealityLocalControls = {
  asManufacturedRating: 'A',
  boilerAgeYears: 10,
  controlsClass: 'basic',
  systemCondition: 'unknown',
  filterPresent: 'unknown',
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Return the indicative SEDBUK nominal % for a given ErP band label.
 * Pure — no side effects.
 */
export function sedbukBandToPct(band: ErpClass): number {
  return ERP_TO_NOMINAL_PCT[band];
}

/**
 * Resolve the manufactured nominal SEDBUK % from either an explicit figure or
 * the band midpoint.
 *
 * Returns `explicitPct` when `pctKnown` is true; otherwise falls back to the
 * band midpoint from ERP_TO_NOMINAL_PCT.
 *
 * Pure — no side effects.
 */
export function resolveManufacturedPct(
  band: OldBoilerRealityInputs['manufacturedBand'],
  pctKnown: boolean,
  explicitPct: number,
): number {
  return pctKnown ? explicitPct : ERP_TO_NOMINAL_PCT[band];
}

// ── Scenario spec ─────────────────────────────────────────────────────────────

/**
 * Old Boiler Reality Check scenario spec.
 *
 * Shows a performance band ladder (as-manufactured → current → restored →
 * new-boiler baseline) and recovery steps.  Demand graphs are intentionally
 * excluded — this scenario is a single-system performance ladder, not an
 * archetype comparison.
 *
 * Minimum inputs for V1:
 *   - boilerAgeYears
 *   - manufacturedBand (or manufacturedSedbukPct when known)
 *   - controlsType
 *   - systemCleanliness
 *   - filterPresent
 *
 * One screen.  Escalation to Full Survey is permitted.
 */
export const oldBoilerRealityScenario: StoryScenario<OldBoilerRealityInputs> = {
  id: 'old_boiler_reality',
  title: 'Boiler is old',
  description: 'Compare the as-manufactured rating against likely real-world performance today.',
  advisorIntent: "Let's compare the as-manufactured rating vs likely real-world performance today.",
  fields: [
    'boilerAgeYears',
    'manufacturedBand',
    'manufacturedSedbukPctKnown',
    'manufacturedSedbukPct',
    'controlsType',
    'systemCleanliness',
    'filterPresent',
  ],
  defaults: {
    boilerAgeYears: 10,
    manufacturedBand: 'A',
    manufacturedSedbukPctKnown: false,
    manufacturedSedbukPct: 90,
    controlsType: 'basic_stat',
    systemCleanliness: 'unknown',
    filterPresent: 'unknown',
  },
  compareDefaults: {
    systemA: 'combi',
    systemB: 'combi',
  },
  outputFocus: [
    'band_ladder',
    'recovery_steps',
  ],
  escalationAllowed: true,
};
