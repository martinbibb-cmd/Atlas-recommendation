/**
 * CombiDhwPhaseModel.test.ts — PR5: Tests for combi service-switching and
 * direct-DHW phase model.
 *
 * Test categories:
 *   1. Phase timeline — correct phases emitted in correct order
 *   2. CH interruption — CH interrupted when active; not when absent
 *   3. Ignition / stabilisation — warmup before steady-state delivery
 *   4. Short-draw penalty — draws < 15 s are penalised more than longer draws
 *   5. Purge / overrun — purge phase is always present (combi-only behaviour)
 *   6. Direct delivery invariant — usedStoredDhwPath is always false
 *   7. Runner integration — combi runner populates combiDhwPhase; hydronic runners do not
 *   8. Negative tests — combi runner never emits stored-water semantics;
 *      hydronic runners never emit combi purge/overrun semantics
 *   9. Adapter — adaptEngineInputToCombiPhase correctly translates engine inputs
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  runCombiDhwPhaseModel,
  adaptEngineInputToCombiPhase,
} from '../modules/CombiDhwPhaseModel';
import type { CombiDhwPhaseInput } from '../modules/CombiDhwPhaseModel';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import { runCombiSystemModel } from '../runners/runCombiSystemModel';
import { runSystemStoredSystemModel } from '../runners/runSystemStoredSystemModel';
import { runRegularStoredSystemModel } from '../runners/runRegularStoredSystemModel';
import { runHeatPumpStoredSystemModel } from '../runners/runHeatPumpStoredSystemModel';
import { buildSystemTopologyFromSpec } from '../topology/SystemTopology';

// ─── Shared test fixtures ─────────────────────────────────────────────────────

/** Standard combi shower draw: 9 L/min × 6 min = 54 L — reaches steady state. */
const showerDrawInput: CombiDhwPhaseInput = {
  drawVolumeLitres: 54,
  drawFlowLpm: 9,
  tapTargetTempC: 40,
  coldWaterTempC: 10,
  simultaneousChActive: true,
};

/** Short draw (hand-wash): 9 L/min × 6.67 s ≈ 1 L — well below 10 s steady-state threshold. */
const shortDrawInput: CombiDhwPhaseInput = {
  drawVolumeLitres: 1.0,
  drawFlowLpm: 9,
  tapTargetTempC: 40,
  coldWaterTempC: 10,
  simultaneousChActive: false,
};

/** Minimal draw: 9 L/min × 1 min = 9 L — above short-draw threshold (15 s). */
const minimalDrawInput: CombiDhwPhaseInput = {
  drawVolumeLitres: 9,
  drawFlowLpm: 9,
  tapTargetTempC: 40,
  coldWaterTempC: 10,
  simultaneousChActive: false,
};

/** Draw that just reaches steady state: exactly 10 s draw = 9 × (10/60) = 1.5 L. */
const steadyStateEdgeInput: CombiDhwPhaseInput = {
  drawVolumeLitres: 1.5,   // 9 L/min × (10/60) min = 9 × (10/60) = 1.5 L, exactly 10 s
  drawFlowLpm: 9,
  tapTargetTempC: 40,
  coldWaterTempC: 10,
  simultaneousChActive: false,
};

/** Base engine input shared across runner integration tests. */
const baseEngineInput: EngineInputV2_3 = {
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
  preferCombi: false,
  occupancyCount: 2,
};

// ─── Topology stubs ───────────────────────────────────────────────────────────

const combiTopology   = buildSystemTopologyFromSpec({ systemType: 'combi' });
const systemTopology  = buildSystemTopologyFromSpec({ systemType: 'stored_water' });
const regularTopology = buildSystemTopologyFromSpec({ systemType: 'open_vented' });
const hpTopology      = buildSystemTopologyFromSpec({ systemType: 'heat_pump', hotWaterStorageLitres: 250 });

// ─── 1. Phase timeline ────────────────────────────────────────────────────────

describe('CombiDhwPhaseModel — phase timeline', () => {
  it('first event is dhw_request', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    expect(result.phaseTimeline[0].phase).toBe('dhw_request');
  });

  it('dhw_request starts at t=0', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    expect(result.phaseTimeline[0].startS).toBe(0);
  });

  it('ignition_active phase is present', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    expect(result.phaseTimeline.some(e => e.phase === 'ignition_active')).toBe(true);
  });

  it('ignition_active starts at t=0', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    const ignition = result.phaseTimeline.find(e => e.phase === 'ignition_active');
    expect(ignition?.startS).toBe(0);
  });

  it('delivery_active phase is present for a shower draw', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    expect(result.phaseTimeline.some(e => e.phase === 'delivery_active')).toBe(true);
  });

  it('delivery_active starts at 10 s (after steady-state is reached)', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    const delivery = result.phaseTimeline.find(e => e.phase === 'delivery_active');
    expect(delivery?.startS).toBe(10);
  });

  it('purge_active phase is always present', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    expect(result.phaseTimeline.some(e => e.phase === 'purge_active')).toBe(true);
  });

  it('return_to_ch_pending phase is always present', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    expect(result.phaseTimeline.some(e => e.phase === 'return_to_ch_pending')).toBe(true);
  });

  it('return_to_ch_pending starts after purge ends', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    const purge = result.phaseTimeline.find(e => e.phase === 'purge_active')!;
    const returnToCh = result.phaseTimeline.find(e => e.phase === 'return_to_ch_pending')!;
    expect(returnToCh.startS).toBeCloseTo(purge.startS + purge.durationS, 6);
  });

  it('phases appear in logical order: dhw_request → ignition_active → delivery_active → purge_active → return_to_ch_pending', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    const phases = result.phaseTimeline.map(e => e.phase);
    const requestIdx  = phases.indexOf('dhw_request');
    const ignitionIdx = phases.indexOf('ignition_active');
    const deliveryIdx = phases.indexOf('delivery_active');
    const purgeIdx    = phases.indexOf('purge_active');
    const returnIdx   = phases.indexOf('return_to_ch_pending');

    expect(requestIdx).toBeLessThan(ignitionIdx);
    expect(ignitionIdx).toBeLessThan(deliveryIdx);
    expect(deliveryIdx).toBeLessThan(purgeIdx);
    expect(purgeIdx).toBeLessThan(returnIdx);
  });

  it('delivery_active is absent for a short draw that never reaches steady state', () => {
    const result = runCombiDhwPhaseModel(shortDrawInput);
    expect(result.phaseTimeline.some(e => e.phase === 'delivery_active')).toBe(false);
  });
});

// ─── 2. CH interruption ───────────────────────────────────────────────────────

describe('CombiDhwPhaseModel — CH interruption on DHW demand', () => {
  it('tap-open interrupts CH when simultaneousChActive is true', () => {
    const result = runCombiDhwPhaseModel({ ...showerDrawInput, simultaneousChActive: true });
    expect(result.drawOffResult.chInterruptionOccurred).toBe(true);
  });

  it('ch_interrupted phase is present in timeline when CH was active', () => {
    const result = runCombiDhwPhaseModel({ ...showerDrawInput, simultaneousChActive: true });
    expect(result.phaseTimeline.some(e => e.phase === 'ch_interrupted')).toBe(true);
  });

  it('ch_interrupted phase is absent when CH was not active', () => {
    const result = runCombiDhwPhaseModel({ ...showerDrawInput, simultaneousChActive: false });
    expect(result.phaseTimeline.some(e => e.phase === 'ch_interrupted')).toBe(false);
  });

  it('chInterruptionOccurred is false when CH was not active', () => {
    const result = runCombiDhwPhaseModel({ ...showerDrawInput, simultaneousChActive: false });
    expect(result.drawOffResult.chInterruptionOccurred).toBe(false);
  });

  it('ch_interrupted appears before ignition_active', () => {
    const result = runCombiDhwPhaseModel({ ...showerDrawInput, simultaneousChActive: true });
    const phases = result.phaseTimeline.map(e => e.phase);
    const chIdx       = phases.indexOf('ch_interrupted');
    const ignitionIdx = phases.indexOf('ignition_active');
    expect(chIdx).toBeLessThan(ignitionIdx);
  });
});

// ─── 3. Ignition / stabilisation ─────────────────────────────────────────────

describe('CombiDhwPhaseModel — ignition/stabilisation before steady delivery', () => {
  it('warmupSeconds is 10 s for a draw that reaches steady state', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    expect(result.drawOffResult.warmupSeconds).toBe(10);
  });

  it('steadyStateReached is true for a long shower draw (> 10 s)', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    expect(result.drawOffResult.steadyStateReached).toBe(true);
  });

  it('steadyStateReached is false for a draw shorter than 10 s', () => {
    const result = runCombiDhwPhaseModel(shortDrawInput);
    expect(result.drawOffResult.steadyStateReached).toBe(false);
  });

  it('warmupSeconds equals draw duration for a draw shorter than 10 s', () => {
    const drawDurationS = (shortDrawInput.drawVolumeLitres / shortDrawInput.drawFlowLpm) * 60;
    const result = runCombiDhwPhaseModel(shortDrawInput);
    expect(result.drawOffResult.warmupSeconds).toBeCloseTo(drawDurationS, 5);
  });

  it('deliveredTempC equals tapTargetTempC when steady state reached', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    expect(result.drawOffResult.deliveredTempC).toBe(40);
  });

  it('deliveredTempC is below tapTargetTempC for a short draw (warmup average)', () => {
    const result = runCombiDhwPhaseModel(shortDrawInput);
    expect(result.drawOffResult.deliveredTempC).toBeLessThan(40);
  });

  it('deliveredTempC for a short draw approximates (cold + target) / 2 = 25 °C', () => {
    const result = runCombiDhwPhaseModel(shortDrawInput);
    expect(result.drawOffResult.deliveredTempC).toBeCloseTo(25, 0);
  });

  it('ignition_active duration equals 10 s for a shower draw', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    const ignition = result.phaseTimeline.find(e => e.phase === 'ignition_active')!;
    expect(ignition.durationS).toBe(10);
  });
});

// ─── 4. Short-draw penalty ────────────────────────────────────────────────────

describe('CombiDhwPhaseModel — short draws incur more penalty than longer draws', () => {
  it('shortDrawPenaltyApplied is true for a very short draw (< 15 s)', () => {
    const result = runCombiDhwPhaseModel(shortDrawInput);
    expect(result.shortDrawPenaltyApplied).toBe(true);
  });

  it('shortDrawPenaltyApplied is false for a full shower draw (> 15 s)', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    expect(result.shortDrawPenaltyApplied).toBe(false);
  });

  it('effectiveEfficiencyPct is lower for a short draw than a long draw', () => {
    const shortResult = runCombiDhwPhaseModel(shortDrawInput);
    const longResult  = runCombiDhwPhaseModel(showerDrawInput);
    expect(shortResult.effectiveEfficiencyPct).toBeLessThan(longResult.effectiveEfficiencyPct);
  });

  it('short-draw efficiency is ~28 % (well below nominal)', () => {
    const result = runCombiDhwPhaseModel(shortDrawInput);
    expect(result.effectiveEfficiencyPct).toBe(28);
  });

  it('full-draw efficiency is ~92 % (nominal steady-state condensing)', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    expect(result.effectiveEfficiencyPct).toBe(92);
  });

  it('a minimal draw (9 L = ~60 s draw) is not a short draw', () => {
    // 9 L ÷ 9 L/min = 60 s — well above SHORT_DRAW_THRESHOLD_S (15 s)
    const result = runCombiDhwPhaseModel(minimalDrawInput);
    expect(result.shortDrawPenaltyApplied).toBe(false);
  });
});

// ─── 5. Purge / fan overrun ───────────────────────────────────────────────────

describe('CombiDhwPhaseModel — purge/overrun after DHW delivery', () => {
  it('purgeSeconds is > 0 after every combi DHW draw', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    expect(result.drawOffResult.purgeSeconds).toBeGreaterThan(0);
  });

  it('purge_active phase duration equals purgeSeconds in drawOffResult', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    const purge = result.phaseTimeline.find(e => e.phase === 'purge_active')!;
    expect(purge.durationS).toBe(result.drawOffResult.purgeSeconds);
  });

  it('purge_active starts when the draw ends (at drawDuration seconds)', () => {
    const drawDurationS = (showerDrawInput.drawVolumeLitres / showerDrawInput.drawFlowLpm) * 60;
    const result = runCombiDhwPhaseModel(showerDrawInput);
    const purge = result.phaseTimeline.find(e => e.phase === 'purge_active')!;
    expect(purge.startS).toBeCloseTo(drawDurationS, 5);
  });

  it('purge/overrun is also present for a short draw', () => {
    const result = runCombiDhwPhaseModel(shortDrawInput);
    expect(result.phaseTimeline.some(e => e.phase === 'purge_active')).toBe(true);
  });
});

// ─── 6. Direct delivery invariant ────────────────────────────────────────────

describe('CombiDhwPhaseModel — usedStoredDhwPath invariant', () => {
  it('usedStoredDhwPath is false for a standard combi shower draw', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    expect(result.usedStoredDhwPath).toBe(false);
  });

  it('usedStoredDhwPath is false for a short draw', () => {
    const result = runCombiDhwPhaseModel(shortDrawInput);
    expect(result.usedStoredDhwPath).toBe(false);
  });

  it('usedStoredDhwPath is false regardless of simultaneousChActive', () => {
    const withCh    = runCombiDhwPhaseModel({ ...showerDrawInput, simultaneousChActive: true });
    const withoutCh = runCombiDhwPhaseModel({ ...showerDrawInput, simultaneousChActive: false });
    expect(withCh.usedStoredDhwPath).toBe(false);
    expect(withoutCh.usedStoredDhwPath).toBe(false);
  });

  it('usedStoredDhwPath is false for the steady-state edge draw', () => {
    const result = runCombiDhwPhaseModel(steadyStateEdgeInput);
    expect(result.usedStoredDhwPath).toBe(false);
  });

  it('deliveredVolumeLitres equals the requested drawVolumeLitres (direct delivery, not store-clamped)', () => {
    const result = runCombiDhwPhaseModel(showerDrawInput);
    expect(result.drawOffResult.deliveredVolumeLitres).toBe(showerDrawInput.drawVolumeLitres);
  });
});

// ─── 7. Runner integration ────────────────────────────────────────────────────

describe('Runner integration — combi runner populates combiDhwPhase', () => {
  const combiInput: EngineInputV2_3 = {
    ...baseEngineInput,
    currentHeatSourceType: 'combi',
    preferCombi: true,
  };

  it('combi runner dhw.combiDhwPhase is defined', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.dhw.combiDhwPhase).toBeDefined();
  });

  it('combi runner combiDhwPhase.usedStoredDhwPath is false', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.dhw.combiDhwPhase?.usedStoredDhwPath).toBe(false);
  });

  it('combi runner combiDhwPhase contains a purge_active phase', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    const hasPurge = result.dhw.combiDhwPhase?.phaseTimeline.some(e => e.phase === 'purge_active');
    expect(hasPurge).toBe(true);
  });

  it('combi runner combiDhwPhase contains an ignition_active phase', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    const hasIgnition = result.dhw.combiDhwPhase?.phaseTimeline.some(e => e.phase === 'ignition_active');
    expect(hasIgnition).toBe(true);
  });

  it('system runner dhw.combiDhwPhase is absent (hydronic runner)', () => {
    const systemInput: EngineInputV2_3 = { ...baseEngineInput, currentHeatSourceType: 'stored_water' };
    const result = runSystemStoredSystemModel(systemInput, systemTopology);
    expect(result.dhw.combiDhwPhase).toBeUndefined();
  });

  it('regular runner dhw.combiDhwPhase is absent (hydronic runner)', () => {
    const regularInput: EngineInputV2_3 = { ...baseEngineInput, currentHeatSourceType: 'open_vented' };
    const result = runRegularStoredSystemModel(regularInput, regularTopology);
    expect(result.dhw.combiDhwPhase).toBeUndefined();
  });

  it('heat pump runner dhw.combiDhwPhase is absent (hydronic runner)', () => {
    const hpInput: EngineInputV2_3 = {
      ...baseEngineInput,
      currentHeatSourceType: 'heat_pump',
      dhwStorageLitres: 250,
    };
    const result = runHeatPumpStoredSystemModel(hpInput, hpTopology);
    expect(result.dhw.combiDhwPhase).toBeUndefined();
  });
});

// ─── 8. Negative tests ────────────────────────────────────────────────────────

describe('Negative test — combi runner never emits stored-water semantics', () => {
  const combiInput: EngineInputV2_3 = {
    ...baseEngineInput,
    currentHeatSourceType: 'combi',
    preferCombi: true,
  };

  it('combi runner dhw.storedDhwPhase is absent', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.dhw.storedDhwPhase).toBeUndefined();
  });

  it('combi runner dhw.storedDhwV1 is absent', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.dhw.storedDhwV1).toBeUndefined();
  });

  it('combi runner dhw.mixergy is absent', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.dhw.mixergy).toBeUndefined();
  });

  it('combi runner dhw.mixergyLegacy is absent', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.dhw.mixergyLegacy).toBeUndefined();
  });
});

describe('Negative test — hydronic runners never emit combi purge/overrun semantics', () => {
  it('system runner dhw.combiDhwPhase is absent (no purge_active phase on stored path)', () => {
    const systemInput: EngineInputV2_3 = { ...baseEngineInput, currentHeatSourceType: 'stored_water' };
    const result = runSystemStoredSystemModel(systemInput, systemTopology);
    expect(result.dhw.combiDhwPhase).toBeUndefined();
  });

  it('regular runner dhw.combiDhwPhase is absent (no purge_active phase on stored path)', () => {
    const regularInput: EngineInputV2_3 = { ...baseEngineInput, currentHeatSourceType: 'open_vented' };
    const result = runRegularStoredSystemModel(regularInput, regularTopology);
    expect(result.dhw.combiDhwPhase).toBeUndefined();
  });

  it('heat pump runner dhw.combiDhwPhase is absent (no purge_active phase on stored path)', () => {
    const hpInput: EngineInputV2_3 = {
      ...baseEngineInput,
      currentHeatSourceType: 'heat_pump',
      dhwStorageLitres: 250,
    };
    const result = runHeatPumpStoredSystemModel(hpInput, hpTopology);
    expect(result.dhw.combiDhwPhase).toBeUndefined();
  });
});

describe('Negative test — CombiDhwPhaseModel never calls StoredDhwPhaseModel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('combi runner does not call runStoredDhwPhaseModel', async () => {
    const phaseModule = await import('../modules/StoredDhwPhaseModel');
    const spy = vi.spyOn(phaseModule, 'runStoredDhwPhaseModel');
    const combiInput: EngineInputV2_3 = {
      ...baseEngineInput,
      currentHeatSourceType: 'combi',
      preferCombi: true,
    };
    runCombiSystemModel(combiInput, combiTopology);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ─── 9. Adapter ───────────────────────────────────────────────────────────────

describe('adaptEngineInputToCombiPhase — adapts EngineInputV2_3 correctly', () => {
  it('returns a valid CombiDhwPhaseInput', () => {
    const adapted = adaptEngineInputToCombiPhase(baseEngineInput);
    expect(adapted.drawFlowLpm).toBeGreaterThan(0);
    expect(adapted.drawVolumeLitres).toBeGreaterThan(0);
  });

  it('drawFlowLpm is 9 (standard UK combi shower flow rate)', () => {
    const adapted = adaptEngineInputToCombiPhase(baseEngineInput);
    expect(adapted.drawFlowLpm).toBe(9);
  });

  it('uses tapTargetTempC from input when provided', () => {
    const adapted = adaptEngineInputToCombiPhase({ ...baseEngineInput, tapTargetTempC: 42 });
    expect(adapted.tapTargetTempC).toBe(42);
  });

  it('defaults tapTargetTempC to 40 when not provided', () => {
    const adapted = adaptEngineInputToCombiPhase(baseEngineInput);
    expect(adapted.tapTargetTempC).toBe(40);
  });

  it('uses coldWaterTempC from input when provided', () => {
    const adapted = adaptEngineInputToCombiPhase({ ...baseEngineInput, coldWaterTempC: 8 });
    expect(adapted.coldWaterTempC).toBe(8);
  });

  it('defaults coldWaterTempC to 10 when not provided', () => {
    const adapted = adaptEngineInputToCombiPhase(baseEngineInput);
    expect(adapted.coldWaterTempC).toBe(10);
  });

  it('simultaneousChActive is true when heatLossWatts > 0', () => {
    const adapted = adaptEngineInputToCombiPhase({ ...baseEngineInput, heatLossWatts: 8000 });
    expect(adapted.simultaneousChActive).toBe(true);
  });

  it('draw volume scales with occupancyCount', () => {
    const oneOccupant = adaptEngineInputToCombiPhase({ ...baseEngineInput, occupancyCount: 1 });
    const twoOccupants = adaptEngineInputToCombiPhase({ ...baseEngineInput, occupancyCount: 2 });
    expect(twoOccupants.drawVolumeLitres).toBeGreaterThan(oneOccupant.drawVolumeLitres);
  });

  it('runCombiDhwPhaseModel succeeds with adapter output', () => {
    const adapted = adaptEngineInputToCombiPhase(baseEngineInput);
    expect(() => runCombiDhwPhaseModel(adapted)).not.toThrow();
  });
});
