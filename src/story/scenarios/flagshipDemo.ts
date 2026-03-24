/**
 * flagshipDemo.ts
 *
 * Flagship demo preset for the Atlas presentation layer.
 *
 * This is the "show this to anyone" scenario — a single, stable preset that
 * always produces a clear story:
 *
 *   Current struggling combi
 *     → recommended stored (unvented) system
 *       → future heat-pump pathway
 *
 * Key characteristics:
 *   - 3 occupants, 1 bathroom       → borderline occupancy demand
 *   - simultaneous use: often        → peakConcurrentOutlets = 2 → combi hard-stop
 *   - low mains flow (8 L/min)       → mains_flow_constraint on combi
 *   - high hot water demand          → stored system wins on performance
 *   - stored unvented System B       → clean comparison, no gravity drawbacks
 *
 * This preset is locked — do not change defaults unless the flagship story
 * changes.  All visual and copy development should be validated against it.
 */

import type { StoryScenario } from '../scenarioRegistry';
import type { CombiSwitchInputs } from '../scenarioRegistry';

export const flagshipDemoScenario: StoryScenario<CombiSwitchInputs> = {
  id: 'flagship_demo',
  title: 'Stored system upgrade',
  description:
    'A busy household where a combi struggles to keep up — and a stored system resolves it.',
  advisorIntent:
    "Let's walk through exactly what's happening in a home like this, and why the upgrade makes sense.",
  fields: [
    'occupancyCount',
    'bathroomCount',
    'simultaneousUse',
    'mainsFlowLpmKnown',
    'mainsFlowLpm',
    'hotWaterDemand',
    'storedType',
    'season',
    'dhwMode',
    'showerPreset',
    'combiKw',
    'propertyType',
    'showersPerDay',
    'showerDurationPreset',
    'bathsPerDay',
  ],
  defaults: {
    // 3 occupants + 1 bathroom + frequent simultaneous use is the core conflict.
    // - occupancyCount 3 = borderline demand (warn on combi DHW assessment)
    // - simultaneousUse 'often' → peakConcurrentOutlets = 2 → hard-stop for combi
    occupancyCount: 3,
    bathroomCount: 1,
    simultaneousUse: 'often',
    // Known low mains flow — chosen to surface the mains_flow_constraint clearly.
    mainsFlowLpmKnown: true,
    mainsFlowLpm: 8,
    hotWaterDemand: 'high',
    // Unvented cylinder: mains-pressure stored system, best comparison to combi.
    storedType: 'unvented',
    // Winter season surfaces worst-case DHW recovery times.
    season: 'winter',
    dhwMode: 'normal',
    showerPreset: 'mixer',
    // 28 kW combi: typical mid-range, enough to highlight the simultaneous limit.
    combiKw: 28,
    propertyType: 'medium_house',
    // 3 showers/day with standard duration creates realistic morning peak demand.
    showersPerDay: 3,
    showerDurationPreset: 'standard',
    bathsPerDay: 0,
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
