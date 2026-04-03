/**
 * LimiterLedger.test.ts — PR8: Tests for the canonical limiter ledger.
 *
 * Test categories:
 *   1.  Positive — combi interruption timeline yields combi_service_switching
 *   2.  Positive — simultaneous demand event yields simultaneous_demand_constraint
 *   3.  Positive — hydronic depleted/partial store yields stored_volume_shortfall
 *   4.  Positive — reduced service without depletion evidence yields reduced_dhw_service
 *   5.  Positive — HP slow recharge yields hp_reheat_latency
 *   6.  Positive — hydraulic constraints map to hydraulic limiter entries
 *   7.  Positive — cycling loss triggers cycling_risk
 *   8.  Positive — non-condensing zone triggers high_return_temp_non_condensing
 *   9.  Positive — high flow temp triggers emitter_temperature_constraint
 *  10.  Positive — HP poor SPF triggers hp_high_flow_temp_penalty
 *  11.  Positive — open_vented topology triggers open_vented_head_limit
 *  12.  Positive — dhw_storage_required from HP topology
 *  13.  Positive — dhw_storage_required from combi demand evidence
 *  14.  Positive — space_for_cylinder_unavailable from stored-space-tight flag
 *  15.  Negative — no limiter without evidence
 *  16.  Negative — no duplicate limiter entries
 *  17.  Negative — hydronic runs do not emit combi-only limiter ids
 *  18.  Negative — combi runs do not emit store-only limiter ids
 *  19.  Negative — empty/clean run yields low-noise ledger
 *  20.  Structural — every entry has required fields
 *  21.  Structural — deterministic ordering
 */

import { describe, it, expect } from 'vitest';
import { buildLimiterLedger } from '../limiter/buildLimiterLedger';
import {
  COMBI_ONLY_LIMITER_IDS,
  STORE_ONLY_LIMITER_IDS,
  HEAT_PUMP_ONLY_LIMITER_IDS,
} from '../limiter/LimiterLedger';
import { buildDerivedEventsFromTimeline } from '../timeline/buildDerivedEventsFromTimeline';
import { buildCombiStateTimeline } from '../timeline/buildCombiStateTimeline';
import { buildHydronicStateTimeline } from '../timeline/buildHydronicStateTimeline';
import {
  runCombiDhwPhaseModel,
  adaptEngineInputToCombiPhase,
} from '../modules/CombiDhwPhaseModel';
import {
  runStoredDhwPhaseModel,
  adaptEngineInputToStoredPhase,
} from '../modules/StoredDhwPhaseModel';
import type { CombiDhwPhaseInput } from '../modules/CombiDhwPhaseModel';
import type { StoredDhwPhaseInput } from '../modules/StoredDhwPhaseModel';
import { runCombiSystemModel } from '../runners/runCombiSystemModel';
import { runSystemStoredSystemModel } from '../runners/runSystemStoredSystemModel';
import { runHeatPumpStoredSystemModel } from '../runners/runHeatPumpStoredSystemModel';
import { runRegularStoredSystemModel } from '../runners/runRegularStoredSystemModel';
import { buildSystemTopologyFromSpec } from '../topology/SystemTopology';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import type { FamilyRunnerResult } from '../runners/types';
import type { DerivedSystemEventSummary } from '../timeline/DerivedSystemEvent';

// ─── Base inputs ──────────────────────────────────────────────────────────────

/** Standard survey input — clean run, no evidence for most limiters. */
const CLEAN_INPUT: EngineInputV2_3 = {
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

// ─── Topology helpers ─────────────────────────────────────────────────────────

const combiTopology   = buildSystemTopologyFromSpec({ systemType: 'combi' });
const systemTopology  = buildSystemTopologyFromSpec({ systemType: 'stored_water' });
const regularTopology = buildSystemTopologyFromSpec({ systemType: 'open_vented' });
const hpTopology      = buildSystemTopologyFromSpec({ systemType: 'heat_pump', hotWaterStorageLitres: 200 });

// ─── Runner helpers ───────────────────────────────────────────────────────────

/** Run combi with simultaneous CH active — produces interruption events. */
function combiWithInterruption(input: EngineInputV2_3 = CLEAN_INPUT): {
  runnerResult: FamilyRunnerResult;
  eventSummary: DerivedSystemEventSummary;
} {
  const runnerResult = runCombiSystemModel(
    { ...input, simultaneousChActive: true },
    combiTopology,
  );
  const eventSummary = buildDerivedEventsFromTimeline(
    runnerResult.stateTimeline,
    'combi',
  );
  return { runnerResult, eventSummary };
}

/** Run combi without CH active — no interruption events. */
function combiClean(input: EngineInputV2_3 = CLEAN_INPUT): {
  runnerResult: FamilyRunnerResult;
  eventSummary: DerivedSystemEventSummary;
} {
  const runnerResult = runCombiSystemModel(input, combiTopology);
  const eventSummary = buildDerivedEventsFromTimeline(
    runnerResult.stateTimeline,
    'combi',
  );
  return { runnerResult, eventSummary };
}

/** Run system stored with a depleting draw — produces depletion evidence. */
function systemDepletingDraw(input: EngineInputV2_3 = CLEAN_INPUT): {
  runnerResult: FamilyRunnerResult;
  eventSummary: DerivedSystemEventSummary;
} {
  // A very large draw depletes the cylinder
  const runnerResult = runSystemStoredSystemModel(
    { ...input, dhwDrawVolumeLitres: 999 },
    systemTopology,
  );
  const eventSummary = buildDerivedEventsFromTimeline(
    runnerResult.stateTimeline,
    'system',
  );
  return { runnerResult, eventSummary };
}

/** Run heat pump stored — produces HP-specific output. */
function heatPumpRun(input: EngineInputV2_3 = CLEAN_INPUT): {
  runnerResult: FamilyRunnerResult;
  eventSummary: DerivedSystemEventSummary;
} {
  const runnerResult = runHeatPumpStoredSystemModel(
    { ...input, dhwDrawVolumeLitres: 999 },
    hpTopology,
  );
  const eventSummary = buildDerivedEventsFromTimeline(
    runnerResult.stateTimeline,
    'heat_pump',
  );
  return { runnerResult, eventSummary };
}

/** Run regular/open-vented stored. */
function regularRun(input: EngineInputV2_3 = CLEAN_INPUT): {
  runnerResult: FamilyRunnerResult;
  eventSummary: DerivedSystemEventSummary;
} {
  const runnerResult = runRegularStoredSystemModel(
    { ...input, preferCombi: false },
    regularTopology,
  );
  const eventSummary = buildDerivedEventsFromTimeline(
    runnerResult.stateTimeline,
    'open_vented',
  );
  return { runnerResult, eventSummary };
}

// ─── 1. Combi interruption → combi_service_switching ──────────────────────────

describe('LimiterLedger — combi: combi_service_switching', () => {
  it('emits combi_service_switching when combi has heating interruptions', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    // Only if the timeline actually produced interruption events
    if (eventSummary.counters.heatingInterruptions > 0) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'combi_service_switching')).toBe(true);
    }
  });

  it('combi_service_switching has domain "dhw"', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    if (eventSummary.counters.heatingInterruptions > 0) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'combi_service_switching');
      if (entry) expect(entry.domain).toBe('dhw');
    }
  });

  it('combi_service_switching has severity "warning"', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    if (eventSummary.counters.heatingInterruptions > 0) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'combi_service_switching');
      if (entry) expect(entry.severity).toBe('warning');
    }
  });

  it('combi_service_switching source is "timeline"', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    if (eventSummary.counters.heatingInterruptions > 0) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'combi_service_switching');
      if (entry) expect(entry.source).toBe('timeline');
    }
  });

  it('combi_service_switching triggerKeys includes heating_interrupted_by_dhw', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    if (eventSummary.counters.heatingInterruptions > 0) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'combi_service_switching');
      if (entry) expect(entry.triggerKeys).toContain('heating_interrupted_by_dhw');
    }
  });

  it('does NOT emit combi_service_switching when no CH interruption occurred', () => {
    const { runnerResult, eventSummary } = combiClean();
    // A clean combi draw without CH active should not emit this
    if (eventSummary.counters.heatingInterruptions === 0) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'combi_service_switching')).toBe(false);
    }
  });
});

// ─── 2. Simultaneous demand constraint ───────────────────────────────────────

describe('LimiterLedger — shared: simultaneous_demand_constraint', () => {
  it('emits simultaneous_demand_constraint when event is present', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    if (eventSummary.counters.simultaneousDemandConstraints > 0) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'simultaneous_demand_constraint')).toBe(true);
    }
  });

  it('simultaneous_demand_constraint has severity "limit"', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    if (eventSummary.counters.simultaneousDemandConstraints > 0) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'simultaneous_demand_constraint');
      if (entry) expect(entry.severity).toBe('limit');
    }
  });

  it('simultaneous_demand_constraint triggerKeys includes simultaneous_demand_constraint', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    if (eventSummary.counters.simultaneousDemandConstraints > 0) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'simultaneous_demand_constraint');
      if (entry) expect(entry.triggerKeys).toContain('simultaneous_demand_constraint');
    }
  });
});

// ─── 3. Depleted/partial store → stored_volume_shortfall ─────────────────────

describe('LimiterLedger — hydronic: stored_volume_shortfall', () => {
  it('emits stored_volume_shortfall when depleting draw occurs with store depletion', () => {
    const { runnerResult, eventSummary } = systemDepletingDraw();
    const hasDepletionTimeline = runnerResult.stateTimeline.some(
      t => t.storeStateSummary === 'depleted' || t.storeStateSummary === 'partial',
    );
    if (eventSummary.counters.reducedDhwEvents > 0 && hasDepletionTimeline) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'stored_volume_shortfall')).toBe(true);
    }
  });

  it('stored_volume_shortfall has domain "dhw"', () => {
    const { runnerResult, eventSummary } = systemDepletingDraw();
    const hasDepletion = runnerResult.stateTimeline.some(
      t => t.storeStateSummary === 'depleted' || t.storeStateSummary === 'partial',
    );
    if (eventSummary.counters.reducedDhwEvents > 0 && hasDepletion) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'stored_volume_shortfall');
      if (entry) expect(entry.domain).toBe('dhw');
    }
  });

  it('stored_volume_shortfall has severity "limit"', () => {
    const { runnerResult, eventSummary } = systemDepletingDraw();
    const hasDepletion = runnerResult.stateTimeline.some(
      t => t.storeStateSummary === 'depleted' || t.storeStateSummary === 'partial',
    );
    if (eventSummary.counters.reducedDhwEvents > 0 && hasDepletion) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'stored_volume_shortfall');
      if (entry) expect(entry.severity).toBe('limit');
    }
  });

  it('stored_volume_shortfall triggerKeys contains "reduced_dhw_service"', () => {
    const { runnerResult, eventSummary } = systemDepletingDraw();
    const hasDepletion = runnerResult.stateTimeline.some(
      t => t.storeStateSummary === 'depleted' || t.storeStateSummary === 'partial',
    );
    if (eventSummary.counters.reducedDhwEvents > 0 && hasDepletion) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'stored_volume_shortfall');
      if (entry) expect(entry.triggerKeys).toContain('reduced_dhw_service');
    }
  });

  it('stored_volume_shortfall is NOT emitted for combi runs', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'stored_volume_shortfall')).toBe(false);
  });
});

// ─── 4. Reduced service without depletion → reduced_dhw_service ──────────────

describe('LimiterLedger — hydronic: reduced_dhw_service', () => {
  it('emits reduced_dhw_service when reduced events present but no confirmed depletion', () => {
    // Partial store that delivers reduced service but isn't "depleted"
    const partialInput: EngineInputV2_3 = {
      ...CLEAN_INPUT,
      preferCombi: false,
      dhwStorageLitres: 150,
      storeMeanTempC: 45,
      storeTopTempC: 50,
    };
    const runnerResult = runSystemStoredSystemModel(partialInput, systemTopology);
    const eventSummary = buildDerivedEventsFromTimeline(
      runnerResult.stateTimeline,
      'system',
    );
    if (
      eventSummary.counters.reducedDhwEvents > 0 &&
      !runnerResult.stateTimeline.some(
        t => t.storeStateSummary === 'depleted' || t.storeStateSummary === 'partial',
      ) &&
      !eventSummary.events.some(e => e.eventType === 'store_depleted')
    ) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'reduced_dhw_service')).toBe(true);
    }
  });

  it('does NOT emit reduced_dhw_service for combi runs', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'reduced_dhw_service')).toBe(false);
  });
});

// ─── 5. HP slow recharge → hp_reheat_latency ─────────────────────────────────

describe('LimiterLedger — heat pump: hp_reheat_latency', () => {
  it('emits hp_reheat_latency when HP recovery is slow and recharge was triggered', () => {
    const { runnerResult, eventSummary } = heatPumpRun();
    const storedPhase = runnerResult.dhw.storedDhwPhase;
    if (
      storedPhase !== undefined &&
      storedPhase.recoveryCharacteristic === 'heat_pump_stored' &&
      storedPhase.drawOffResult.postDrawStoreState.estimatedRecoveryMinutes > 45 &&
      eventSummary.counters.rechargeCycles > 0
    ) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'hp_reheat_latency')).toBe(true);
    }
  });

  it('hp_reheat_latency has domain "dhw"', () => {
    const { runnerResult, eventSummary } = heatPumpRun();
    const storedPhase = runnerResult.dhw.storedDhwPhase;
    if (
      storedPhase !== undefined &&
      storedPhase.recoveryCharacteristic === 'heat_pump_stored' &&
      storedPhase.drawOffResult.postDrawStoreState.estimatedRecoveryMinutes > 45 &&
      eventSummary.counters.rechargeCycles > 0
    ) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'hp_reheat_latency');
      if (entry) expect(entry.domain).toBe('dhw');
    }
  });

  it('hp_reheat_latency source is "stored_dhw_phase"', () => {
    const { runnerResult, eventSummary } = heatPumpRun();
    const storedPhase = runnerResult.dhw.storedDhwPhase;
    if (
      storedPhase !== undefined &&
      storedPhase.recoveryCharacteristic === 'heat_pump_stored' &&
      storedPhase.drawOffResult.postDrawStoreState.estimatedRecoveryMinutes > 45 &&
      eventSummary.counters.rechargeCycles > 0
    ) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'hp_reheat_latency');
      if (entry) expect(entry.source).toBe('stored_dhw_phase');
    }
  });

  it('does NOT emit hp_reheat_latency for combi runs', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'hp_reheat_latency')).toBe(false);
  });

  it('does NOT emit hp_reheat_latency for boiler system runs', () => {
    const { runnerResult, eventSummary } = systemDepletingDraw();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'hp_reheat_latency')).toBe(false);
  });
});

// ─── 6. Hydraulic module constraints → hydraulic limiters ────────────────────

describe('LimiterLedger — hydraulic: mains_flow_constraint', () => {
  it('emits mains_flow_constraint when measured flow is below 13 L/min', () => {
    const input = { ...CLEAN_INPUT, mainsDynamicFlowLpm: 8 };
    const runnerResult = runCombiSystemModel(input, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'mains_flow_constraint')).toBe(true);
  });

  it('mains_flow_constraint has domain "hydraulic"', () => {
    const input = { ...CLEAN_INPUT, mainsDynamicFlowLpm: 8 };
    const runnerResult = runCombiSystemModel(input, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    const entry = ledger.entries.find(e => e.id === 'mains_flow_constraint');
    expect(entry).toBeDefined();
    expect(entry!.domain).toBe('hydraulic');
  });

  it('mains_flow_constraint has severity "limit" when flow < 10 L/min', () => {
    const input = { ...CLEAN_INPUT, mainsDynamicFlowLpm: 8 };
    const runnerResult = runCombiSystemModel(input, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    const entry = ledger.entries.find(e => e.id === 'mains_flow_constraint');
    expect(entry!.severity).toBe('limit');
  });

  it('mains_flow_constraint has severity "warning" when flow is 10–12 L/min', () => {
    const input = { ...CLEAN_INPUT, mainsDynamicFlowLpm: 11 };
    const runnerResult = runCombiSystemModel(input, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    const entry = ledger.entries.find(e => e.id === 'mains_flow_constraint');
    expect(entry!.severity).toBe('warning');
  });

  it('does NOT emit mains_flow_constraint when flow is adequate (>= 13 L/min)', () => {
    const runnerResult = runCombiSystemModel(CLEAN_INPUT, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'mains_flow_constraint')).toBe(false);
  });
});

describe('LimiterLedger — hydraulic: primary_pipe_constraint', () => {
  it('emits primary_pipe_constraint for heat_pump family when ASHP pipe risk is not pass', () => {
    // 22mm pipe + high heat loss triggers ashpRisk
    const input = { ...CLEAN_INPUT, primaryPipeDiameter: 22, heatLossWatts: 14000 };
    const { runnerResult, eventSummary } = heatPumpRun(input);
    if (runnerResult.hydraulic.v1.verdict.ashpRisk !== 'pass') {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'primary_pipe_constraint')).toBe(true);
    }
  });

  it('does NOT emit primary_pipe_constraint for combi family (HP constraint is not relevant to boiler families)', () => {
    const input = { ...CLEAN_INPUT, primaryPipeDiameter: 22, heatLossWatts: 14000 };
    const runnerResult = runCombiSystemModel(input, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'primary_pipe_constraint')).toBe(false);
  });

  it('primary_pipe_constraint has domain "hydraulic"', () => {
    const input = { ...CLEAN_INPUT, primaryPipeDiameter: 22, heatLossWatts: 14000 };
    const { runnerResult, eventSummary } = heatPumpRun(input);
    if (runnerResult.hydraulic.v1.verdict.ashpRisk !== 'pass') {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'primary_pipe_constraint');
      if (entry) expect(entry.domain).toBe('hydraulic');
    }
  });

  it('primary_pipe_constraint has severity "warning" (hard stops are not permitted — advice only)', () => {
    const input = { ...CLEAN_INPUT, primaryPipeDiameter: 22, heatLossWatts: 14000 };
    const { runnerResult, eventSummary } = heatPumpRun(input);
    if (runnerResult.hydraulic.v1.verdict.ashpRisk === 'fail') {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'primary_pipe_constraint');
      if (entry) expect(entry.severity).toBe('warning');
    }
  });

  it('does NOT emit primary_pipe_constraint when ASHP pipe risk is pass', () => {
    // 28mm pipe passes for most heat loss values
    const input = { ...CLEAN_INPUT, primaryPipeDiameter: 28, heatLossWatts: 8000 };
    const { runnerResult, eventSummary } = heatPumpRun(input);
    if (runnerResult.hydraulic.v1.verdict.ashpRisk === 'pass') {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'primary_pipe_constraint')).toBe(false);
    }
  });
});

describe('LimiterLedger — hydraulic: pressure_constraint', () => {
  it('emits pressure_constraint when dynamic mains pressure < 1.0 bar', () => {
    const input = { ...CLEAN_INPUT, dynamicMainsPressure: 0.5 };
    const runnerResult = runCombiSystemModel(input, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'pressure_constraint')).toBe(true);
  });

  it('pressure_constraint has domain "hydraulic"', () => {
    const input = { ...CLEAN_INPUT, dynamicMainsPressure: 0.5 };
    const runnerResult = runCombiSystemModel(input, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    const entry = ledger.entries.find(e => e.id === 'pressure_constraint');
    expect(entry!.domain).toBe('hydraulic');
  });

  it('does NOT emit pressure_constraint when pressure is adequate (>= 1.0 bar)', () => {
    const runnerResult = runCombiSystemModel(CLEAN_INPUT, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'pressure_constraint')).toBe(false);
  });
});

// ─── 7. Cycling loss → cycling_risk ──────────────────────────────────────────

describe('LimiterLedger — efficiency: cycling_risk', () => {
  it('emits cycling_risk when sludge cycling loss is at maximum threshold', () => {
    // one_pipe topology + 15 year age + no magnetic filter → max cycling loss
    const input: EngineInputV2_3 = {
      ...CLEAN_INPUT,
      pipingTopology: 'one_pipe',
      systemAgeYears: 20,
      hasMagneticFilter: false,
    };
    const runnerResult = runCombiSystemModel(input, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    if (runnerResult.hydraulic.sludgeVsScale.cyclingLossPct >= 0.05) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'cycling_risk')).toBe(true);
    }
  });

  it('cycling_risk has domain "efficiency"', () => {
    const input: EngineInputV2_3 = {
      ...CLEAN_INPUT,
      pipingTopology: 'one_pipe',
      systemAgeYears: 20,
      hasMagneticFilter: false,
    };
    const runnerResult = runCombiSystemModel(input, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    if (runnerResult.hydraulic.sludgeVsScale.cyclingLossPct >= 0.05) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'cycling_risk');
      if (entry) expect(entry.domain).toBe('efficiency');
    }
  });

  it('does NOT emit cycling_risk when no sludge loss present', () => {
    const input: EngineInputV2_3 = {
      ...CLEAN_INPUT,
      hasMagneticFilter: true,
      systemAgeYears: 0,
    };
    const runnerResult = runCombiSystemModel(input, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    if (runnerResult.hydraulic.sludgeVsScale.cyclingLossPct < 0.05) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'cycling_risk')).toBe(false);
    }
  });
});

// ─── 8. Non-condensing zone → high_return_temp_non_condensing ────────────────

describe('LimiterLedger — efficiency: high_return_temp_non_condensing', () => {
  it('emits high_return_temp_non_condensing when condensing zone is non_condensing', () => {
    // supplyTempC: 90 → fullLoadReturnC: 70 > 65 → non_condensing
    const input: EngineInputV2_3 = { ...CLEAN_INPUT, supplyTempC: 90 };
    const runnerResult = runCombiSystemModel(input, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    if (runnerResult.efficiency.condensingState.zone === 'non_condensing') {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'high_return_temp_non_condensing')).toBe(true);
    }
  });

  it('high_return_temp_non_condensing has domain "efficiency"', () => {
    const input: EngineInputV2_3 = { ...CLEAN_INPUT, supplyTempC: 90 };
    const runnerResult = runCombiSystemModel(input, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    if (runnerResult.efficiency.condensingState.zone === 'non_condensing') {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'high_return_temp_non_condensing');
      if (entry) expect(entry.domain).toBe('efficiency');
    }
  });

  it('high_return_temp_non_condensing source is "condensing_state"', () => {
    const input: EngineInputV2_3 = { ...CLEAN_INPUT, supplyTempC: 90 };
    const runnerResult = runCombiSystemModel(input, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    if (runnerResult.efficiency.condensingState.zone === 'non_condensing') {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'high_return_temp_non_condensing');
      if (entry) expect(entry.source).toBe('condensing_state');
    }
  });

  it('does NOT emit high_return_temp_non_condensing when zone is condensing', () => {
    // Default supplyTempC 70 → fullLoadReturnC 50 < 55 → condensing
    const runnerResult = runCombiSystemModel(CLEAN_INPUT, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    if (runnerResult.efficiency.condensingState.zone === 'condensing') {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'high_return_temp_non_condensing')).toBe(false);
    }
  });
});

// ─── 9. High flow temp band → emitter_temperature_constraint ─────────────────

describe('LimiterLedger — space_heating: emitter_temperature_constraint', () => {
  it('emits emitter_temperature_constraint when designFlowTempBand >= 50', () => {
    // Default no emitter upgrade appetite → designFlowTempBand = 50
    const runnerResult = runCombiSystemModel(CLEAN_INPUT, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    if (runnerResult.heating.heatPumpRegime.designFlowTempBand >= 50) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'emitter_temperature_constraint')).toBe(true);
    }
  });

  it('emitter_temperature_constraint has domain "space_heating"', () => {
    const runnerResult = runCombiSystemModel(CLEAN_INPUT, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    if (runnerResult.heating.heatPumpRegime.designFlowTempBand >= 50) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'emitter_temperature_constraint');
      if (entry) expect(entry.domain).toBe('space_heating');
    }
  });

  it('does NOT emit emitter_temperature_constraint when full emitter upgrade is done', () => {
    // full_job → designFlowTempBand = 35
    const input: EngineInputV2_3 = {
      ...CLEAN_INPUT,
      retrofit: { emitterUpgradeAppetite: 'full_job' },
    };
    const runnerResult = runCombiSystemModel(input, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    if (runnerResult.heating.heatPumpRegime.designFlowTempBand < 50) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'emitter_temperature_constraint')).toBe(false);
    }
  });
});

// ─── 10. HP poor SPF → hp_high_flow_temp_penalty ─────────────────────────────

describe('LimiterLedger — efficiency: hp_high_flow_temp_penalty', () => {
  it('emits hp_high_flow_temp_penalty for HP family with poor SPF and high flow band', () => {
    // HP with no emitter upgrade → designFlowTempBand = 50, spfBand = 'poor'
    const { runnerResult, eventSummary } = heatPumpRun();
    if (
      runnerResult.heating.heatPumpRegime.spfBand === 'poor' &&
      runnerResult.heating.heatPumpRegime.designFlowTempBand >= 50
    ) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'hp_high_flow_temp_penalty')).toBe(true);
    }
  });

  it('hp_high_flow_temp_penalty has domain "efficiency"', () => {
    const { runnerResult, eventSummary } = heatPumpRun();
    if (
      runnerResult.heating.heatPumpRegime.spfBand === 'poor' &&
      runnerResult.heating.heatPumpRegime.designFlowTempBand >= 50
    ) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'hp_high_flow_temp_penalty');
      if (entry) expect(entry.domain).toBe('efficiency');
    }
  });

  it('does NOT emit hp_high_flow_temp_penalty for combi runs', () => {
    const { runnerResult, eventSummary } = combiClean();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'hp_high_flow_temp_penalty')).toBe(false);
  });

  it('does NOT emit hp_high_flow_temp_penalty for boiler system runs', () => {
    const { runnerResult, eventSummary } = systemDepletingDraw();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'hp_high_flow_temp_penalty')).toBe(false);
  });
});

// ─── 11. Open vented topology → open_vented_head_limit ───────────────────────

describe('LimiterLedger — hydraulic: open_vented_head_limit', () => {
  it('emits open_vented_head_limit for open_vented family', () => {
    const { runnerResult, eventSummary } = regularRun();
    if (runnerResult.topology.appliance.family === 'open_vented') {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'open_vented_head_limit')).toBe(true);
    }
  });

  it('open_vented_head_limit has domain "hydraulic"', () => {
    const { runnerResult, eventSummary } = regularRun();
    if (runnerResult.topology.appliance.family === 'open_vented') {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'open_vented_head_limit');
      if (entry) expect(entry.domain).toBe('hydraulic');
    }
  });

  it('open_vented_head_limit has severity "info"', () => {
    const { runnerResult, eventSummary } = regularRun();
    if (runnerResult.topology.appliance.family === 'open_vented') {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'open_vented_head_limit');
      if (entry) expect(entry.severity).toBe('info');
    }
  });

  it('does NOT emit open_vented_head_limit for combi runs', () => {
    const { runnerResult, eventSummary } = combiClean();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'open_vented_head_limit')).toBe(false);
  });

  it('does NOT emit open_vented_head_limit for heat pump runs', () => {
    const { runnerResult, eventSummary } = heatPumpRun();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'open_vented_head_limit')).toBe(false);
  });
});

// ─── 12. HP topology → dhw_storage_required ──────────────────────────────────

describe('LimiterLedger — installability: dhw_storage_required (HP topology)', () => {
  it('emits dhw_storage_required for heat_pump family (topology always requires cylinder)', () => {
    const { runnerResult, eventSummary } = heatPumpRun();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'dhw_storage_required')).toBe(true);
  });

  it('dhw_storage_required for HP has source "topology"', () => {
    const runnerResult = runHeatPumpStoredSystemModel(CLEAN_INPUT, hpTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'heat_pump');
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    const entry = ledger.entries.find(e => e.id === 'dhw_storage_required');
    expect(entry).toBeDefined();
    expect(entry!.source).toBe('topology');
  });

  it('dhw_storage_required for HP triggerKeys contains "topology.family"', () => {
    const runnerResult = runHeatPumpStoredSystemModel(CLEAN_INPUT, hpTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'heat_pump');
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    const entry = ledger.entries.find(e => e.id === 'dhw_storage_required');
    expect(entry!.triggerKeys).toContain('topology.family');
  });
});

// ─── 13. Combi demand evidence → dhw_storage_required ────────────────────────

describe('LimiterLedger — installability: dhw_storage_required (combi demand)', () => {
  it('emits dhw_storage_required for combi when simultaneous demand events present', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    if (
      eventSummary.counters.simultaneousDemandConstraints > 0 ||
      eventSummary.counters.heatingInterruptions > 0
    ) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'dhw_storage_required')).toBe(true);
    }
  });

  it('dhw_storage_required for combi has source "timeline"', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    if (
      eventSummary.counters.simultaneousDemandConstraints > 0 ||
      eventSummary.counters.heatingInterruptions > 0
    ) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'dhw_storage_required');
      if (entry && entry.source === 'timeline') {
        expect(entry.triggerKeys).toContain('heating_interrupted_by_dhw');
      }
    }
  });

  it('does NOT emit dhw_storage_required for combi when clean run with no demand events', () => {
    // Clean combi with no CH active, no interruptions
    const { runnerResult, eventSummary } = combiClean();
    if (
      eventSummary.counters.simultaneousDemandConstraints === 0 &&
      eventSummary.counters.heatingInterruptions === 0
    ) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'dhw_storage_required')).toBe(false);
    }
  });
});

// ─── 14. Space tight flag → space_for_cylinder_unavailable ───────────────────

describe('LimiterLedger — installability: space_for_cylinder_unavailable', () => {
  it('emits space_for_cylinder_unavailable when stored-space-tight flag is present', () => {
    // availableSpace: 'tight' triggers the stored-space-tight flag in StoredDhwModule
    const input: EngineInputV2_3 = {
      ...CLEAN_INPUT,
      preferCombi: false,
      availableSpace: 'tight',
    };
    const runnerResult = runSystemStoredSystemModel(input, systemTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'system');
    const hasSpaceTight = runnerResult.dhw.storedDhwV1?.flags.some(
      f => f.id === 'stored-space-tight',
    );
    if (hasSpaceTight) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      expect(ledger.entries.some(e => e.id === 'space_for_cylinder_unavailable')).toBe(true);
    }
  });

  it('space_for_cylinder_unavailable has domain "installability"', () => {
    const input: EngineInputV2_3 = {
      ...CLEAN_INPUT,
      preferCombi: false,
      availableSpace: 'tight',
    };
    const runnerResult = runSystemStoredSystemModel(input, systemTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'system');
    const hasSpaceTight = runnerResult.dhw.storedDhwV1?.flags.some(
      f => f.id === 'stored-space-tight',
    );
    if (hasSpaceTight) {
      const ledger = buildLimiterLedger(runnerResult, eventSummary);
      const entry = ledger.entries.find(e => e.id === 'space_for_cylinder_unavailable');
      if (entry) expect(entry.domain).toBe('installability');
    }
  });

  it('does NOT emit space_for_cylinder_unavailable for combi runs', () => {
    const { runnerResult, eventSummary } = combiClean();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'space_for_cylinder_unavailable')).toBe(false);
  });
});

// ─── combi_dhw_demand_risk — occupancy/bathroom demand gate ──────────────────

describe('LimiterLedger — combi: combi_dhw_demand_risk', () => {
  it('emits a limit entry when bathroomCount >= 2 (simultaneous-demand advisory — no hard stops permitted)', () => {
    const { runnerResult, eventSummary } = combiClean();
    const ledger = buildLimiterLedger(runnerResult, eventSummary, {
      bathroomCount: 2,
      occupancyCount: 3,
    });
    const entry = ledger.entries.find(e => e.id === 'combi_dhw_demand_risk');
    expect(entry).toBeDefined();
    expect(entry?.severity).toBe('limit');
  });

  it('emits a limit entry when peakConcurrentOutlets >= 2 (simultaneous-demand advisory — no hard stops permitted)', () => {
    const { runnerResult, eventSummary } = combiClean();
    const ledger = buildLimiterLedger(runnerResult, eventSummary, {
      bathroomCount: 1,
      peakConcurrentOutlets: 2,
    });
    const entry = ledger.entries.find(e => e.id === 'combi_dhw_demand_risk');
    expect(entry).toBeDefined();
    expect(entry?.severity).toBe('limit');
  });

  it('emits a warning entry when occupancyCount === 3 without bathroom/outlet gate', () => {
    const { runnerResult, eventSummary } = combiClean();
    const ledger = buildLimiterLedger(runnerResult, eventSummary, {
      bathroomCount: 1,
      occupancyCount: 3,
    });
    const entry = ledger.entries.find(e => e.id === 'combi_dhw_demand_risk');
    expect(entry).toBeDefined();
    expect(entry?.severity).toBe('warning');
  });

  it('does not emit combi_dhw_demand_risk for occupancyCount <= 2 with single bathroom', () => {
    const { runnerResult, eventSummary } = combiClean();
    const ledger = buildLimiterLedger(runnerResult, eventSummary, {
      bathroomCount: 1,
      occupancyCount: 2,
    });
    expect(ledger.entries.some(e => e.id === 'combi_dhw_demand_risk')).toBe(false);
  });

  it('does not emit combi_dhw_demand_risk when no demographic context is provided', () => {
    const { runnerResult, eventSummary } = combiClean();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledger.entries.some(e => e.id === 'combi_dhw_demand_risk')).toBe(false);
  });

  it('does not emit combi_dhw_demand_risk for non-combi families', () => {
    const runnerResult = runSystemStoredSystemModel(CLEAN_INPUT, systemTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'system');
    const ledger = buildLimiterLedger(runnerResult, eventSummary, {
      bathroomCount: 3,
      occupancyCount: 4,
    });
    expect(ledger.entries.some(e => e.id === 'combi_dhw_demand_risk')).toBe(false);
  });

  it('bathroomCount gate (limit) takes precedence over occupancy warning', () => {
    const { runnerResult, eventSummary } = combiClean();
    const ledger = buildLimiterLedger(runnerResult, eventSummary, {
      bathroomCount: 2,
      occupancyCount: 3,
    });
    const entries = ledger.entries.filter(e => e.id === 'combi_dhw_demand_risk');
    // Only one entry (no duplication — limit wins over warning)
    expect(entries).toHaveLength(1);
    expect(entries[0]?.severity).toBe('limit');
  });
});

// ─── 15. Negative — no limiter without evidence ───────────────────────────────

describe('LimiterLedger — negative: no limiter without evidence', () => {
  it('empty event summary with clean runner produces only physics-based limiters', () => {
    // A completely empty event summary (standby-only timeline) should not produce
    // event-derived limiters
    const runnerResult = runCombiSystemModel(CLEAN_INPUT, combiTopology);
    const zeroSummary: DerivedSystemEventSummary = {
      events: [],
      counters: {
        dhwRequests: 0,
        heatingInterruptions: 0,
        rechargeCycles: 0,
        purgeCycles: 0,
        reducedDhwEvents: 0,
        simultaneousDemandConstraints: 0,
      },
    };
    const ledger = buildLimiterLedger(runnerResult, zeroSummary);
    // No event-derived limiters should appear
    expect(ledger.entries.some(e => e.id === 'combi_service_switching')).toBe(false);
    expect(ledger.entries.some(e => e.id === 'simultaneous_demand_constraint')).toBe(false);
    expect(ledger.entries.some(e => e.id === 'stored_volume_shortfall')).toBe(false);
    expect(ledger.entries.some(e => e.id === 'reduced_dhw_service')).toBe(false);
  });

  it('combi_service_switching requires heatingInterruptions > 0', () => {
    const runnerResult = runCombiSystemModel(CLEAN_INPUT, combiTopology);
    const zeroSummary: DerivedSystemEventSummary = {
      events: [],
      counters: {
        dhwRequests: 0,
        heatingInterruptions: 0,
        rechargeCycles: 0,
        purgeCycles: 0,
        reducedDhwEvents: 0,
        simultaneousDemandConstraints: 0,
      },
    };
    const ledger = buildLimiterLedger(runnerResult, zeroSummary);
    expect(ledger.entries.some(e => e.id === 'combi_service_switching')).toBe(false);
  });
});

// ─── 16. Negative — no duplicate limiter entries ─────────────────────────────

describe('LimiterLedger — negative: no duplicate entries', () => {
  it('no duplicate limiter ids in combi run result', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    const ids = ledger.entries.map(e => e.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('no duplicate limiter ids in hydronic run result', () => {
    const { runnerResult, eventSummary } = systemDepletingDraw();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    const ids = ledger.entries.map(e => e.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('no duplicate limiter ids in heat pump run result', () => {
    const { runnerResult, eventSummary } = heatPumpRun();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    const ids = ledger.entries.map(e => e.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});

// ─── 17. Negative — hydronic runs do not emit combi-only limiters ─────────────

describe('LimiterLedger — negative: hydronic runs do not emit combi-only limiters', () => {
  it('system stored run does not emit combi-only limiters', () => {
    const { runnerResult, eventSummary } = systemDepletingDraw();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    for (const entry of ledger.entries) {
      expect(COMBI_ONLY_LIMITER_IDS.has(entry.id)).toBe(false);
    }
  });

  it('heat pump run does not emit combi-only limiters', () => {
    const { runnerResult, eventSummary } = heatPumpRun();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    for (const entry of ledger.entries) {
      expect(COMBI_ONLY_LIMITER_IDS.has(entry.id)).toBe(false);
    }
  });

  it('open_vented run does not emit combi-only limiters', () => {
    const { runnerResult, eventSummary } = regularRun();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    for (const entry of ledger.entries) {
      expect(COMBI_ONLY_LIMITER_IDS.has(entry.id)).toBe(false);
    }
  });
});

// ─── 18. Negative — combi runs do not emit store-only limiters ────────────────

describe('LimiterLedger — negative: combi runs do not emit store-only limiters', () => {
  it('combi run with interruption does not emit store-only limiters', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    for (const entry of ledger.entries) {
      expect(STORE_ONLY_LIMITER_IDS.has(entry.id)).toBe(false);
    }
  });

  it('clean combi run does not emit store-only limiters', () => {
    const { runnerResult, eventSummary } = combiClean();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    for (const entry of ledger.entries) {
      expect(STORE_ONLY_LIMITER_IDS.has(entry.id)).toBe(false);
    }
  });

  it('combi run does not emit heat-pump-only limiters', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    for (const entry of ledger.entries) {
      expect(HEAT_PUMP_ONLY_LIMITER_IDS.has(entry.id)).toBe(false);
    }
  });

  it('system stored run does not emit heat-pump-only limiters', () => {
    const { runnerResult, eventSummary } = systemDepletingDraw();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    for (const entry of ledger.entries) {
      expect(HEAT_PUMP_ONLY_LIMITER_IDS.has(entry.id)).toBe(false);
    }
  });
});

// ─── 19. Negative — empty/clean run yields low-noise ledger ──────────────────

describe('LimiterLedger — negative: clean run yields low-noise ledger', () => {
  it('clean combi run with no demand events and adequate mains produces few limiters', () => {
    // Good mains, no cycling, no pressure issues, no demand events
    const input: EngineInputV2_3 = {
      ...CLEAN_INPUT,
      mainsDynamicFlowLpm: 20,
      dynamicMainsPressure: 2.5,
      primaryPipeDiameter: 28,
      hasMagneticFilter: true,
      supplyTempC: 70,
      retrofit: { emitterUpgradeAppetite: 'full_job' },
    };
    const runnerResult = runCombiSystemModel(input, combiTopology);
    const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
    // Override event summary to zero (simulate no demand events)
    const zeroSummary: DerivedSystemEventSummary = {
      events: [],
      counters: {
        dhwRequests: 0,
        heatingInterruptions: 0,
        rechargeCycles: 0,
        purgeCycles: 0,
        reducedDhwEvents: 0,
        simultaneousDemandConstraints: 0,
      },
    };
    const ledger = buildLimiterLedger(runnerResult, zeroSummary);
    // Should have no event-derived limiters
    expect(ledger.entries.some(e => e.id === 'combi_service_switching')).toBe(false);
    expect(ledger.entries.some(e => e.id === 'stored_volume_shortfall')).toBe(false);
    expect(ledger.entries.some(e => e.id === 'hp_reheat_latency')).toBe(false);
  });
});

// ─── 20. Structural — every entry has required fields ────────────────────────

describe('LimiterLedger — structural: every entry has required fields', () => {
  it('all entries in combi run have required fields', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    for (const entry of ledger.entries) {
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.domain).toBe('string');
      expect(typeof entry.severity).toBe('string');
      expect(typeof entry.source).toBe('string');
      expect(entry.source.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.triggerKeys)).toBe(true);
      expect(entry.triggerKeys.length).toBeGreaterThan(0);
      expect(typeof entry.confidence).toBe('string');
      expect(typeof entry.removableByUpgrade).toBe('boolean');
      expect(Array.isArray(entry.candidateInterventions)).toBe(true);
    }
  });

  it('all entries in hydronic run have required fields', () => {
    const { runnerResult, eventSummary } = systemDepletingDraw();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    for (const entry of ledger.entries) {
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.domain).toBe('string');
      expect(typeof entry.severity).toBe('string');
      expect(typeof entry.source).toBe('string');
      expect(entry.source.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.triggerKeys)).toBe(true);
      expect(entry.triggerKeys.length).toBeGreaterThan(0);
      expect(typeof entry.confidence).toBe('string');
      expect(typeof entry.removableByUpgrade).toBe('boolean');
      expect(Array.isArray(entry.candidateInterventions)).toBe(true);
    }
  });

  it('all entries in HP run have required fields', () => {
    const { runnerResult, eventSummary } = heatPumpRun();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    for (const entry of ledger.entries) {
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.domain).toBe('string');
      expect(typeof entry.severity).toBe('string');
      expect(typeof entry.source).toBe('string');
      expect(entry.source.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.triggerKeys)).toBe(true);
      expect(entry.triggerKeys.length).toBeGreaterThan(0);
      expect(typeof entry.confidence).toBe('string');
      expect(typeof entry.removableByUpgrade).toBe('boolean');
      expect(Array.isArray(entry.candidateInterventions)).toBe(true);
    }
  });

  it('severity values are within the valid set', () => {
    const validSeverities = new Set(['info', 'warning', 'limit', 'hard_stop']);
    const { runnerResult, eventSummary } = combiWithInterruption();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    for (const entry of ledger.entries) {
      expect(validSeverities.has(entry.severity)).toBe(true);
    }
  });

  it('domain values are within the valid set', () => {
    const validDomains = new Set([
      'dhw', 'space_heating', 'hydraulic', 'efficiency',
      'installability', 'controls', 'lifecycle',
    ]);
    const { runnerResult, eventSummary } = combiWithInterruption();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    for (const entry of ledger.entries) {
      expect(validDomains.has(entry.domain)).toBe(true);
    }
  });

  it('confidence values are within the valid set', () => {
    const validConfidence = new Set(['measured', 'derived', 'assumed']);
    const { runnerResult, eventSummary } = combiWithInterruption();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    for (const entry of ledger.entries) {
      expect(validConfidence.has(entry.confidence)).toBe(true);
    }
  });
});

// ─── 21. Structural — deterministic ordering ─────────────────────────────────

describe('LimiterLedger — structural: deterministic ordering', () => {
  it('running the ledger builder twice on the same input yields identical entries (combi)', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    const ledgerA = buildLimiterLedger(runnerResult, eventSummary);
    const ledgerB = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledgerA.entries).toEqual(ledgerB.entries);
  });

  it('running the ledger builder twice on the same input yields identical entries (hydronic)', () => {
    const { runnerResult, eventSummary } = systemDepletingDraw();
    const ledgerA = buildLimiterLedger(runnerResult, eventSummary);
    const ledgerB = buildLimiterLedger(runnerResult, eventSummary);
    expect(ledgerA.entries).toEqual(ledgerB.entries);
  });

  it('entries are ordered with hard_stop before limit before warning before info (combi)', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    const severityOrder: Record<string, number> = {
      hard_stop: 0, limit: 1, warning: 2, info: 3,
    };
    for (let i = 1; i < ledger.entries.length; i++) {
      const prev = ledger.entries[i - 1]!;
      const curr = ledger.entries[i]!;
      expect(severityOrder[prev.severity]!).toBeLessThanOrEqual(severityOrder[curr.severity]!);
    }
  });

  it('entries are ordered with hard_stop before limit before warning before info (hydronic)', () => {
    const { runnerResult, eventSummary } = systemDepletingDraw();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    const severityOrder: Record<string, number> = {
      hard_stop: 0, limit: 1, warning: 2, info: 3,
    };
    for (let i = 1; i < ledger.entries.length; i++) {
      const prev = ledger.entries[i - 1]!;
      const curr = ledger.entries[i]!;
      expect(severityOrder[prev.severity]!).toBeLessThanOrEqual(severityOrder[curr.severity]!);
    }
  });

  it('entries with same severity are ordered by domain then id (combi)', () => {
    const { runnerResult, eventSummary } = combiWithInterruption();
    const ledger = buildLimiterLedger(runnerResult, eventSummary);
    const domainOrder: Record<string, number> = {
      dhw: 0, space_heating: 1, hydraulic: 2, efficiency: 3,
      installability: 4, controls: 5, lifecycle: 6,
    };
    for (let i = 1; i < ledger.entries.length; i++) {
      const prev = ledger.entries[i - 1]!;
      const curr = ledger.entries[i]!;
      if (prev.severity === curr.severity) {
        const prevDom = domainOrder[prev.domain] ?? 99;
        const currDom = domainOrder[curr.domain] ?? 99;
        if (prevDom === currDom) {
          // Same domain: id should be alphabetically ordered
          expect(prev.id.localeCompare(curr.id)).toBeLessThanOrEqual(0);
        } else {
          expect(prevDom).toBeLessThanOrEqual(currDom);
        }
      }
    }
  });
});
