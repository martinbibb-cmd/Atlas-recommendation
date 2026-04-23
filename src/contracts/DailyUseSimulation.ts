/**
 * DailyUseSimulation.ts — Contract for the daily-use simulator panel.
 *
 * Describes a sequence of household events (shower, bath, etc.) and the
 * system's reaction to each, derived from canonical scenario truth.
 *
 * Design rules:
 *   - This is a view model contract, not a physics model.
 *   - All field values must be derived from AtlasDecisionV1, ScenarioResult,
 *     physicsFlags, and dayToDayOutcomes — never invented in UI components.
 *   - No Math.random() anywhere in the derivation chain.
 */

/** Events that can be simulated in the daily-use panel. */
export type DailyUseEventType =
  | 'shower'
  | 'second_shower'
  | 'bath'
  | 'sink'
  | 'heating_boost';

/**
 * Snapshot of the heat-source and supply state during a simulated event.
 * Only populate optional fields when they can be derived from scenario truth.
 */
export type DailyUseTopPanel = {
  /** What the heat source is doing at this moment. */
  heatSourceState: 'idle' | 'heating' | 'hot_water' | 'recovering';
  /** Current room temperature in °C (omit when not derivable). */
  roomTempC?: number;
  /** Flow temperature of the heat source in °C (omit when not derivable). */
  flowTempC?: number;
  /** Return temperature from the heating circuit in °C (omit when not derivable). */
  returnTempC?: number;
  /** Mains cold-water supply status at this moment. */
  coldMainsStatus: 'strong' | 'reduced' | 'limited' | 'unknown';
  /** Hot-water cylinder charge percentage (omit for combi — no cylinder). */
  cylinderChargePercent?: number;
};

/** A single consequence card shown after an event. */
export type DailyUseReaction = {
  /** Short heading for the reaction card. */
  title: string;
  /** One-sentence outcome description — experiential, not technical. */
  outcome: string;
  /** Visual severity tone. */
  severity: 'good' | 'mixed' | 'warning';
  /** Optional supporting detail points (up to 3). */
  supportingPoints?: string[];
};

/** One simulated household event with its system reaction. */
export type DailyUseSimulationStep = {
  /** Which event this step represents. */
  eventType: DailyUseEventType;
  /** Button label shown in the event row. */
  label: string;
  /** 1–3 reaction cards produced by this event. */
  reactions: DailyUseReaction[];
  /** Top-panel state snapshot during this event. */
  topPanel: DailyUseTopPanel;
};

/**
 * DailyUseSimulation
 *
 * The complete simulation output for one scenario. Built by
 * buildDailyUseSimulation from AtlasDecisionV1 and ScenarioResult[].
 */
export type DailyUseSimulation = {
  /** scenarioId of the scenario this simulation describes. */
  scenarioId: string;
  /** Customer-facing panel title. */
  title: string;
  /** Ordered list of simulated events. */
  steps: DailyUseSimulationStep[];
};
