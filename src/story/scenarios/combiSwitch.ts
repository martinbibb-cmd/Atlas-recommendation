/**
 * combiSwitch.ts
 *
 * Scenario spec for the "Switching to a combi" (combi_switch) story scenario.
 *
 * Extracted from scenarioRegistry so each scenario lives in its own file.
 * scenarioRegistry imports and re-exports this definition.
 *
 * localControls describes the scenario-specific header toggle (storedType)
 * that is rendered by ScenarioShell above the two-column layout.
 */

import type { StoryScenario, SystemArchetypeId } from '../scenarioRegistry';
import type { CombiSwitchInputs } from '../scenarioRegistry';

// ── Local controls ────────────────────────────────────────────────────────────

/**
 * Scenario-specific header controls state for combi_switch.
 * storedType is kept inside CombiSwitchInputs; this interface documents
 * which field drives the headerControls toggle.
 */
export interface CombiSwitchLocalControls {
  /** Which stored-cylinder archetype to compare against System A (combi). */
  storedType: 'vented' | 'unvented';
}

/** Default values for the local controls. */
export const COMBI_SWITCH_LOCAL_CONTROLS_DEFAULT: CombiSwitchLocalControls = {
  storedType: 'unvented',
};

/**
 * Derives the SystemArchetypeId for System B from the storedType local-control
 * selection.  Pure data mapping — no physics.
 */
export function storedTypeToSystemArchetype(
  storedType: CombiSwitchLocalControls['storedType'],
): SystemArchetypeId {
  return storedType === 'vented' ? 'stored_vented' : 'stored_unvented';
}

// ── Scenario spec ─────────────────────────────────────────────────────────────

/**
 * Combi vs Stored scenario spec.
 *
 * Minimum inputs for V1:
 *   - occupancyCount
 *   - bathroomCount
 *   - mainsFlowLpm (or unknown → hotWaterDemand fallback)
 *   - simultaneousUse (rare / sometimes / often)
 *   - storedType (vented / unvented) — drives System B archetype
 *
 * One screen.  Escalation to Full Survey is permitted.
 */
export const combiSwitchScenario: StoryScenario<CombiSwitchInputs> = {
  id: 'combi_switch',
  title: 'Switching to a combi',
  description: 'Compare how a combi and a stored-water system behave in your household.',
  advisorIntent: "Let's see how hot water and heating behave in your household.",
  fields: [
    'occupancyCount',
    'bathroomCount',
    'simultaneousUse',
    'mainsFlowLpmKnown',
    'mainsFlowLpm',
    'hotWaterDemand',
    'storedType',
  ],
  defaults: {
    occupancyCount: 2,
    bathroomCount: 1,
    simultaneousUse: 'rare',
    mainsFlowLpmKnown: false,
    mainsFlowLpm: 12,
    hotWaterDemand: 'medium',
    storedType: 'unvented',
  },
  compareDefaults: {
    systemA: 'combi',
    systemB: 'stored_unvented',
  },
  outputFocus: [
    'demand_graph',
    'efficiency_graph',
    'inputs_summary',
  ],
  escalationAllowed: true,
};
