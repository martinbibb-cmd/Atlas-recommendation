/**
 * runners.test.ts — PR2: Tests for topology-aware family runners and runEngine delegation.
 *
 * Focus:
 *   1. Each runner produces a `FamilyRunnerResult` with the correct topology shape.
 *   2. Combi runner receives a topology with `drawOff` defined.
 *   3. Hydronic runners receive a topology with `drawOff === undefined`.
 *   4. `runEngine()` delegates to the correct family runner based on `currentHeatSourceType`.
 *   5. The legacy `FullEngineResult` output shape remains populated for all input families.
 *
 * No physics logic is exercised here — this is pure orchestration validation.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { runEngine } from '../Engine';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import {
  buildSystemTopologyFromSpec,
} from '../topology/SystemTopology';
import { runCombiSystemModel } from '../runners/runCombiSystemModel';
import { runSystemStoredSystemModel } from '../runners/runSystemStoredSystemModel';
import { runRegularStoredSystemModel } from '../runners/runRegularStoredSystemModel';
import { runHeatPumpStoredSystemModel } from '../runners/runHeatPumpStoredSystemModel';

import * as CombiRunnerModule from '../runners/runCombiSystemModel';
import * as SystemRunnerModule from '../runners/runSystemStoredSystemModel';
import * as RegularRunnerModule from '../runners/runRegularStoredSystemModel';
import * as HPRunnerModule from '../runners/runHeatPumpStoredSystemModel';
import * as StoredDhwModule from '../modules/StoredDhwModule';
import * as MixergyVolumetricsModule from '../modules/MixergyVolumetricsModule';
import * as MixergyLegacyModule from '../modules/MixergyLegacyModule';
import * as CombiDhwModule from '../modules/CombiDhwModule';
import * as CombiStressModule from '../modules/CombiStressModule';

// ─── Shared input stubs ───────────────────────────────────────────────────────

const baseInput: EngineInputV2_3 = {
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
};

const combiInput: EngineInputV2_3 = {
  ...baseInput,
  currentHeatSourceType: 'combi',
  occupancyCount: 2,
};

const systemInput: EngineInputV2_3 = {
  ...baseInput,
  currentHeatSourceType: 'system',
  preferCombi: false,
  occupancyCount: 2,
};

const regularInput: EngineInputV2_3 = {
  ...baseInput,
  currentHeatSourceType: 'regular',
  preferCombi: false,
  occupancyCount: 2,
};

const heatPumpInput: EngineInputV2_3 = {
  ...baseInput,
  currentHeatSourceType: 'ashp',
  preferCombi: false,
  occupancyCount: 2,
};

// ─── Topology helpers ─────────────────────────────────────────────────────────

const combiTopology   = buildSystemTopologyFromSpec({ systemType: 'combi' });
const systemTopology  = buildSystemTopologyFromSpec({ systemType: 'stored_water' });
const regularTopology = buildSystemTopologyFromSpec({ systemType: 'open_vented' });
const hpTopology      = buildSystemTopologyFromSpec({ systemType: 'heat_pump', hotWaterStorageLitres: 200 });

// ─── Runner direct contract tests ─────────────────────────────────────────────

describe('runCombiSystemModel', () => {
  it('stores the passed topology in the result', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.topology).toBe(combiTopology);
  });

  it('receives a topology with appliance.family === "combi"', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.topology.appliance.family).toBe('combi');
  });

  it('receives a topology with drawOff defined (combi direct draw-off)', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.topology.drawOff).toBeDefined();
    expect(result.topology.drawOff?.source).toBe('combi_direct');
  });

  it('owns combiDhwV1 — the field is populated in dhw', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.dhw.combiDhwV1).toBeDefined();
  });

  it('dhw.kind is "direct_combi" — canonical family discriminant', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.dhw.kind).toBe('direct_combi');
  });

  it('dhw.sourcePath is "combi_runner"', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.dhw.sourcePath).toBe('combi_runner');
  });

  it('owns combiStress — the field is populated in heating', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.heating.combiStress).toBeDefined();
  });

  it('does not own storedDhwV1 — the field is absent (hydronic runners own it)', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.dhw.storedDhwV1).toBeUndefined();
  });

  it('does not own mixergy — the field is absent', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.dhw.mixergy).toBeUndefined();
  });

  it('populates all common result groups', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.normalizer).toBeDefined();
    expect(result.hydraulic.safety).toBeDefined();
    expect(result.hydraulic.v1).toBeDefined();
    expect(result.hydraulic.sludgeVsScale).toBeDefined();
    expect(result.heating.lifestyle).toBeDefined();
    expect(result.efficiency.systemOptimization).toBeDefined();
    expect(result.lifecycle.metallurgyEdge).toBeDefined();
    expect(result.advisories.redFlags).toBeDefined();
    expect(Array.isArray(result.advisories.bomItems)).toBe(true);
  });
});

describe('runSystemStoredSystemModel', () => {
  it('stores the passed topology in the result', () => {
    const result = runSystemStoredSystemModel(systemInput, systemTopology);
    expect(result.topology).toBe(systemTopology);
  });

  it('receives a topology with appliance.family === "system"', () => {
    const result = runSystemStoredSystemModel(systemInput, systemTopology);
    expect(result.topology.appliance.family).toBe('system');
  });

  it('receives a topology with drawOff === undefined (hydronic — no direct draw-off)', () => {
    const result = runSystemStoredSystemModel(systemInput, systemTopology);
    expect(result.topology.drawOff).toBeUndefined();
  });

  it('owns storedDhwV1 — the field is populated in dhw', () => {
    const result = runSystemStoredSystemModel(systemInput, systemTopology);
    expect(result.dhw.storedDhwV1).toBeDefined();
  });

  it('dhw.kind is "stored" — canonical family discriminant', () => {
    const result = runSystemStoredSystemModel(systemInput, systemTopology);
    expect(result.dhw.kind).toBe('stored');
  });

  it('dhw.sourcePath is "system_runner"', () => {
    const result = runSystemStoredSystemModel(systemInput, systemTopology);
    expect(result.dhw.sourcePath).toBe('system_runner');
  });

  it('owns mixergy — the field is populated in dhw', () => {
    const result = runSystemStoredSystemModel(systemInput, systemTopology);
    expect(result.dhw.mixergy).toBeDefined();
  });

  it('does not own combiDhwV1 — the field is absent (combi runner owns it)', () => {
    const result = runSystemStoredSystemModel(systemInput, systemTopology);
    expect(result.dhw.combiDhwV1).toBeUndefined();
  });

  it('does not own combiStress — the field is absent', () => {
    const result = runSystemStoredSystemModel(systemInput, systemTopology);
    expect(result.heating.combiStress).toBeUndefined();
  });
});

describe('runRegularStoredSystemModel', () => {
  it('receives a topology with appliance.family === "open_vented"', () => {
    const result = runRegularStoredSystemModel(regularInput, regularTopology);
    expect(result.topology.appliance.family).toBe('open_vented');
  });

  it('receives a topology with drawOff === undefined (hydronic — no direct draw-off)', () => {
    const result = runRegularStoredSystemModel(regularInput, regularTopology);
    expect(result.topology.drawOff).toBeUndefined();
  });

  it('owns storedDhwV1 — the field is populated in dhw', () => {
    const result = runRegularStoredSystemModel(regularInput, regularTopology);
    expect(result.dhw.storedDhwV1).toBeDefined();
  });

  it('does not own combiDhwV1 — the field is absent', () => {
    const result = runRegularStoredSystemModel(regularInput, regularTopology);
    expect(result.dhw.combiDhwV1).toBeUndefined();
  });
});

describe('runHeatPumpStoredSystemModel', () => {
  it('receives a topology with appliance.family === "heat_pump"', () => {
    const result = runHeatPumpStoredSystemModel(heatPumpInput, hpTopology);
    expect(result.topology.appliance.family).toBe('heat_pump');
  });

  it('receives a topology with drawOff === undefined (hydronic — no direct draw-off)', () => {
    const result = runHeatPumpStoredSystemModel(heatPumpInput, hpTopology);
    expect(result.topology.drawOff).toBeUndefined();
  });

  it('owns storedDhwV1 — the field is populated in dhw', () => {
    const result = runHeatPumpStoredSystemModel(heatPumpInput, hpTopology);
    expect(result.dhw.storedDhwV1).toBeDefined();
  });

  it('does not own combiDhwV1 — the field is absent', () => {
    const result = runHeatPumpStoredSystemModel(heatPumpInput, hpTopology);
    expect(result.dhw.combiDhwV1).toBeUndefined();
  });
});

// ─── runEngine delegation tests ───────────────────────────────────────────────

describe('runEngine delegation — selects correct runner by currentHeatSourceType', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates combi inputs to runCombiSystemModel', () => {
    const spy = vi.spyOn(CombiRunnerModule, 'runCombiSystemModel');
    runEngine(combiInput);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('delegates system inputs to runSystemStoredSystemModel', () => {
    const spy = vi.spyOn(SystemRunnerModule, 'runSystemStoredSystemModel');
    runEngine(systemInput);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('delegates regular inputs to runRegularStoredSystemModel', () => {
    const spy = vi.spyOn(RegularRunnerModule, 'runRegularStoredSystemModel');
    runEngine(regularInput);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('delegates heat pump inputs to runHeatPumpStoredSystemModel', () => {
    const spy = vi.spyOn(HPRunnerModule, 'runHeatPumpStoredSystemModel');
    runEngine(heatPumpInput);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('does not call combi runner for system inputs', () => {
    const spy = vi.spyOn(CombiRunnerModule, 'runCombiSystemModel');
    runEngine(systemInput);
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not call hydronic runners for combi inputs', () => {
    const systemSpy = vi.spyOn(SystemRunnerModule, 'runSystemStoredSystemModel');
    const regularSpy = vi.spyOn(RegularRunnerModule, 'runRegularStoredSystemModel');
    const hpSpy = vi.spyOn(HPRunnerModule, 'runHeatPumpStoredSystemModel');
    runEngine(combiInput);
    expect(systemSpy).not.toHaveBeenCalled();
    expect(regularSpy).not.toHaveBeenCalled();
    expect(hpSpy).not.toHaveBeenCalled();
  });
});

// ─── Topology contract tests in runEngine ────────────────────────────────────

describe('runEngine topology contract — topology passed to runner matches PR1 rules', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('combi runner receives a topology with drawOff defined', () => {
    const spy = vi.spyOn(CombiRunnerModule, 'runCombiSystemModel');
    runEngine(combiInput);
    const passedTopology = spy.mock.calls[0]?.[1];
    expect(passedTopology?.drawOff).toBeDefined();
    expect(passedTopology?.drawOff?.source).toBe('combi_direct');
  });

  it('system runner receives a topology with drawOff === undefined', () => {
    const spy = vi.spyOn(SystemRunnerModule, 'runSystemStoredSystemModel');
    runEngine(systemInput);
    const passedTopology = spy.mock.calls[0]?.[1];
    expect(passedTopology?.drawOff).toBeUndefined();
  });

  it('regular runner receives a topology with drawOff === undefined', () => {
    const spy = vi.spyOn(RegularRunnerModule, 'runRegularStoredSystemModel');
    runEngine(regularInput);
    const passedTopology = spy.mock.calls[0]?.[1];
    expect(passedTopology?.drawOff).toBeUndefined();
  });

  it('heat pump runner receives a topology with drawOff === undefined', () => {
    const spy = vi.spyOn(HPRunnerModule, 'runHeatPumpStoredSystemModel');
    runEngine(heatPumpInput);
    const passedTopology = spy.mock.calls[0]?.[1];
    expect(passedTopology?.drawOff).toBeUndefined();
  });

  it('combi runner receives a topology with appliance.directDrawOffService === true', () => {
    const spy = vi.spyOn(CombiRunnerModule, 'runCombiSystemModel');
    runEngine(combiInput);
    const passedTopology = spy.mock.calls[0]?.[1];
    expect(passedTopology?.appliance.directDrawOffService).toBe(true);
  });

  it('system runner receives a topology with appliance.directDrawOffService === false', () => {
    const spy = vi.spyOn(SystemRunnerModule, 'runSystemStoredSystemModel');
    runEngine(systemInput);
    const passedTopology = spy.mock.calls[0]?.[1];
    expect(passedTopology?.appliance.directDrawOffService).toBe(false);
  });
});

// ─── Legacy output shape stability ───────────────────────────────────────────

describe('runEngine — PR3: family-gated DHW output shape', () => {
  it('combi input: combi-family DHW fields are populated', () => {
    const result = runEngine(combiInput);
    expect(result.hydraulic).toBeDefined();
    expect(result.hydraulicV1).toBeDefined();
    expect(result.combiDhwV1).toBeDefined();
    expect(result.combiStress).toBeDefined();
    expect(result.lifestyle).toBeDefined();
    expect(result.normalizer).toBeDefined();
    expect(result.redFlags).toBeDefined();
    expect(Array.isArray(result.bomItems)).toBe(true);
    expect(result.legacyInfrastructure).toBeDefined();
    expect(result.sludgeVsScale).toBeDefined();
    expect(result.systemOptimization).toBeDefined();
    expect(result.metallurgyEdge).toBeDefined();
    expect(result.specEdge).toBeDefined();
    expect(result.heatPumpRegime).toBeDefined();
    expect(result.pressureAnalysis).toBeDefined();
    expect(result.cwsSupplyV1).toBeDefined();
    expect(result.condensingState).toBeDefined();
    expect(result.condensingRuntime).toBeDefined();
    expect(result.engineOutput).toBeDefined();
    expect(result.inputValidation).toBeDefined();
  });

  it('combi input: stored-family DHW fields are absent (forbidden cross-family fields)', () => {
    const result = runEngine(combiInput);
    expect(result.storedDhwV1).toBeUndefined();
    expect(result.mixergy).toBeUndefined();
    expect(result.mixergyLegacy).toBeUndefined();
  });

  it('system input: stored-family DHW fields are populated', () => {
    const result = runEngine(systemInput);
    expect(result.hydraulic).toBeDefined();
    expect(result.storedDhwV1).toBeDefined();
    expect(result.mixergy).toBeDefined();
    expect(result.mixergyLegacy).toBeDefined();
    expect(result.lifestyle).toBeDefined();
    expect(result.engineOutput).toBeDefined();
  });

  it('system input: combi-family DHW fields are absent (forbidden cross-family fields)', () => {
    const result = runEngine(systemInput);
    expect(result.combiDhwV1).toBeUndefined();
    expect(result.combiStress).toBeUndefined();
  });

  it('regular input: stored-family DHW fields are populated', () => {
    const result = runEngine(regularInput);
    expect(result.hydraulic).toBeDefined();
    expect(result.storedDhwV1).toBeDefined();
    expect(result.mixergy).toBeDefined();
    expect(result.mixergyLegacy).toBeDefined();
    expect(result.lifestyle).toBeDefined();
    expect(result.engineOutput).toBeDefined();
  });

  it('regular input: combi-family DHW fields are absent (forbidden cross-family fields)', () => {
    const result = runEngine(regularInput);
    expect(result.combiDhwV1).toBeUndefined();
    expect(result.combiStress).toBeUndefined();
  });

  it('heat pump input: stored-family DHW fields are populated', () => {
    const result = runEngine(heatPumpInput);
    expect(result.hydraulic).toBeDefined();
    expect(result.storedDhwV1).toBeDefined();
    expect(result.mixergy).toBeDefined();
    expect(result.mixergyLegacy).toBeDefined();
    expect(result.lifestyle).toBeDefined();
    expect(result.engineOutput).toBeDefined();
  });

  it('heat pump input: combi-family DHW fields are absent (forbidden cross-family fields)', () => {
    const result = runEngine(heatPumpInput);
    expect(result.combiDhwV1).toBeUndefined();
    expect(result.combiStress).toBeUndefined();
  });

  it('input without currentHeatSourceType defaults to stored_water path', () => {
    const inputNoType: EngineInputV2_3 = { ...baseInput };
    const result = runEngine(inputNoType);
    expect(result.hydraulic).toBeDefined();
    expect(result.storedDhwV1).toBeDefined();
    expect(result.engineOutput).toBeDefined();
    // combi fields must be absent for stored_water default
    expect(result.combiDhwV1).toBeUndefined();
    expect(result.combiStress).toBeUndefined();
  });
});

// ─── PR3: runEngine cross-family fallback gate tests ─────────────────────────

describe('runEngine — PR3: cross-family DHW fallback is suppressed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('combi run: runStoredDhwModuleV1 is never called', () => {
    const spy = vi.spyOn(StoredDhwModule, 'runStoredDhwModuleV1');
    runEngine(combiInput);
    expect(spy).not.toHaveBeenCalled();
  });

  it('combi run: runMixergyVolumetricsModule is never called', () => {
    const spy = vi.spyOn(MixergyVolumetricsModule, 'runMixergyVolumetricsModule');
    runEngine(combiInput);
    expect(spy).not.toHaveBeenCalled();
  });

  it('combi run: runMixergyLegacyModule is never called', () => {
    const spy = vi.spyOn(MixergyLegacyModule, 'runMixergyLegacyModule');
    runEngine(combiInput);
    expect(spy).not.toHaveBeenCalled();
  });

  it('system run: runCombiDhwModuleV1 is never called', () => {
    const spy = vi.spyOn(CombiDhwModule, 'runCombiDhwModuleV1');
    runEngine(systemInput);
    expect(spy).not.toHaveBeenCalled();
  });

  it('system run: runCombiStressModule is never called', () => {
    const spy = vi.spyOn(CombiStressModule, 'runCombiStressModule');
    runEngine(systemInput);
    expect(spy).not.toHaveBeenCalled();
  });
});
