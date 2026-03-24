/**
 * testHelpers.ts — PR10 test utilities.
 *
 * Exports `deriveSelectedFamilyDataForTest` — a pure function that replicates
 * the core logic of `useSelectedFamilyData` without React, for use in Vitest
 * unit tests that cannot call hooks.
 *
 * Uses the same CLEAN_INPUT fixture used by the engine tests.
 */

import { buildSystemTopologyFromSpec } from '../../../engine/topology/SystemTopology';
import { runCombiSystemModel } from '../../../engine/runners/runCombiSystemModel';
import { runSystemStoredSystemModel } from '../../../engine/runners/runSystemStoredSystemModel';
import { runRegularStoredSystemModel } from '../../../engine/runners/runRegularStoredSystemModel';
import { runHeatPumpStoredSystemModel } from '../../../engine/runners/runHeatPumpStoredSystemModel';
import { buildDerivedEventsFromTimeline } from '../../../engine/timeline/buildDerivedEventsFromTimeline';
import { buildLimiterLedger } from '../../../engine/limiter/buildLimiterLedger';
import { buildFitMapModel } from '../../../engine/fitmap/buildFitMapModel';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type { SelectableFamily, SelectedFamilyData } from '../useSelectedFamilyData';

// ─── Clean fixture input ──────────────────────────────────────────────────────

/** Standard clean survey input — no pathological evidence for most limiters. */
export const CLEAN_TEST_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: true,
  mainsDynamicFlowLpm: 18,
};

// ─── Family-to-timeline-family mapping ───────────────────────────────────────

function familyToTimelineFamily(
  family: SelectableFamily,
): 'combi' | 'system' | 'regular' | 'heat_pump' {
  switch (family) {
    case 'combi':        return 'combi';
    case 'stored_water': return 'system';
    case 'open_vented':  return 'regular';
    case 'heat_pump':    return 'heat_pump';
  }
}

// ─── Exported helper ─────────────────────────────────────────────────────────

/**
 * Builds a complete SelectedFamilyData for the given family using the standard
 * CLEAN_TEST_INPUT fixture.  This replicates `useSelectedFamilyData` logic
 * without React hooks so that it can be used in pure Vitest unit tests.
 */
export function deriveSelectedFamilyDataForTest(
  family: SelectableFamily,
  input: EngineInputV2_3 = CLEAN_TEST_INPUT,
): SelectedFamilyData {
  let runnerResult;

  switch (family) {
    case 'combi': {
      const topology = buildSystemTopologyFromSpec({ systemType: 'combi' });
      runnerResult = runCombiSystemModel(input, topology);
      break;
    }
    case 'stored_water': {
      const topology = buildSystemTopologyFromSpec({ systemType: 'stored_water' });
      runnerResult = runSystemStoredSystemModel(input, topology);
      break;
    }
    case 'open_vented': {
      const topology = buildSystemTopologyFromSpec({ systemType: 'open_vented' });
      runnerResult = runRegularStoredSystemModel(input, topology);
      break;
    }
    case 'heat_pump': {
      const topology = buildSystemTopologyFromSpec({
        systemType: 'heat_pump',
        hotWaterStorageLitres: input.dhwStorageLitres ?? 200,
      });
      runnerResult = runHeatPumpStoredSystemModel(input, topology);
      break;
    }
  }

  const stateTimeline = runnerResult.stateTimeline;
  const events = buildDerivedEventsFromTimeline(stateTimeline, familyToTimelineFamily(family));
  const limiterLedger = buildLimiterLedger(runnerResult, events);
  const fitMap = buildFitMapModel(runnerResult, stateTimeline, events, limiterLedger);

  return { selectedFamily: family, runnerResult, stateTimeline, events, limiterLedger, fitMap };
}
