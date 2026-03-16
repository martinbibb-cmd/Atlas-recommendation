/**
 * storySignalRegistry.ts
 *
 * Physics Story Mode — signal registry.
 *
 * Defines the canonical set of story signal identifiers and their
 * associated metadata.  Each signal maps one engine-detected physics
 * truth to a narrative card shown in PhysicsStoryPanel.
 *
 * Authoring rules:
 *  - Signals must be triggered by real engine output (limiters, flags,
 *    eligibility, or measured inputs) — not by generic heuristics.
 *  - `title` and `summary` are the expert-facing copy (inside Atlas).
 *  - `evidenceKeys` reference EngineOutputV1 or EngineInputV2_3 fields
 *    that support this signal.
 *  - `priority` determines ordering when multiple signals are triggered:
 *    lower = shown first.
 */

// ── Signal IDs ────────────────────────────────────────────────────────────────

export type StorySignalId =
  | 'combi_peak_demand_penalty'
  | 'stored_peak_demand_advantage'
  | 'ashp_flow_requirement_limit'
  | 'high_return_temp_condensing_penalty'
  | 'thermal_mass_supports_continuous_heat'
  | 'water_quality_scale_risk';

// ── Signal definition ─────────────────────────────────────────────────────────

export interface StorySignalDefinition {
  /** Stable identifier. */
  id: StorySignalId;
  /**
   * Card display order — lower priority number appears first.
   * Cards are sequenced: demand → constraint → behaviour → recommendation → future.
   */
  priority: number;
  /** Short card headline (≤ 60 chars). */
  title: string;
  /** One- or two-sentence summary for the card body. */
  summary: string;
  /**
   * Field paths or engine keys that provide the supporting metric.
   * Used by the card renderer to look up the evidence line.
   */
  evidenceKeys: string[];
  /**
   * ID of the visualiser panel to open when "Show simulation" is clicked.
   * Optional — omit when no linked visualiser exists.
   */
  visualiserId?: string;
  /**
   * ID of the explainer page/section to open when "Open explainer" is clicked.
   * Optional — omit when no linked explainer exists.
   */
  explainerId?: string;
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const STORY_SIGNAL_REGISTRY: StorySignalDefinition[] = [
  {
    id: 'combi_peak_demand_penalty',
    priority: 1,
    title: 'Your peak hot-water demand is the deciding factor',
    summary:
      'With multiple bathrooms or high occupancy, hot-water outlets can overlap. ' +
      'A combi has to produce hot water instantly — when more than one outlet runs ' +
      'at the same time, available flow becomes the bottleneck.',
    evidenceKeys: ['bathroomCount', 'occupancyCount', 'mainsDynamicFlowLpm'],
    visualiserId: 'hot_water_concurrency',
    explainerId: 'combi_flow_limit',
  },
  {
    id: 'stored_peak_demand_advantage',
    priority: 2,
    title: 'Stored hot water separates production from delivery',
    summary:
      'A stored system lets the boiler run a steady, efficient recovery cycle ' +
      'while the cylinder covers peak draw. This removes the simultaneous-demand ' +
      'bottleneck that limits a combi at this household size.',
    evidenceKeys: ['bathroomCount', 'occupancyCount'],
    visualiserId: 'cylinder_charge_discharge',
    explainerId: 'stored_peak_advantage',
  },
  {
    id: 'ashp_flow_requirement_limit',
    priority: 3,
    title: 'Existing pipework limits heat pump flow',
    summary:
      'Heat pumps move the same heat using much higher water flow rates. ' +
      'At this heat-loss level, your current primary pipe size is likely to ' +
      'restrict that flow and reduce output. Upsizing the primary circuit ' +
      'is a prerequisite.',
    evidenceKeys: ['primaryPipeSizeMm', 'designHeatLossKw', 'mainsDynamicFlowLpm'],
    visualiserId: 'ashp_flow_demand',
    explainerId: 'pipe_capacity',
  },
  {
    id: 'high_return_temp_condensing_penalty',
    priority: 4,
    title: 'The boiler can only reach its best efficiency at low return temperatures',
    summary:
      'Condensing efficiency requires return water below roughly 55 °C. ' +
      'With current emitters and controls, return temperatures are likely ' +
      'too high for the boiler to consistently reach condensing mode — ' +
      'leaving efficiency gains on the table.',
    evidenceKeys: ['estimatedReturnTempC', 'condensingLikelihood', 'emitterCapacityFactor'],
    visualiserId: 'return_temp_condensing',
    explainerId: 'condensing_return_temp',
  },
  {
    id: 'thermal_mass_supports_continuous_heat',
    priority: 5,
    title: 'This home holds heat well — steady heating works in your favour',
    summary:
      'Heavy-mass buildings absorb and release heat slowly. Continuous or ' +
      'long-pre-heat heating patterns suit this fabric well, and the home ' +
      'responds poorly to short on/off cycles that would increase discomfort ' +
      'and running costs.',
    evidenceKeys: ['buildingMass', 'occupancySignature', 'heatLossKw'],
    visualiserId: 'thermal_mass_comfort',
    explainerId: 'thermal_mass_inertia',
  },
  {
    id: 'water_quality_scale_risk',
    priority: 6,
    title: 'Your water chemistry could quietly erode efficiency over time',
    summary:
      'Hard water and elevated silicate levels form scale deposits inside ' +
      'heat exchangers. This reduces efficiency year on year and shortens ' +
      'appliance life. A scale inhibitor or water softener is the correct ' +
      'long-term protection.',
    evidenceKeys: ['waterHardnessCategory', 'postcode'],
    visualiserId: 'scale_buildup',
    explainerId: 'water_quality_scale',
  },
];

/** Look up a signal definition by its ID. */
export function getSignalDefinition(id: StorySignalId): StorySignalDefinition {
  const def = STORY_SIGNAL_REGISTRY.find(s => s.id === id);
  if (!def) throw new Error(`Unknown StorySignalId: ${id}`);
  return def;
}
