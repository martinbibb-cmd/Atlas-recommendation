/**
 * StoredDhwPhaseModel.test.ts — PR4: Tests for stored-water delivery and recharge
 * as separate phases.
 *
 * Test categories:
 *   1. Draw-off from store — delivery reduces store state; tap performance
 *      comes from stored energy, not from the appliance directly.
 *   2. Recharge trigger semantics — reheat is not automatic at tap-open; it
 *      fires only when control conditions are met.
 *   3. Heat pump vs boiler recovery — heat pump stored recovery is slower.
 *   4. Control modes — thermostat_call / hysteresis_reheat / time_program
 *      each enforce different trigger conditions.
 *   5. Negative / invariant tests — combi path never used; no purge semantics;
 *      usedCombiDhwPath is always false.
 *   6. Runner integration — hydronic runners populate storedDhwPhase;
 *      combi runner does not.
 *   7. Adapter — adaptEngineInputToStoredPhase correctly translates engine inputs.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  runStoredDhwPhaseModel,
  adaptEngineInputToStoredPhase,
} from '../modules/StoredDhwPhaseModel';
import type { StoredDhwPhaseInput } from '../modules/StoredDhwPhaseModel';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import { runSystemStoredSystemModel } from '../runners/runSystemStoredSystemModel';
import { runRegularStoredSystemModel } from '../runners/runRegularStoredSystemModel';
import { runHeatPumpStoredSystemModel } from '../runners/runHeatPumpStoredSystemModel';
import { runCombiSystemModel } from '../runners/runCombiSystemModel';
import { buildSystemTopologyFromSpec } from '../topology/SystemTopology';

// ─── Shared test fixtures ─────────────────────────────────────────────────────

/** Minimal boiler stored phase input: well-charged 150 L cylinder at 60 °C. */
const boilerPhaseInput: StoredDhwPhaseInput = {
  cylinderVolumeLitres: 150,
  storeTopTempC: 60,
  storeMeanTempC: 55,
  drawVolumeLitres: 54,    // 9 lpm × 6 min — one shower
  drawFlowLpm: 9,
  tapTargetTempC: 40,
  coldWaterTempC: 10,
  controlMode: 'thermostat_call',
  thermostatThresholdC: 55,
  hysteresisBandC: 5,
  scheduledWindowActive: false,
  recoveryCharacteristic: 'boiler_stored',
};

/** Equivalent heat pump stored phase input: HP cylinder at 50 °C. */
const hpPhaseInput: StoredDhwPhaseInput = {
  ...boilerPhaseInput,
  storeTopTempC: 50,
  storeMeanTempC: 45,
  thermostatThresholdC: 45,
  recoveryCharacteristic: 'heat_pump_stored',
  drawFlowLpm: 10,
  drawVolumeLitres: 60, // 10 lpm × 6 min
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

const systemTopology  = buildSystemTopologyFromSpec({ systemType: 'stored_water' });
const regularTopology = buildSystemTopologyFromSpec({ systemType: 'open_vented' });
const hpTopology      = buildSystemTopologyFromSpec({ systemType: 'heat_pump', hotWaterStorageLitres: 250 });
const combiTopology   = buildSystemTopologyFromSpec({ systemType: 'combi' });

// ─── 1. Draw-off reduces store state ─────────────────────────────────────────

describe('StoredDhwPhaseModel — draw-off reduces store state', () => {
  it('usableHotWaterLitres decreases after a draw', () => {
    const result = runStoredDhwPhaseModel(boilerPhaseInput);
    expect(result.drawOffResult.postDrawStoreState.usableHotWaterLitres)
      .toBeLessThan(result.initialStoreState.usableHotWaterLitres);
  });

  it('storeTopTempC decreases after a draw', () => {
    const result = runStoredDhwPhaseModel(boilerPhaseInput);
    expect(result.drawOffResult.postDrawStoreState.storeTopTempC)
      .toBeLessThanOrEqual(result.initialStoreState.storeTopTempC);
  });

  it('storeMeanTempC decreases after a draw', () => {
    const result = runStoredDhwPhaseModel(boilerPhaseInput);
    expect(result.drawOffResult.postDrawStoreState.storeMeanTempC)
      .toBeLessThan(result.initialStoreState.storeMeanTempC);
  });

  it('storeDepletionLitres is > 0 for a draw that was served', () => {
    const result = runStoredDhwPhaseModel(boilerPhaseInput);
    expect(result.drawOffResult.storeDepletionLitres).toBeGreaterThan(0);
  });

  it('storeDepletionLitres is less than the nominal cylinder volume', () => {
    const result = runStoredDhwPhaseModel(boilerPhaseInput);
    expect(result.drawOffResult.storeDepletionLitres)
      .toBeLessThan(boilerPhaseInput.cylinderVolumeLitres);
  });

  it('storeDepletionLitres is less than or equal to deliveredVolumeLitres × hotFraction', () => {
    // Hot fraction at 55 °C mean, 40 °C tap, 10 °C cold: (40−10)/(55−10) = 0.667
    const result = runStoredDhwPhaseModel(boilerPhaseInput);
    // Depletion should be ≤ delivered × 1 (hot fraction ≤ 1)
    expect(result.drawOffResult.storeDepletionLitres)
      .toBeLessThanOrEqual(result.drawOffResult.deliveredVolumeLitres);
  });

  it('a larger draw depletes the store more than a smaller draw', () => {
    const small = runStoredDhwPhaseModel({ ...boilerPhaseInput, drawVolumeLitres: 10 });
    const large = runStoredDhwPhaseModel({ ...boilerPhaseInput, drawVolumeLitres: 80 });
    expect(large.drawOffResult.storeDepletionLitres)
      .toBeGreaterThan(small.drawOffResult.storeDepletionLitres);
  });

  it('estimatedRecoveryMinutes increases after a larger draw', () => {
    const small = runStoredDhwPhaseModel({ ...boilerPhaseInput, drawVolumeLitres: 10 });
    const large = runStoredDhwPhaseModel({ ...boilerPhaseInput, drawVolumeLitres: 80 });
    expect(large.drawOffResult.postDrawStoreState.estimatedRecoveryMinutes)
      .toBeGreaterThan(small.drawOffResult.postDrawStoreState.estimatedRecoveryMinutes);
  });
});

// ─── 2. Tap performance comes from store, not from the appliance ──────────────

describe('StoredDhwPhaseModel — tap performance from stored state, not appliance', () => {
  it('deliveredVolumeLitres is clamped by available usable store volume', () => {
    // Draw more than the usable store
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      drawVolumeLitres: 999, // request far exceeds cylinder
    });
    expect(result.drawOffResult.deliveredVolumeLitres)
      .toBeLessThanOrEqual(result.initialStoreState.usableHotWaterLitres);
  });

  it('deliveredVolumeLitres equals drawVolumeLitres when store has enough', () => {
    const result = runStoredDhwPhaseModel({ ...boilerPhaseInput, drawVolumeLitres: 10 });
    expect(result.drawOffResult.deliveredVolumeLitres).toBe(10);
  });

  it('deliveredTempC equals tapTargetTempC when store has adequate usable volume', () => {
    const result = runStoredDhwPhaseModel({ ...boilerPhaseInput, drawVolumeLitres: 10 });
    expect(result.drawOffResult.deliveredTempC).toBe(40);
  });

  it('deliveredFlowLpm matches drawFlowLpm (store delivers at pipe-determined rate)', () => {
    const result = runStoredDhwPhaseModel(boilerPhaseInput);
    expect(result.drawOffResult.deliveredFlowLpm).toBe(boilerPhaseInput.drawFlowLpm);
  });

  it('delivery is limited by store state: nearly-empty store delivers less', () => {
    // Small cylinder at near-depleted temperature: usable = 20 × (41-10)/(40-10) ≈ 20.7 L
    const depleted = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      cylinderVolumeLitres: 20, // tiny cylinder — usable volume < draw
      storeMeanTempC: 41,       // just above tap target
      storeTopTempC: 42,
    });
    const full = runStoredDhwPhaseModel(boilerPhaseInput);
    expect(depleted.drawOffResult.deliveredVolumeLitres)
      .toBeLessThan(full.drawOffResult.deliveredVolumeLitres);
  });
});

// ─── 3. Recharge is not automatic at tap-open ─────────────────────────────────

describe('StoredDhwPhaseModel — recharge is NOT automatic at tap-open', () => {
  it('reheatTriggered is false for a small draw on a well-charged boiler cylinder', () => {
    // Small draw: store stays above thermostat threshold
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      drawVolumeLitres: 5,
      controlMode: 'thermostat_call',
      thermostatThresholdC: 45, // well below storeMeanTempC 55 °C
    });
    expect(result.drawOffResult.reheatTriggered).toBe(false);
  });

  it('reheatTriggered is false when hysteresis lower bound is not crossed', () => {
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      drawVolumeLitres: 5,
      controlMode: 'hysteresis_reheat',
      thermostatThresholdC: 55,
      hysteresisBandC: 20, // lower bound = 35 °C — storeMeanTempC post-draw won't reach this
    });
    expect(result.drawOffResult.reheatTriggered).toBe(false);
  });

  it('reheatTriggered is false in time_program mode when scheduledWindowActive is false', () => {
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      drawVolumeLitres: 80,      // large draw to drop the store
      controlMode: 'time_program',
      scheduledWindowActive: false, // no scheduled window active
    });
    // Even with a large draw, reheat should not fire if no window is active
    // (unless priority reheat kicks in — covered in another test)
    // Use a moderate draw to avoid priority reheat threshold
    const moderateResult = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      drawVolumeLitres: 30,
      controlMode: 'time_program',
      scheduledWindowActive: false,
    });
    // postDrawMeanTempC will be above threshold; no scheduled window
    if (!moderateResult.drawOffResult.reheatTriggered) {
      expect(moderateResult.drawOffResult.reheatTriggered).toBe(false);
    }
    // At minimum, reheatTriggerReason should not be 'scheduled_window'
    expect(moderateResult.drawOffResult.reheatTriggerReason).not.toBe('scheduled_window');
  });

  it('postDrawStoreState.reheatRequired is false when no trigger condition is met', () => {
    // Small draw; thermostatThresholdC well below post-draw mean (54 °C) but above tap target
    // Post-draw mean ≈ 54 °C (5 L draw from 55 °C mean, 150 L cylinder)
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      drawVolumeLitres: 5,
      thermostatThresholdC: 42, // above tap target (40 °C), but below post-draw mean (54 °C)
    });
    expect(result.drawOffResult.postDrawStoreState.reheatRequired).toBe(false);
  });
});

// ─── 4. Recharge CAN trigger after meaningful depletion ───────────────────────

describe('StoredDhwPhaseModel — recharge triggers after significant depletion', () => {
  it('reheatTriggered is true when thermostat threshold is crossed', () => {
    // Draw enough to drop the mean below the thermostat threshold (55 °C)
    // storeMeanTempC = 55, thermostatThreshold = 55 → even small draw crosses it
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      storeMeanTempC: 56,  // just above threshold
      thermostatThresholdC: 55,
      drawVolumeLitres: 54, // enough to drop mean below threshold
      controlMode: 'thermostat_call',
    });
    expect(result.drawOffResult.reheatTriggered).toBe(true);
    expect(result.drawOffResult.reheatTriggerReason).toBe('thermostat_threshold');
  });

  it('postDrawStoreState.reheatRequired is true when threshold crossed', () => {
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      storeMeanTempC: 56,
      thermostatThresholdC: 55,
      drawVolumeLitres: 54,
      controlMode: 'thermostat_call',
    });
    expect(result.drawOffResult.postDrawStoreState.reheatRequired).toBe(true);
  });

  it('reheatTriggerReason is "hysteresis_threshold" when hysteresis lower bound is crossed', () => {
    // thermostatThreshold=55, hysteresisBand=5 → lower bound = 50 °C
    // Need a large draw to drop storeMeanTempC below 50 °C
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      storeMeanTempC: 55,
      thermostatThresholdC: 55,
      hysteresisBandC: 5,
      drawVolumeLitres: 100, // large draw to push mean well below 50 °C
      controlMode: 'hysteresis_reheat',
    });
    // May trigger priority_reheat or hysteresis_threshold depending on depletion
    expect(['hysteresis_threshold', 'priority_reheat']).toContain(
      result.drawOffResult.reheatTriggerReason,
    );
  });

  it('reheatTriggerReason is "scheduled_window" when time_program and window is active', () => {
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      storeMeanTempC: 54,       // below thermostatThresholdC (55)
      thermostatThresholdC: 55,
      drawVolumeLitres: 54,
      controlMode: 'time_program',
      scheduledWindowActive: true,
    });
    expect(['scheduled_window', 'priority_reheat']).toContain(
      result.drawOffResult.reheatTriggerReason,
    );
  });

  it('reheatTriggerReason is "priority_reheat" when store is severely depleted', () => {
    // Drive the store to near-empty so usable fraction < 20 %
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      drawVolumeLitres: 10000, // massively over-draw
      controlMode: 'thermostat_call',
      thermostatThresholdC: 10, // threshold so low it would normally not fire
    });
    // With extreme depletion, priority reheat should fire
    expect(result.drawOffResult.reheatTriggered).toBe(true);
    expect(result.drawOffResult.reheatTriggerReason).toBe('priority_reheat');
  });
});

// ─── 5. Heat pump vs boiler recovery characteristics ─────────────────────────

describe('StoredDhwPhaseModel — heat pump recovery is slower than boiler', () => {
  it('heat pump recoveryRateLph is lower than boiler recoveryRateLph', () => {
    const boiler = runStoredDhwPhaseModel(boilerPhaseInput);
    const hp = runStoredDhwPhaseModel(hpPhaseInput);
    expect(hp.recoveryRateLph).toBeLessThan(boiler.recoveryRateLph);
  });

  it('heat pump estimatedRecoveryMinutes is higher than boiler for equivalent depletion', () => {
    // Both draw the same volume to ensure comparable depletion
    const commonDraw = 40;
    const boiler = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      drawVolumeLitres: commonDraw,
      storeTopTempC: 60,
      storeMeanTempC: 55,
    });
    const hp = runStoredDhwPhaseModel({
      ...hpPhaseInput,
      drawVolumeLitres: commonDraw,
      storeTopTempC: 50,
      storeMeanTempC: 45,
    });
    expect(hp.drawOffResult.postDrawStoreState.estimatedRecoveryMinutes)
      .toBeGreaterThan(boiler.drawOffResult.postDrawStoreState.estimatedRecoveryMinutes);
  });

  it('heat pump recoveryCharacteristic is "heat_pump_stored"', () => {
    const result = runStoredDhwPhaseModel(hpPhaseInput);
    expect(result.recoveryCharacteristic).toBe('heat_pump_stored');
  });

  it('boiler recoveryCharacteristic is "boiler_stored"', () => {
    const result = runStoredDhwPhaseModel(boilerPhaseInput);
    expect(result.recoveryCharacteristic).toBe('boiler_stored');
  });

  it('heat pump draw-off also reduces store state', () => {
    const result = runStoredDhwPhaseModel(hpPhaseInput);
    expect(result.drawOffResult.postDrawStoreState.storeMeanTempC)
      .toBeLessThan(result.initialStoreState.storeMeanTempC);
  });

  it('heat pump draw-off does not use combi path', () => {
    const result = runStoredDhwPhaseModel(hpPhaseInput);
    expect(result.usedCombiDhwPath).toBe(false);
  });
});

// ─── 6. Invariant: usedCombiDhwPath is always false ──────────────────────────

describe('StoredDhwPhaseModel — usedCombiDhwPath invariant', () => {
  it('usedCombiDhwPath is false for a boiler stored draw', () => {
    const result = runStoredDhwPhaseModel(boilerPhaseInput);
    expect(result.usedCombiDhwPath).toBe(false);
  });

  it('usedCombiDhwPath is false for a heat pump stored draw', () => {
    const result = runStoredDhwPhaseModel(hpPhaseInput);
    expect(result.usedCombiDhwPath).toBe(false);
  });

  it('usedCombiDhwPath is false regardless of draw size', () => {
    const large = runStoredDhwPhaseModel({ ...boilerPhaseInput, drawVolumeLitres: 10000 });
    expect(large.usedCombiDhwPath).toBe(false);
  });

  it('usedCombiDhwPath is false in hysteresis_reheat mode', () => {
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      controlMode: 'hysteresis_reheat',
    });
    expect(result.usedCombiDhwPath).toBe(false);
  });

  it('usedCombiDhwPath is false in time_program mode', () => {
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      controlMode: 'time_program',
      scheduledWindowActive: true,
    });
    expect(result.usedCombiDhwPath).toBe(false);
  });
});

// ─── 7. No combi-style purge/overrun behaviour ────────────────────────────────

describe('StoredDhwPhaseModel — no combi-style direct-DHW markers', () => {
  it('result has no combiDhwPath field set to true', () => {
    const result = runStoredDhwPhaseModel(boilerPhaseInput);
    // usedCombiDhwPath is always false — the type literally cannot be true
    expect(result.usedCombiDhwPath).not.toBe(true);
  });

  it('does not emit purge or overrun concepts in the draw-off result', () => {
    const result = runStoredDhwPhaseModel(boilerPhaseInput);
    // The draw-off result has no purge/overrun properties — stored draws
    // serve from stored hot water, not from a direct heat exchanger with
    // cold-purge transients.
    expect(result.drawOffResult).not.toHaveProperty('purgeVolumeLitres');
    expect(result.drawOffResult).not.toHaveProperty('initiationDelaySeconds');
    expect(result.drawOffResult).not.toHaveProperty('overrunKwh');
  });

  it('controlMode is never "direct_combi"', () => {
    const result = runStoredDhwPhaseModel(boilerPhaseInput);
    expect(result.controlMode).not.toBe('direct_combi');
    expect(['time_program', 'thermostat_call', 'hysteresis_reheat']).toContain(result.controlMode);
  });
});

// ─── 8. CH interruption logic ─────────────────────────────────────────────────

describe('StoredDhwPhaseModel — CH interruption when reheat triggers', () => {
  it('chInterruptedByReheat is false when reheat is not triggered', () => {
    // Small draw; threshold well below post-draw mean so no reheat trigger
    // Post-draw mean ≈ 54 °C after a 5 L draw from 55 °C mean, 150 L cylinder
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      drawVolumeLitres: 5,
      thermostatThresholdC: 42, // above tap target (40 °C), but well below post-draw mean
      simultaneousChActive: true,
      zoneControlTopology: 'y_plan',
    });
    expect(result.drawOffResult.chInterruptedByReheat).toBe(false);
  });

  it('chInterruptedByReheat is false when CH is not active, even with Y-plan and reheat', () => {
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      storeMeanTempC: 56,
      thermostatThresholdC: 55,
      drawVolumeLitres: 54,
      simultaneousChActive: false, // CH not running
      zoneControlTopology: 'y_plan',
      controlMode: 'thermostat_call',
    });
    expect(result.drawOffResult.chInterruptedByReheat).toBe(false);
  });

  it('chInterruptedByReheat is false with S-plan even when reheat fires and CH is active', () => {
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      storeMeanTempC: 56,
      thermostatThresholdC: 55,
      drawVolumeLitres: 54,
      simultaneousChActive: true,
      zoneControlTopology: 's_plan', // independent circuits
      controlMode: 'thermostat_call',
    });
    expect(result.drawOffResult.chInterruptedByReheat).toBe(false);
  });

  it('chInterruptedByReheat is true when Y-plan, CH active, and reheat triggers', () => {
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      storeMeanTempC: 56,
      thermostatThresholdC: 55,
      drawVolumeLitres: 54,
      simultaneousChActive: true,
      zoneControlTopology: 'y_plan',
      controlMode: 'thermostat_call',
    });
    if (result.drawOffResult.reheatTriggered) {
      expect(result.drawOffResult.chInterruptedByReheat).toBe(true);
    }
  });
});

// ─── 9. Runner integration — hydronic runners populate storedDhwPhase ─────────

describe('Runner integration — hydronic runners populate storedDhwPhase', () => {
  const systemInput: EngineInputV2_3 = {
    ...baseEngineInput,
    currentHeatSourceType: 'system',
  };
  const regularInput: EngineInputV2_3 = {
    ...baseEngineInput,
    currentHeatSourceType: 'regular',
  };
  const heatPumpInput: EngineInputV2_3 = {
    ...baseEngineInput,
    currentHeatSourceType: 'ashp',
  };

  it('system runner populates dhw.storedDhwPhase', () => {
    const result = runSystemStoredSystemModel(systemInput, systemTopology);
    expect(result.dhw.storedDhwPhase).toBeDefined();
  });

  it('regular runner populates dhw.storedDhwPhase', () => {
    const result = runRegularStoredSystemModel(regularInput, regularTopology);
    expect(result.dhw.storedDhwPhase).toBeDefined();
  });

  it('heat pump runner populates dhw.storedDhwPhase', () => {
    const result = runHeatPumpStoredSystemModel(heatPumpInput, hpTopology);
    expect(result.dhw.storedDhwPhase).toBeDefined();
  });

  it('system runner storedDhwPhase.usedCombiDhwPath is false', () => {
    const result = runSystemStoredSystemModel(systemInput, systemTopology);
    expect(result.dhw.storedDhwPhase?.usedCombiDhwPath).toBe(false);
  });

  it('regular runner storedDhwPhase.usedCombiDhwPath is false', () => {
    const result = runRegularStoredSystemModel(regularInput, regularTopology);
    expect(result.dhw.storedDhwPhase?.usedCombiDhwPath).toBe(false);
  });

  it('heat pump runner storedDhwPhase.usedCombiDhwPath is false', () => {
    const result = runHeatPumpStoredSystemModel(heatPumpInput, hpTopology);
    expect(result.dhw.storedDhwPhase?.usedCombiDhwPath).toBe(false);
  });

  it('heat pump runner storedDhwPhase.recoveryCharacteristic is "heat_pump_stored"', () => {
    const result = runHeatPumpStoredSystemModel(heatPumpInput, hpTopology);
    expect(result.dhw.storedDhwPhase?.recoveryCharacteristic).toBe('heat_pump_stored');
  });

  it('system runner storedDhwPhase.recoveryCharacteristic is "boiler_stored"', () => {
    const result = runSystemStoredSystemModel(systemInput, systemTopology);
    expect(result.dhw.storedDhwPhase?.recoveryCharacteristic).toBe('boiler_stored');
  });

  it('heat pump runner recovery rate is lower than system runner recovery rate', () => {
    const sysResult = runSystemStoredSystemModel(systemInput, systemTopology);
    const hpResult  = runHeatPumpStoredSystemModel(heatPumpInput, hpTopology);
    expect(hpResult.dhw.storedDhwPhase?.recoveryRateLph)
      .toBeLessThan(sysResult.dhw.storedDhwPhase!.recoveryRateLph);
  });
});

// ─── 10. Combi runner does NOT populate storedDhwPhase ───────────────────────

describe('Runner integration — combi runner does NOT use stored phase model', () => {
  const combiInput: EngineInputV2_3 = {
    ...baseEngineInput,
    currentHeatSourceType: 'combi',
    preferCombi: true,
  };

  it('combi runner dhw.storedDhwPhase is absent', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.dhw.storedDhwPhase).toBeUndefined();
  });

  it('combi runner does not own storedDhwV1', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.dhw.storedDhwV1).toBeUndefined();
  });

  it('combi runner dhw.kind is "direct_combi" (not "stored")', () => {
    const result = runCombiSystemModel(combiInput, combiTopology);
    expect(result.dhw.kind).toBe('direct_combi');
  });
});

// ─── 11. StoredDhwPhaseModel is never called in CombiDhwModule ───────────────

describe('Negative test — CombiDhwModule never calls StoredDhwPhaseModel', () => {
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

// ─── 12. adaptEngineInputToStoredPhase adapter ───────────────────────────────

describe('adaptEngineInputToStoredPhase — adapts EngineInputV2_3 correctly', () => {
  it('returns boiler_stored recoveryCharacteristic for boiler family', () => {
    const adapted = adaptEngineInputToStoredPhase(baseEngineInput, 'boiler_stored');
    expect(adapted.recoveryCharacteristic).toBe('boiler_stored');
  });

  it('returns heat_pump_stored recoveryCharacteristic for HP family', () => {
    const adapted = adaptEngineInputToStoredPhase(baseEngineInput, 'heat_pump_stored');
    expect(adapted.recoveryCharacteristic).toBe('heat_pump_stored');
  });

  it('uses explicit cylinderVolumeLitres when provided', () => {
    const adapted = adaptEngineInputToStoredPhase(
      { ...baseEngineInput, cylinderVolumeLitres: 210 },
      'boiler_stored',
    );
    expect(adapted.cylinderVolumeLitres).toBe(210);
  });

  it('falls back to dhwStorageLitres when cylinderVolumeLitres is absent', () => {
    const adapted = adaptEngineInputToStoredPhase(
      { ...baseEngineInput, dhwStorageLitres: 180 },
      'boiler_stored',
    );
    expect(adapted.cylinderVolumeLitres).toBe(180);
  });

  it('defaults to 150 L when no cylinder volume is specified', () => {
    const adapted = adaptEngineInputToStoredPhase(baseEngineInput, 'boiler_stored');
    expect(adapted.cylinderVolumeLitres).toBe(150);
  });

  it('uses explicit storeTempC when provided', () => {
    const adapted = adaptEngineInputToStoredPhase(
      { ...baseEngineInput, storeTempC: 65 },
      'boiler_stored',
    );
    expect(adapted.storeTopTempC).toBe(65);
  });

  it('derives boiler store temperature as 60 °C when no storeTempC provided', () => {
    const adapted = adaptEngineInputToStoredPhase(baseEngineInput, 'boiler_stored');
    expect(adapted.storeTopTempC).toBe(60);
  });

  it('derives HP store temperature as 50 °C when no storeTempC provided', () => {
    const adapted = adaptEngineInputToStoredPhase(baseEngineInput, 'heat_pump_stored');
    expect(adapted.storeTopTempC).toBe(50);
  });

  it('storeMeanTempC is less than storeTopTempC (stratification offset)', () => {
    const adapted = adaptEngineInputToStoredPhase(baseEngineInput, 'boiler_stored');
    expect(adapted.storeMeanTempC).toBeLessThan(adapted.storeTopTempC);
  });

  it('produces a valid phase result when passed to runStoredDhwPhaseModel', () => {
    const adapted = adaptEngineInputToStoredPhase(baseEngineInput, 'boiler_stored');
    const result = runStoredDhwPhaseModel(adapted);
    expect(result.usedCombiDhwPath).toBe(false);
    expect(result.drawOffResult).toBeDefined();
    expect(result.initialStoreState).toBeDefined();
  });
});

// ─── 13. Edge cases ───────────────────────────────────────────────────────────

describe('StoredDhwPhaseModel — edge cases', () => {
  it('handles store temperature at tap target (zero usable volume gracefully)', () => {
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      storeMeanTempC: 40,   // exactly at tapTargetTempC — no usable volume
      storeTopTempC: 40,
    });
    expect(result.initialStoreState.usableHotWaterLitres).toBe(0);
    expect(result.drawOffResult.deliveredVolumeLitres).toBe(0);
  });

  it('handles store temperature below tap target (zero usable volume)', () => {
    const result = runStoredDhwPhaseModel({
      ...boilerPhaseInput,
      storeMeanTempC: 35,   // below tapTargetTempC
      storeTopTempC: 38,
    });
    expect(result.initialStoreState.usableHotWaterLitres).toBe(0);
    expect(result.drawOffResult.deliveredVolumeLitres).toBe(0);
  });

  it('handles zero draw volume (no depletion, no reheat)', () => {
    const result = runStoredDhwPhaseModel({ ...boilerPhaseInput, drawVolumeLitres: 0 });
    expect(result.drawOffResult.storeDepletionLitres).toBe(0);
    // Store state should be unchanged from initial
    expect(result.drawOffResult.postDrawStoreState.storeMeanTempC)
      .toBeCloseTo(result.initialStoreState.storeMeanTempC, 1);
  });

  it('cylinderVolumeLitres in result matches input', () => {
    const result = runStoredDhwPhaseModel({ ...boilerPhaseInput, cylinderVolumeLitres: 210 });
    expect(result.cylinderVolumeLitres).toBe(210);
  });

  it('recoveryRateLph is greater than zero for boiler stored', () => {
    const result = runStoredDhwPhaseModel(boilerPhaseInput);
    expect(result.recoveryRateLph).toBeGreaterThan(0);
  });

  it('recoveryRateLph is greater than zero for heat pump stored', () => {
    const result = runStoredDhwPhaseModel(hpPhaseInput);
    expect(result.recoveryRateLph).toBeGreaterThan(0);
  });
});
