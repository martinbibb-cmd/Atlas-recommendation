/**
 * useSelectedFamilyData.ts — PR10: Selected-family data binding hook.
 *
 * Runs the appropriate topology-aware family runner for the selected appliance
 * family and derives the full evidence stack (DerivedSystemEventSummary,
 * LimiterLedger, FitMapModel) from its output.
 *
 * The selected family can be changed at runtime; on change the runner executes
 * synchronously (all runners are pure functions) and the derived data updates
 * atomically.
 *
 * Design rules:
 *   1. No cross-family data is ever mixed — the runner result, timeline, events,
 *      ledger, and fit map are always produced together by the same family.
 *   2. Runner selection is strict: combi input → combi runner; stored input → stored
 *      runner; heat pump input → HP runner; open-vented input → regular runner.
 *   3. This hook owns no physics — it delegates entirely to the engine layer.
 *   4. Same inputs + same family → same outputs (deterministic).
 */

import { useMemo, useState } from 'react';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { FamilyRunnerResult } from '../../engine/runners/types';
import type { DerivedSystemEventSummary } from '../../engine/timeline/DerivedSystemEvent';
import type { LimiterLedger } from '../../engine/limiter/LimiterLedger';
import type { FitMapModel } from '../../engine/fitmap/FitMapModel';
import type { SystemStateTimeline } from '../../engine/timeline/SystemStateTimeline';
import { buildSystemTopologyFromSpec } from '../../engine/topology/SystemTopology';
import { runCombiSystemModel } from '../../engine/runners/runCombiSystemModel';
import { runSystemStoredSystemModel } from '../../engine/runners/runSystemStoredSystemModel';
import { runRegularStoredSystemModel } from '../../engine/runners/runRegularStoredSystemModel';
import { runHeatPumpStoredSystemModel } from '../../engine/runners/runHeatPumpStoredSystemModel';
import { buildDerivedEventsFromTimeline } from '../../engine/timeline/buildDerivedEventsFromTimeline';
import { buildLimiterLedger } from '../../engine/limiter/buildLimiterLedger';
import { buildFitMapModel } from '../../engine/fitmap/buildFitMapModel';

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * System families that can be selected in the family view.
 *
 * Maps to the four topology-aware family runners:
 *   combi        → runCombiSystemModel
 *   stored_water → runSystemStoredSystemModel
 *   open_vented  → runRegularStoredSystemModel
 *   heat_pump    → runHeatPumpStoredSystemModel
 */
export type SelectableFamily = 'combi' | 'stored_water' | 'open_vented' | 'heat_pump';

/**
 * Human-readable labels for each selectable family.
 * Used for family selector UI and for data-testid values.
 */
export const FAMILY_LABELS: Record<SelectableFamily, string> = {
  combi:        'On-demand hot water',
  stored_water: 'Stored water system',
  open_vented:  'Tank-fed hot water',
  heat_pump:    'Heat pump',
};

/**
 * All structured outputs for the currently selected family.
 *
 * Every field is produced by running the same family runner — no field is
 * borrowed from a different family run.
 */
export interface SelectedFamilyData {
  /** Which family this data describes. */
  readonly selectedFamily: SelectableFamily;
  /** Raw runner output — module results, topology, normalizer. */
  readonly runnerResult: FamilyRunnerResult;
  /** Canonical state timeline from the runner (PR6). */
  readonly stateTimeline: SystemStateTimeline;
  /** Readable events and counters derived from the timeline (PR7). */
  readonly events: DerivedSystemEventSummary;
  /** Structured constraint evidence explaining why the run struggled (PR8). */
  readonly limiterLedger: LimiterLedger;
  /** Service-shape fit map derived from all evidence (PR9). */
  readonly fitMap: FitMapModel;
}

/**
 * Return value of `useSelectedFamilyData`.
 */
export interface UseSelectedFamilyDataResult {
  /** Currently selected family and all its derived outputs. */
  readonly data: SelectedFamilyData;
  /** Change the selected family.  Triggers a synchronous re-derivation. */
  readonly setSelectedFamily: (family: SelectableFamily) => void;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Maps SelectableFamily to the HeatSourceBehaviourInput.systemType used by
 * `buildSystemTopologyFromSpec`.
 */
function familyToSystemType(
  family: SelectableFamily,
): 'combi' | 'stored_water' | 'open_vented' | 'heat_pump' {
  return family;
}

/**
 * Run the correct family runner for the given family and input.
 * Returns the FamilyRunnerResult — never mixes families.
 */
function runFamilyRunner(
  family: SelectableFamily,
  input: EngineInputV2_3,
): FamilyRunnerResult {
  switch (family) {
    case 'combi': {
      const topology = buildSystemTopologyFromSpec({ systemType: familyToSystemType(family) });
      return runCombiSystemModel(input, topology);
    }
    case 'stored_water': {
      const topology = buildSystemTopologyFromSpec({ systemType: familyToSystemType(family) });
      return runSystemStoredSystemModel(input, topology);
    }
    case 'open_vented': {
      const topology = buildSystemTopologyFromSpec({ systemType: familyToSystemType(family) });
      return runRegularStoredSystemModel(input, topology);
    }
    case 'heat_pump': {
      const topology = buildSystemTopologyFromSpec({
        systemType: familyToSystemType(family),
        hotWaterStorageLitres: input.dhwStorageLitres ?? 200,
      });
      return runHeatPumpStoredSystemModel(input, topology);
    }
  }
}

/**
 * Map SelectableFamily to the TimelineApplianceFamily expected by
 * buildDerivedEventsFromTimeline.
 */
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

/**
 * Build all derived data for a single family run.
 * Pure function — same inputs always produce same outputs.
 */
function deriveSelectedFamilyData(
  family: SelectableFamily,
  input: EngineInputV2_3,
): SelectedFamilyData {
  const runnerResult = runFamilyRunner(family, input);
  const stateTimeline = runnerResult.stateTimeline;
  const events = buildDerivedEventsFromTimeline(stateTimeline, familyToTimelineFamily(family));
  const limiterLedger = buildLimiterLedger(runnerResult, events, {
    occupancyCount: input.occupancyCount,
    bathroomCount: input.bathroomCount,
    peakConcurrentOutlets: input.peakConcurrentOutlets,
  });
  const fitMap = buildFitMapModel(runnerResult, stateTimeline, events, limiterLedger);
  return { selectedFamily: family, runnerResult, stateTimeline, events, limiterLedger, fitMap };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Runs the topology-aware family runner for the selected appliance family and
 * derives the complete evidence stack from its output.
 *
 * Changing the selected family triggers a synchronous re-derivation.
 *
 * @param input       Engine input derived from the completed survey.
 * @param initialFamily  The family to show on first render.  Defaults to 'combi'.
 */
export function useSelectedFamilyData(
  input: EngineInputV2_3,
  initialFamily: SelectableFamily = 'combi',
): UseSelectedFamilyDataResult {
  const [selectedFamily, setSelectedFamily] = useState<SelectableFamily>(initialFamily);

  const data = useMemo(
    () => deriveSelectedFamilyData(selectedFamily, input),
    [selectedFamily, input],
  );

  return { data, setSelectedFamily };
}
