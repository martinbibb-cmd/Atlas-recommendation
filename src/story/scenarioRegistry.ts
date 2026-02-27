/**
 * scenarioRegistry.ts
 *
 * Central registry for Story Mode scenarios.
 * Each scenario defines the editable inputs, engine defaults, output focus, and
 * whether escalation to the Full Survey is permitted.
 *
 * Physics engine is NOT touched here — this is purely input scoping + routing.
 */

import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';
import { combiSwitchScenario } from './scenarios/combiSwitch';
import { oldBoilerRealityScenario } from './scenarios/oldBoilerReality';
import { heatPumpViabilityScenario } from './scenarios/heatPumpViability';
import type { HeatPumpViabilityInputs } from './scenarios/heatPumpViability';
export { combiSwitchScenario } from './scenarios/combiSwitch';
export { oldBoilerRealityScenario } from './scenarios/oldBoilerReality';
export { heatPumpViabilityScenario } from './scenarios/heatPumpViability';
export type { HeatPumpViabilityInputs } from './scenarios/heatPumpViability';

// ── Scenario field keys ───────────────────────────────────────────────────────

/**
 * Union of EngineInputV2_3 top-level keys that a scenario may declare as
 * editable.  This keeps the field list strongly typed without duplication.
 */
export type ScenarioFieldKey = keyof EngineInputV2_3;

// ── Output-focus panel identifiers ───────────────────────────────────────────

export type OutputPanel =
  | 'demand_vs_plant'
  | 'efficiency_curve'
  | 'dhw_overlap_notes'
  | 'band_ladder'
  | 'recovery_steps'
  | 'behaviour_bullets'
  | 'demand_graph'
  | 'efficiency_graph'
  | 'hydraulics'
  | 'inputs_summary';

// ── System archetype identifiers ─────────────────────────────────────────────

export type SystemArchetypeId =
  | 'combi'
  | 'stored_unvented'
  | 'stored_vented'
  | 'ashp'
  | 'mixergy';

// ── Scenario inputs (scenario-state, not raw EngineInputV2_3) ─────────────────

/**
 * Combi vs Stored scenario inputs.
 * These are the user-facing values captured in the input panel; they are
 * translated to EngineInputV2_3 by applyScenarioToEngineInput.
 */
export interface CombiSwitchInputs {
  occupancyCount: number;
  bathroomCount: number;
  simultaneousUse: 'rare' | 'sometimes' | 'often';
  mainsFlowLpmKnown: boolean;
  mainsFlowLpm: number;
  hotWaterDemand: 'low' | 'medium' | 'high';
  /** Advisor-selected stored cylinder type for System B comparison. */
  storedType: 'vented' | 'unvented';
}

/**
 * Old Boiler Reality Check scenario inputs.
 * Captured in the input panel; translated by applyScenarioToEngineInput.
 */
export interface OldBoilerRealityInputs {
  boilerAgeYears: number;
  manufacturedBand: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  manufacturedSedbukPctKnown: boolean;
  manufacturedSedbukPct: number;
  controlsType: 'basic_stat' | 'prog_stat' | 'modulating' | 'weather_comp';
  systemCleanliness: 'clean' | 'some_contamination' | 'heavy_contamination' | 'unknown';
  filterPresent: 'yes' | 'no' | 'unknown';
}

export type ScenarioInputs = CombiSwitchInputs | OldBoilerRealityInputs | HeatPumpViabilityInputs;

// ── Shared basics (cross-scenario state) ──────────────────────────────────────

/**
 * Fields that are shared across scenarios and should persist when the advisor
 * switches between scenarios or returns to the selector.
 *
 * Rules:
 *   - If a scenario edits a shared field → it syncs the value here.
 *   - When opening a scenario → shared values are merged into scenario defaults.
 *   - Scenario-specific fields (e.g. storedType) stay local to that scenario.
 */
export interface StorySharedBasics {
  occupancyCount?: number;
  bathroomCount?: number;
  mainsFlowLpm?: number;
  mainsFlowUnknown?: boolean;
  heatLossWatts?: number;
  heatLossKnown?: boolean;
}

/**
 * The keys that belong to StorySharedBasics.
 * Used to identify which scenario fields should be synced up to shared state.
 */
export const SHARED_BASICS_KEYS = [
  'occupancyCount',
  'bathroomCount',
  'mainsFlowLpm',
  'mainsFlowUnknown',
  'heatLossWatts',
  'heatLossKnown',
] as const satisfies ReadonlyArray<keyof StorySharedBasics>;

// ── Scenario definition ───────────────────────────────────────────────────────

export interface StoryScenario<TInputs extends ScenarioInputs = ScenarioInputs> {
  /** Machine-readable identifier — never changes between releases. */
  id: string;
  /** User-facing title. */
  title: string;
  /** Advisor-facing intent text. */
  description: string;
  /** Advisor-facing intent text shown above the input panel. */
  advisorIntent: string;
  /**
   * Ordered list of field keys (from ScenarioInputs) that are editable in
   * this scenario.  Must contain <= 8 entries.
   */
  fields: (keyof TInputs)[];
  /** Default values for ScenarioInputs. */
  defaults: TInputs;
  /** Default systemA/systemB archetype IDs. */
  compareDefaults: { systemA: SystemArchetypeId; systemB: SystemArchetypeId };
  /** Which output panels to render (in order). */
  outputFocus: OutputPanel[];
  /** Whether the "Explore Full Detail" escalation button is shown. */
  escalationAllowed: boolean;
}

// ── Registry ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const STORY_SCENARIOS: StoryScenario<any>[] = [
  combiSwitchScenario,
  oldBoilerRealityScenario,
  heatPumpViabilityScenario,
];
